
if (!SIIT.Session.requireAuth()) {}
RBAC.enforce();
const user = SIIT.Session.get();
if (user) document.getElementById('userName').textContent = user.full_name || user.email;
document.getElementById('sidebarToggle')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('show'));
SIIT.initSupabase();

const isTrainerUser = () => (user && user.role_name === 'Trainer');
let trainerAssignedBatchIds = null;

async function getTrainerAssignedBatchIds() {
  if (trainerAssignedBatchIds) return trainerAssignedBatchIds;
  if (typeof TrainerWorkspace === 'undefined' || !isTrainerUser()) {
    trainerAssignedBatchIds = null;
    return null;
  }
  try {
    trainerAssignedBatchIds = await TrainerWorkspace.listAssignedBatchIds();
  } catch (e) {
    console.warn(e);
    trainerAssignedBatchIds = [];
  }
  return trainerAssignedBatchIds;
}

const TABLE = 'feedback_forms';
const DEFAULT_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Satisfactory', 'Needs Improvement'];
const POWER_BI_QUESTIONS = [
  'How would you rate the overall quality of the Power BI course?',
  'How clear and effective was the trainer explanation of Power BI concepts?',
  'How useful were the practical exercises and hands-on activities?',
  'How well did the course improve your ability to create reports and dashboards in Power BI?',
  'How satisfied are you with the course content, examples, and learning materials?',
  'How likely are you to recommend this Power BI course to others?'
];

let allRows = [], editId = null, batchMap = {}, responseCounts = {};
let currentRespFormId = null, currentRespRows = [], currentRespFields = [];
const modal = new bootstrap.Modal(document.getElementById('crudModal'));
const respModal = new bootstrap.Modal(document.getElementById('respModal'));
const form = document.getElementById('crudForm');

function toNumOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFields(row) {
  let f = row && row.fields_json;
  if (typeof f === 'string') {
    try { f = JSON.parse(f); } catch (_) { f = []; }
  }
  return Array.isArray(f) ? f : [];
}

function powerBiFields() {
  return POWER_BI_QUESTIONS.map((label, idx) => ({
    key: 'q' + (idx + 1),
    label,
    type: 'radio',
    options: DEFAULT_OPTIONS.slice(),
    required: true
  })).concat([{
    key: 'comments',
    label: 'Additional Comments / Suggestions',
    type: 'text',
    options: [],
    required: false
  }]);
}

function renderQuestionsBuilder(fields) {
  const host = document.getElementById('questionsBuilder');
  const list = fields && fields.length ? fields : [];
  if (!list.length) {
    host.innerHTML = '<div class="text-muted small">No questions. Click <strong>Add question</strong> or <strong>Power BI template</strong>.</div>';
    return;
  }
  host.innerHTML = '';
  list.forEach((q, i) => {
    const opts = (q.options && q.options.length) ? q.options : DEFAULT_OPTIONS;
    const type = q.type || 'radio';
    const card = document.createElement('div');
    card.className = 'card mb-2 q-row';
    card.innerHTML =
      '<div class="card-body py-2">' +
        '<div class="d-flex justify-content-between align-items-center mb-1">' +
          '<strong class="small text-primary">Q' + (i + 1) + '</strong>' +
          '<button type="button" class="btn btn-sm btn-outline-danger btn-remove-q"><i class="fas fa-trash"></i> Remove</button>' +
        '</div>' +
        '<label class="form-label small mb-0">Question text</label>' +
        '<textarea class="form-control form-control-sm mb-2 q-label" rows="2"></textarea>' +
        '<div class="row g-2">' +
          '<div class="col-md-4"><label class="form-label small mb-0">Type</label>' +
            '<select class="form-select form-select-sm q-type">' +
              '<option value="radio">Single choice</option>' +
              '<option value="text">Text / comments</option>' +
            '</select></div>' +
          '<div class="col-md-8"><label class="form-label small mb-0">Options (use | between)</label>' +
            '<input type="text" class="form-control form-control-sm q-options" placeholder="Excellent | Very Good | Good | Satisfactory | Needs Improvement"></div>' +
        '</div>' +
      '</div>';
    host.appendChild(card);
    card.querySelector('.q-label').value = q.label || '';
    card.querySelector('.q-type').value = type;
    card.querySelector('.q-options').value = opts.join(' | ');
    card.querySelector('.btn-remove-q').onclick = function () {
      const rows = collectQuestionsFromBuilder();
      const idx = [...host.querySelectorAll('.q-row')].indexOf(card);
      rows.splice(idx, 1);
      renderQuestionsBuilder(rows);
    };
  });
}

function collectQuestionsFromBuilder() {
  return [...document.querySelectorAll('#questionsBuilder .q-row')].map((row, i) => {
    const label = (row.querySelector('.q-label')?.value || '').trim();
    const type = row.querySelector('.q-type')?.value || 'radio';
    const optStr = row.querySelector('.q-options')?.value || '';
    const options = type === 'text' ? [] : optStr.split('|').map(s => s.trim()).filter(Boolean);
    return {
      key: 'q' + (i + 1),
      label: label || ('Question ' + (i + 1)),
      type,
      options: options.length ? options : (type === 'radio' ? DEFAULT_OPTIONS.slice() : []),
      required: type === 'radio'
    };
  });
}

function addQuestionRow() {
  const fields = collectQuestionsFromBuilder();
  fields.push({
    key: 'q' + (fields.length + 1),
    label: '',
    type: 'radio',
    options: DEFAULT_OPTIONS.slice(),
    required: true
  });
  renderQuestionsBuilder(fields);
}

function loadPowerBiTemplate() {
  renderQuestionsBuilder(powerBiFields());
  if (form.elements['title'] && !form.elements['title'].value) {
    form.elements['title'].value = 'Power BI Course – Student Feedback Form';
  }
  if (form.elements['description'] && !form.elements['description'].value) {
    form.elements['description'].value = 'Please rate the course based on your learning experience.';
  }
  SIIT.Utils.toast('Power BI questions loaded');
}

async function loadDropdowns() {
  await AdminCRUD.fillSelect('#selBatch', 'batches', {
    valueKey: 'id', labelKey: 'batch_name', order: 'batch_name', placeholder: '— All batches —', extraLabel: 'batch_code'
  });
  const batches = await AdminCRUD.list('batches', { order: 'batch_name', ascending: true, limit: 2000 });
  batchMap = {};
  batches.forEach(b => { batchMap[b.id] = b.batch_name; });
  document.getElementById('filterBatch').innerHTML = '<option value="">All batches</option>' +
    batches.map(b => '<option value="' + b.id + '">' + SIIT.Utils.escapeHtml(b.batch_name || b.id) + '</option>').join('');
}

async function loadResponseCounts() {
  responseCounts = {};
  try {
    const client = SIIT.initSupabase();
    const { data } = await client.from('student_feedback').select('form_id').not('form_id', 'is', null);
    (data || []).forEach(r => {
      if (r.form_id) responseCounts[r.form_id] = (responseCounts[r.form_id] || 0) + 1;
    });
  } catch (_) {}
}

function render(rows) {
  const tbody = document.getElementById('dataBody');
  document.getElementById('recordCount').textContent = rows.length + ' form(s)';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No forms yet. Click Add Form.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(row => {
    const typeLabel = row.form_type === 'second' ? '2nd Feedback' : '1st Feedback';
    const typeBadge = row.form_type === 'second' ? 'info' : 'primary';
    const stBadge = row.status === 'Published' ? 'success' : row.status === 'Closed' ? 'dark' : 'secondary';
    const qCount = parseFields(row).length;
    return '<tr>' +
      '<td>' + SIIT.Utils.escapeHtml(row.title) + '</td>' +
      '<td><span class="badge bg-' + typeBadge + '">' + typeLabel + '</span></td>' +
      '<td>' + SIIT.Utils.escapeHtml(batchMap[row.batch_id] || 'All batches') + '</td>' +
      '<td>' + qCount + '</td>' +
      '<td><span class="badge bg-' + stBadge + '">' + SIIT.Utils.escapeHtml(row.status || '—') + '</span></td>' +
      '<td>' + (isTrainerUser() ? '—' : (responseCounts[row.id] || 0)) + '</td>' +
      '<td class="text-nowrap">' +
        (isTrainerUser() ? '' : '<button class="btn btn-sm btn-outline-success me-1" title="Responses" onclick="viewResponses(' + row.id + ')"><i class="fas fa-inbox"></i></button>') +
        '<button class="btn btn-sm btn-outline-primary me-1" title="Edit" onclick="openForm(' + row.id + ')"><i class="fas fa-edit"></i></button>' +
        (isTrainerUser() ? '' : '<button class="btn btn-sm btn-outline-secondary me-1" title="Create instance" onclick="duplicateForm(' + row.id + ')"><i class="fas fa-copy"></i></button>') +
        (isTrainerUser() ? '' : '<button class="btn btn-sm btn-outline-danger" title="Delete" onclick="deleteRow(' + row.id + ', \'' + SIIT.Utils.escapeHtml(row.title).replace(/'/g, '') + '\')"><i class="fas fa-trash"></i></button>') +
      '</td></tr>';
  }).join('');
}

function applyFilters() {
  const b = document.getElementById('filterBatch').value;
  const t = document.getElementById('filterType').value;
  let rows = allRows.slice();
  if (b) rows = rows.filter(r => String(r.batch_id || '') === String(b));
  if (t) rows = rows.filter(r => r.form_type === t);
  render(rows);
}

document.getElementById('filterBatch')?.addEventListener('change', applyFilters);
document.getElementById('filterType')?.addEventListener('change', applyFilters);

async function loadData() {
  try {
    await loadDropdowns();
    allRows = await AdminCRUD.list(TABLE, { order: 'id', ascending: false });
    if (isTrainerUser()) {
      const ids = await getTrainerAssignedBatchIds();
      const idSet = new Set((ids || []).map(Number));
      allRows = (allRows || []).filter(r => r.batch_id != null && idSet.has(Number(r.batch_id)));
      // Restrict batch filter dropdown
      const fb = document.getElementById('filterBatch');
      if (fb && ids) {
        const keep = new Set(ids.map(String));
        [...fb.options].forEach(o => {
          if (o.value && !keep.has(o.value)) o.remove();
        });
      }
    } else {
      await loadResponseCounts();
    }
    applyFilters();
  } catch (e) {
    document.getElementById('dataBody').innerHTML =
      '<tr><td colspan="7" class="text-danger text-center">' + SIIT.Utils.escapeHtml(e.message) +
      ' — Run feedback_forms.sql in Supabase if table is missing.</td></tr>';
  }
}

async function openForm(id) {
  editId = id || null;
  form.reset();
  document.getElementById('formError').classList.add('d-none');
  document.getElementById('modalTitle').textContent = id ? 'Edit Feedback Form' : 'Add Feedback Form';
  await loadDropdowns();
  if (id) {
    const row = allRows.find(r => r.id == id);
    if (row) {
      AdminCRUD.fillForm(form, row);
      renderQuestionsBuilder(parseFields(row));
    } else {
      renderQuestionsBuilder([]);
    }
  } else {
    renderQuestionsBuilder([]);
  }
  modal.show();
}

/** Create a new form instance from an existing one (same questions, new title/batch) */
async function duplicateForm(id) {
  const row = allRows.find(r => r.id == id);
  if (!row) return;
  editId = null;
  form.reset();
  document.getElementById('formError').classList.add('d-none');
  document.getElementById('modalTitle').textContent = 'New instance from: ' + (row.title || '');
  await loadDropdowns();
  AdminCRUD.fillForm(form, {
    title: (row.title || 'Feedback') + ' (copy)',
    form_type: row.form_type || 'first',
    batch_id: '',
    status: 'Draft',
    description: row.description || ''
  });
  renderQuestionsBuilder(parseFields(row));
  modal.show();
  SIIT.Utils.toast('Copied questions — choose batch/type, then Save as new form');
}

async function deleteRow(id, name) {
  if (!AdminCRUD.confirmDelete(name)) return;
  try {
    await AdminCRUD.remove(TABLE, id);
    SIIT.Utils.toast('Deleted');
    loadData();
  } catch (e) {
    SIIT.Utils.toast(e.message, 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  document.getElementById('formError').classList.add('d-none');
  try {
    const payload = AdminCRUD.formData(form);
    delete payload.id;
    payload.batch_id = toNumOrNull(payload.batch_id);
    if (!payload.batch_id) payload.batch_id = null;
    payload.form_url = null;
    const fields = collectQuestionsFromBuilder();
    if (!fields.length) throw new Error('Add at least one question');
    payload.fields_json = fields;
    if (!payload.title) throw new Error('Title required');
    if (!payload.form_type) throw new Error('Type required');
    if (editId) await AdminCRUD.update(TABLE, editId, payload);
    else await AdminCRUD.insert(TABLE, payload);
    SIIT.Utils.toast(editId ? 'Form updated' : 'Form created');
    modal.hide();
    loadData();
  } catch (err) {
    document.getElementById('formError').textContent = err.message || 'Save failed';
    document.getElementById('formError').classList.remove('d-none');
  }
  btn.disabled = false;
});

async function viewResponses(formId) {
  if (isTrainerUser()) {
    SIIT.Utils.toast('Trainers cannot view who filled the feedback form.', 'error');
    return;
  }

  currentRespFormId = formId;
  const formRow = allRows.find(r => r.id == formId) || {};
  document.getElementById('respModalTitle').textContent = 'Responses — ' + (formRow.title || formId);
  currentRespFields = parseFields(formRow);
  const tbody = document.getElementById('respBody');
  const thead = document.getElementById('respHead');
  const empty = document.getElementById('respEmpty');
  thead.innerHTML = '<tr><th>Student</th><th>Batch</th>' +
    currentRespFields.map((f, i) => '<th title="' + SIIT.Utils.escapeHtml(f.label || '') + '">Q' + (i + 1) + '</th>').join('') +
    '<th>Submitted</th></tr>';
  tbody.innerHTML = '<tr><td colspan="' + (3 + currentRespFields.length) + '" class="text-center text-muted">Loading...</td></tr>';
  empty.classList.add('d-none');
  try {
    const client = SIIT.initSupabase();
    const { data, error } = await client.from('student_feedback').select('*').eq('form_id', formId).order('submitted_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const studentIds = [...new Set(rows.map(r => r.student_id).filter(Boolean))];
    const studentMap = {};
    if (studentIds.length) {
      const res = await client.from('students').select('id, full_name, email, college_roll_no, batch_id').in('id', studentIds);
      (res.data || []).forEach(s => { studentMap[s.id] = s; });
    }
    currentRespRows = rows.map(r => ({ ...r, _student: studentMap[r.student_id] || {} }));
    if (!currentRespRows.length) {
      tbody.innerHTML = '';
      empty.classList.remove('d-none');
    } else {
      tbody.innerHTML = currentRespRows.map(r => {
        const st = r._student;
        let answers = r.answers_json || {};
        if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch (_) { answers = {}; } }
        const ansCells = currentRespFields.map(f =>
          '<td class="small">' + SIIT.Utils.escapeHtml(answers[f.key] != null ? String(answers[f.key]) : '—') + '</td>'
        ).join('');
        return '<tr><td>' + SIIT.Utils.escapeHtml(st.full_name || st.email || r.student_id) +
          '<br><small class="text-muted">' + SIIT.Utils.escapeHtml(st.college_roll_no || '') + '</small></td>' +
          '<td>' + SIIT.Utils.escapeHtml(batchMap[r.batch_id || st.batch_id] || '—') + '</td>' +
          ansCells + '<td>' + (r.submitted_at ? SIIT.Utils.formatDate(r.submitted_at) : '—') + '</td></tr>';
      }).join('');
    }
    respModal.show();
  } catch (e) {
    tbody.innerHTML = '<tr><td class="text-danger">' + SIIT.Utils.escapeHtml(e.message) + '</td></tr>';
    respModal.show();
  }
}

function exportResponsesCsv() {
  const headers = ['Student', 'Roll', 'Email', 'Batch', ...currentRespFields.map((f, i) => 'Q' + (i + 1)), 'Submitted'];
  const lines = [headers.join(',')];
  const esc = v => String(v == null ? '' : v).replace(/,/g, ' ').replace(/\n/g, ' ');
  currentRespRows.forEach(r => {
    const st = r._student || {};
    let answers = r.answers_json || {};
    if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch (_) { answers = {}; } }
    lines.push([esc(st.full_name), esc(st.college_roll_no), esc(st.email), esc(batchMap[r.batch_id || st.batch_id]),
      ...currentRespFields.map(f => esc(answers[f.key])), esc(r.submitted_at)].join(','));
  });
  const blob = new Blob([lines.join('\\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'feedback_form_' + currentRespFormId + '_responses.csv';
  a.click();
}

loadData();
