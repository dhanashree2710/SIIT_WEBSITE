/**
 * SIIT Admin CRUD + Storage helpers
 */
window.AdminCRUD = {
  client() {
    return SIIT.initSupabase();
  },

  async list(table, { select = '*', order = 'id', ascending = false, limit = 500 } = {}) {
    const client = this.client();
    if (!client) throw new Error('Supabase not available');
    const { data, error } = await client.from(table).select(select).order(order, { ascending }).limit(limit);
    if (error) throw error;
    return data || [];
  },

  async insert(table, payload) {
    const client = this.client();
    const { data, error } = await client.from(table).insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async update(table, id, payload, pk = 'id') {
    const client = this.client();
    if (payload && typeof payload === 'object') {
      // only set updated_at if column likely exists
      payload.updated_at = new Date().toISOString();
    }
    const { data, error } = await client.from(table).update(payload).eq(pk, id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(table, id, pk = 'id') {
    const client = this.client();
    const { error } = await client.from(table).delete().eq(pk, id);
    if (error) throw error;
    return true;
  },

  formData(form) {
    const fd = new FormData(form);
    const obj = {};
    for (const [k, v] of fd.entries()) {
      const el = form.elements[k];
      if (el && el.type === 'file') continue;
      if (v === '') obj[k] = null;
      else if (v === 'true') obj[k] = true;
      else if (v === 'false') obj[k] = false;
      else obj[k] = v;
    }
    form.querySelectorAll('input[type="number"]').forEach(inp => {
      if (obj[inp.name] !== null && obj[inp.name] !== undefined && obj[inp.name] !== '') {
        obj[inp.name] = Number(obj[inp.name]);
      }
    });
    form.querySelectorAll('input[type="checkbox"]').forEach(inp => {
      obj[inp.name] = inp.checked;
    });
    return obj;
  },

  fillForm(form, row) {
    if (!row) { form.reset(); return; }
    Object.keys(row).forEach(k => {
      const el = form.elements[k];
      if (!el || el.type === 'file') return;
      if (el.type === 'checkbox') el.checked = !!row[k];
      else if (el.type === 'date' && row[k]) el.value = String(row[k]).slice(0, 10);
      else if (el.tagName === 'SELECT') el.value = row[k] != null ? String(row[k]) : '';
      else if (row[k] !== null && row[k] !== undefined) el.value = row[k];
      else el.value = '';
    });
  },

  confirmDelete(name) {
    return confirm(`Delete "${name || 'this record'}"? This cannot be undone.`);
  },

  /**
   * Populate a <select> with options from a table.
   * @param {string|HTMLElement} selectEl
   * @param {string} table
   * @param {object} opts - { valueKey, labelKey, order, filter, placeholder, extraLabel }
   */
  async fillSelect(selectEl, table, opts = {}) {
    const el = typeof selectEl === 'string' ? document.querySelector(selectEl) : selectEl;
    if (!el) return [];
    const valueKey = opts.valueKey || 'id';
    const labelKey = opts.labelKey || 'name';
    const order = opts.order || labelKey;
    const placeholder = opts.placeholder || '— Select —';
    const current = el.value;
    try {
      const rows = await this.list(table, { order, ascending: true, limit: 1000 });
      let filtered = rows;
      if (opts.filter) filtered = rows.filter(opts.filter);
      el.innerHTML = `<option value="">${placeholder}</option>` +
        filtered.map(r => {
          const val = r[valueKey];
          let label = r[labelKey] || r.name || r.title || val;
          if (opts.extraLabel && r[opts.extraLabel]) label = `${label} (${r[opts.extraLabel]})`;
          return `<option value="${val}">${SIIT.Utils.escapeHtml(String(label))}</option>`;
        }).join('');
      if (current) el.value = current;
      return filtered;
    } catch (e) {
      console.error('fillSelect', table, e);
      el.innerHTML = `<option value="">Error loading</option>`;
      return [];
    }
  },

  /**
   * Upload file to Supabase Storage
   * @param {string} bucket
   * @param {File} file
   * @param {string} folder - optional folder prefix
   * @returns {Promise<{path, publicUrl}>}
   */
  async uploadFile(bucket, file, folder = '') {
    const client = this.client();
    if (!client) throw new Error('Supabase not available');
    if (!file || !file.size) throw new Error('No file selected');
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) throw new Error(`File too large (max ${maxMb}MB)`);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const path = `${folder ? folder + '/' : ''}${Date.now()}_${safe}`;
    const { data, error } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined
    });
    if (error) throw error;
    const { data: pub } = client.storage.from(bucket).getPublicUrl(data.path);
    return { path: data.path, publicUrl: pub.publicUrl };
  },


  /**
   * Create or update a login row in `users` for a person registered
   * as Student / Trainer / Coordinator / etc.
   * @param {object} opts
   *   roleName: 'Student' | 'Trainer' | ...
   *   full_name, email, phone, college_id
   *   password: plain text (default SIIT@2026)
   * @returns {Promise<object|null>} users row or null if skipped
   */
  async ensureLoginUser(opts = {}) {
    const client = this.client();
    if (!client) throw new Error('Supabase not available');
    const email = (opts.email || '').trim().toLowerCase();
    if (!email) {
      console.warn('ensureLoginUser: skipped — no email');
      return null;
    }
    const roleName = opts.roleName || 'Student';
    const { data: roleRow, error: roleErr } = await client
      .from('roles')
      .select('id, role_name')
      .eq('role_name', roleName)
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!roleRow) throw new Error('Role not found: ' + roleName);

    const plain = opts.password || 'SIIT@2026';
    const password_hash = await SIIT.hashPassword(plain);

    const { data: existing } = await client
      .from('users')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    const payload = {
      role_id: roleRow.id,
      full_name: opts.full_name || email,
      email,
      phone: opts.phone || null,
      college_id: opts.college_id ? Number(opts.college_id) : null,
      password_hash,
      password_plain: plain,
      status: true
    };

    if (existing) {
      // Keep password on update unless forcePassword
      if (!opts.forcePassword) delete payload.password_hash;
      const { data, error } = await client.from('users').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      return { user: data, created: false, password: opts.forcePassword ? plain : null };
    }
    const { data, error } = await client.from('users').insert([payload]).select().single();
    if (error) throw error;
    return { user: data, created: true, password: plain };
  },

  /** BUCKET NAMES – create these in Supabase Storage (public read for logos/gallery) */
  BUCKETS: {
    company: 'company',           // company logos
    profiles: 'profiles',         // user/trainer/student photos
    certificates: 'certificates', // generated certificate PDFs
    students: 'students',         // student documents
    quiz: 'quiz',                 // quiz question/answer files
    assessment: 'assessment',     // assessment files with answers
    tasks: 'tasks',               // task attachments & submissions
    gallery: 'gallery',           // website gallery images
    blogs: 'blogs'                // blog cover images
  }
};
