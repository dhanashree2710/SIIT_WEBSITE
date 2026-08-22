/**
 * SIIT Trainer Workspace
 * When a logged-in user has role "Trainer", admin pages switch to a
 * trainer-centric UX:
 *   - See only assigned batches (batches.trainer_id OR batch_trainers)
 *   - See / show batch attendance QR for those batches only
 *   - Mark own presenty (trainer_attendance) for assigned sessions
 *     → one mark per SESSION (not per day)
 *   - Full-Time trainers keep broader menu access (RBAC); Freelancers
 *     are more restricted via RBAC + this filter layer
 *
 * Links user → trainer by email, then user_id, then full_name.
 */
window.TrainerWorkspace = (function () {
  let cachedTrainer = null;

  function client() {
    return SIIT.initSupabase();
  }

  function session() {
    return SIIT.Session.get();
  }

  function isTrainer() {
    const s = session();
    return s && s.role_name === 'Trainer';
  }

  function isFreelance(trainer) {
    const t = trainer || cachedTrainer;
    if (!t) return false;
    const et = String(t.employment_type || '').toLowerCase();
    return et === 'freelancer' || et === 'freelance';
  }

  /** Resolve the trainers row for the logged-in user. */
  async function resolveTrainer(force) {
    if (cachedTrainer && !force) return cachedTrainer;
    const s = session();
    if (!s) throw new Error('Not logged in');
    const c = client();
    if (!c) throw new Error('Service unavailable');

    let row = null;
    if (s.email) {
      const { data } = await c
        .from('trainers')
        .select('*')
        .ilike('email', s.email.trim())
        .maybeSingle();
      row = data;
    }
    if (!row && s.id) {
      const { data } = await c
        .from('trainers')
        .select('*')
        .eq('user_id', s.id)
        .maybeSingle();
      row = data;
    }
    if (!row && s.full_name) {
      const { data } = await c
        .from('trainers')
        .select('*')
        .ilike('full_name', s.full_name.trim())
        .limit(1)
        .maybeSingle();
      row = data;
    }
    if (!row) {
      throw new Error(
        'No trainer profile linked to this login. Ask admin to set trainers.email = your login email (or link user_id).'
      );
    }
    cachedTrainer = row;
    return row;
  }

  /**
   * Assigned batch IDs: primary trainer on batch OR entry in batch_trainers.
   */
  async function listAssignedBatchIds() {
    const trainer = await resolveTrainer();
    const c = client();
    const ids = new Set();

    const { data: primary } = await c
      .from('batches')
      .select('id')
      .eq('trainer_id', trainer.id);
    (primary || []).forEach((b) => ids.add(Number(b.id)));

    try {
      const { data: junction } = await c
        .from('batch_trainers')
        .select('batch_id')
        .eq('trainer_id', trainer.id);
      (junction || []).forEach((r) => ids.add(Number(r.batch_id)));
    } catch (_) {
      /* batch_trainers may not exist yet */
    }

    return [...ids];
  }

  const SESSION_SELECT_FULL =
    '*, batches(batch_name, batch_code, attendance_qr_token, start_date, end_date, status, college_id, department_id, departments(department_name)), courses(course_name), colleges(college_name), departments(department_name)';
  const SESSION_SELECT_BASIC =
    '*, batches(batch_name, batch_code, attendance_qr_token, start_date, end_date, status, college_id, department_id), courses(course_name), colleges(college_name)';

  /** Full batch rows for assigned batches (with QR token ensured). */
  async function listAssignedBatches() {
    const ids = await listAssignedBatchIds();
    if (!ids.length) return [];
    const c = client();
    let rows = [];
    let { data, error } = await c
      .from('batches')
      .select(
        '*, courses(course_name), trainers(full_name), colleges(college_name), departments(department_name)'
      )
      .in('id', ids)
      .order('batch_name', { ascending: true });
    if (error) {
      const r2 = await c
        .from('batches')
        .select('*, courses(course_name), trainers(full_name), colleges(college_name)')
        .in('id', ids)
        .order('batch_name', { ascending: true });
      if (r2.error) throw r2.error;
      rows = r2.data || [];
    } else {
      rows = data || [];
    }
    // Multi departments per batch
    const batchDeptMap = {};
    try {
      if (ids.length) {
        const { data: bd } = await c
          .from('batch_departments')
          .select('batch_id, department_id')
          .in('batch_id', ids);
        (bd || []).forEach((r) => {
          if (!batchDeptMap[r.batch_id]) batchDeptMap[r.batch_id] = [];
          batchDeptMap[r.batch_id].push(Number(r.department_id));
        });
      }
    } catch (_) {}
    const allDeptIds = new Set();
    Object.values(batchDeptMap).forEach((arr) => arr.forEach((id) => allDeptIds.add(id)));
    rows.forEach((b) => {
      if (b.department_id) allDeptIds.add(Number(b.department_id));
    });
    const deptNameById = {};
    if (allDeptIds.size) {
      try {
        const { data: deps } = await c
          .from('departments')
          .select('id, department_name')
          .in('id', [...allDeptIds]);
        (deps || []).forEach((d) => {
          deptNameById[Number(d.id)] = d.department_name;
        });
      } catch (_) {}
    }

    for (const b of rows) {
      if (!b.attendance_qr_token) {
        try {
          const token = crypto.randomUUID();
          const { error: upErr } = await c
            .from('batches')
            .update({ attendance_qr_token: token })
            .eq('id', b.id);
          if (!upErr) b.attendance_qr_token = token;
        } catch (_) {}
      }
      let dids = batchDeptMap[b.id] || [];
      if (!dids.length && b.department_id) dids = [Number(b.department_id)];
      const names = dids.map((id) => deptNameById[id]).filter(Boolean);
      b._deptIds = dids;
      b._deptNames = names.join(', ');
      if (names.length) {
        b.departments = {
          department_name: names.join(', '),
          ...(b.departments || {})
        };
      }
    }
    return rows;
  }

  /** Sessions where this trainer is assigned (session.trainer_id OR batch assigned OR session_trainers). */
  async function listMySessions() {
    const trainer = await resolveTrainer();
    const batchIds = await listAssignedBatchIds();
    const c = client();

    async function fetchSessions(selectStr) {
      let q = c
        .from('attendance_sessions')
        .select(selectStr)
        .order('session_date', { ascending: false })
        .limit(500);
      if (batchIds.length) {
        q = q.or(
          `trainer_id.eq.${trainer.id},batch_id.in.(${batchIds.join(',')})`
        );
      } else {
        q = q.eq('trainer_id', trainer.id);
      }
      return q;
    }

    let sessions = [];
    let { data, error } = await fetchSessions(SESSION_SELECT_FULL);
    if (error) {
      const r2 = await fetchSessions(SESSION_SELECT_BASIC);
      if (r2.error) throw r2.error;
      sessions = r2.data || [];
    } else {
      sessions = data || [];
    }

    // Also sessions where trainer is in session_trainers
    try {
      const { data: stRows } = await c
        .from('session_trainers')
        .select('session_id')
        .eq('trainer_id', trainer.id);
      const extraIds = (stRows || []).map((r) => r.session_id).filter(Boolean);
      if (extraIds.length) {
        const have = new Set((sessions || []).map((s) => s.id));
        const missing = extraIds.filter((id) => !have.has(id));
        if (missing.length) {
          let more = null;
          const m1 = await c
            .from('attendance_sessions')
            .select(SESSION_SELECT_FULL)
            .in('id', missing);
          if (m1.error) {
            const m2 = await c
              .from('attendance_sessions')
              .select(SESSION_SELECT_BASIC)
              .in('id', missing);
            more = m2.data;
          } else {
            more = m1.data;
          }
          sessions = (sessions || []).concat(more || []);
        }
      }
    } catch (_) {}

    // Own presenty map — STRICTLY by session_id only (no date bleed)
    const sessionIds = (sessions || []).map((s) => s.id).filter(Boolean);
    const presentBySession = {};
    if (sessionIds.length) {
      const { data: att } = await c
        .from('trainer_attendance')
        .select('id, session_id, attendance_date, status, check_in, remarks')
        .eq('trainer_id', trainer.id)
        .in('session_id', sessionIds);
      (att || []).forEach((a) => {
        if (a.session_id) presentBySession[Number(a.session_id)] = a;
      });
    }

    // batch_departments → multi dept per batch
    const batchDeptMap = {};
    try {
      const bids = [
        ...new Set(
          (sessions || [])
            .map((s) => s.batch_id)
            .concat(batchIds || [])
            .filter(Boolean)
        )
      ];
      if (bids.length) {
        const { data: bd } = await c
          .from('batch_departments')
          .select('batch_id, department_id')
          .in('batch_id', bids);
        (bd || []).forEach((r) => {
          if (!batchDeptMap[r.batch_id]) batchDeptMap[r.batch_id] = [];
          batchDeptMap[r.batch_id].push(Number(r.department_id));
        });
      }
    } catch (_) {}

    // session_departments junction
    const sessionDeptMap = {};
    try {
      const sids = (sessions || []).map((s) => s.id).filter(Boolean);
      if (sids.length) {
        const { data: sd } = await c
          .from('session_departments')
          .select('session_id, department_id')
          .in('session_id', sids);
        (sd || []).forEach((r) => {
          if (!sessionDeptMap[r.session_id]) sessionDeptMap[r.session_id] = [];
          sessionDeptMap[r.session_id].push(Number(r.department_id));
        });
      }
    } catch (_) {}

    // Collect all dept ids for name lookup
    const deptIds = new Set();
    (sessions || []).forEach((s) => {
      if (s.department_id) deptIds.add(Number(s.department_id));
      if (s.batches && s.batches.department_id) deptIds.add(Number(s.batches.department_id));
      if (s.remarks && String(s.remarks).startsWith('__depts__:')) {
        String(s.remarks)
          .replace('__depts__:', '')
          .split(',')
          .map(Number)
          .filter(Boolean)
          .forEach((id) => deptIds.add(id));
      }
      (sessionDeptMap[s.id] || []).forEach((id) => deptIds.add(id));
      (batchDeptMap[s.batch_id] || []).forEach((id) => deptIds.add(id));
    });
    Object.values(batchDeptMap).forEach((arr) => arr.forEach((id) => deptIds.add(id)));
    const deptNameById = {};
    if (deptIds.size) {
      try {
        const { data: deps } = await c
          .from('departments')
          .select('id, department_name')
          .in('id', [...deptIds]);
        (deps || []).forEach((d) => {
          deptNameById[Number(d.id)] = d.department_name;
        });
      } catch (_) {}
    }

    const collegeIds = new Set();
    (sessions || []).forEach((s) => {
      if (s.college_id) collegeIds.add(Number(s.college_id));
      if (s.batches && s.batches.college_id) collegeIds.add(Number(s.batches.college_id));
    });
    const collegeNameById = {};
    if (collegeIds.size) {
      try {
        const { data: cols } = await c
          .from('colleges')
          .select('id, college_name')
          .in('id', [...collegeIds]);
        (cols || []).forEach((col) => {
          collegeNameById[Number(col.id)] = col.college_name;
        });
      } catch (_) {}
    }

    return (sessions || []).map((s) => {
      let multiDeptIds = [];
      if (sessionDeptMap[s.id] && sessionDeptMap[s.id].length) {
        multiDeptIds = sessionDeptMap[s.id];
      } else if (s.remarks && String(s.remarks).startsWith('__depts__:')) {
        multiDeptIds = String(s.remarks)
          .replace('__depts__:', '')
          .split(',')
          .map(Number)
          .filter(Boolean);
      } else if (s.batch_id && batchDeptMap[s.batch_id] && batchDeptMap[s.batch_id].length) {
        multiDeptIds = batchDeptMap[s.batch_id];
      } else if (s.department_id) {
        multiDeptIds = [Number(s.department_id)];
      } else if (s.batches && s.batches.department_id) {
        multiDeptIds = [Number(s.batches.department_id)];
      }

      const deptNames = multiDeptIds
        .map((id) => deptNameById[id])
        .filter(Boolean);
      const deptName =
        deptNames.length > 0
          ? deptNames.join(', ')
          : (s.departments && s.departments.department_name) ||
            (s.batches &&
              s.batches.departments &&
              s.batches.departments.department_name) ||
            null;

      const collegeId =
        s.college_id || (s.batches && s.batches.college_id) || null;
      const collegeName =
        (s.colleges && s.colleges.college_name) ||
        (s.batches && s.batches.colleges && s.batches.colleges.college_name) ||
        (collegeId && collegeNameById[Number(collegeId)]) ||
        null;

      return {
        ...s,
        _deptIds: multiDeptIds,
        _deptNames: deptName,
        departments: deptName
          ? { department_name: deptName, ...(s.departments || {}) }
          : s.departments || null,
        colleges: collegeName
          ? { college_name: collegeName, ...(s.colleges || {}) }
          : s.colleges || null,
        myPresenty: presentBySession[Number(s.id)] || null
      };
    });
  }

  /**
   * Mark trainer presenty for a specific session.
   * One record per (trainer_id, session_id).
   * Falls back to date-only if session_id column is missing (pre-migration).
   */
  async function markMyPresenty(opts) {
    const trainer = await resolveTrainer();
    const c = client();
    let dateStr = opts && opts.date ? String(opts.date).slice(0, 10) : null;
    let sessionId = opts && opts.sessionId ? Number(opts.sessionId) : null;
    let session = null;
    let batch = null;

    if (sessionId) {
      const { data, error } = await c
        .from('attendance_sessions')
        .select(
          '*, batches(id, batch_name, batch_code, start_date, end_date, status, college_id, department_id)'
        )
        .eq('id', sessionId)
        .maybeSingle();
      if (error || !data) throw new Error('Session not found');
      session = data;
      batch = data.batches || null;
      dateStr = (session.session_date || '').toString().slice(0, 10);

      // Must be assigned
      const batchIds = await listAssignedBatchIds();
      let ok =
        Number(session.trainer_id) === Number(trainer.id) ||
        batchIds.includes(Number(session.batch_id));
      if (!ok) {
        try {
          const { data: st } = await c
            .from('session_trainers')
            .select('id')
            .eq('session_id', sessionId)
            .eq('trainer_id', trainer.id)
            .maybeSingle();
          if (st) ok = true;
        } catch (_) {}
      }
      if (!ok) {
        throw new Error('You can only mark presenty for sessions assigned to you.');
      }
      if (!['Running', 'Scheduled'].includes(session.status)) {
        throw new Error('Presenty is only open for Running / Scheduled sessions.');
      }

      // Allow presenty until batch end date (inclusive)
      if (batch && batch.end_date) {
        const endD = String(batch.end_date).slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        if (today > endD) {
          throw new Error('Batch has ended on ' + endD + '. Presenty is closed.');
        }
      }

      // Presenty allowed on the session date (full day) for Running/Scheduled.
      // Optional soft hint if far outside the slot, but do not hard-block after end.
      if (session.session_date) {
        const sessDay = String(session.session_date).slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        // Block only if marking for a future session date
        if (today < sessDay) {
          throw new Error(
            'Presenty opens on the session date (' + sessDay + ').'
          );
        }
      }
    }

    if (!dateStr) {
      dateStr = new Date().toISOString().slice(0, 10);
    }

    // Prefer session-level uniqueness
    let existing = null;
    if (sessionId) {
      const { data } = await c
        .from('trainer_attendance')
        .select('*')
        .eq('trainer_id', trainer.id)
        .eq('session_id', sessionId)
        .maybeSingle();
      existing = data;
    }
    // Legacy day-only row (only block if we have no session_id support)
    if (!existing && !sessionId) {
      const { data } = await c
        .from('trainer_attendance')
        .select('*')
        .eq('trainer_id', trainer.id)
        .eq('attendance_date', dateStr)
        .is('session_id', null)
        .maybeSingle();
      existing = data;
    }

    if (existing && existing.status === 'Present') {
      throw new Error(
        sessionId
          ? 'You already marked Present for this session.'
          : 'You already marked Present for ' + dateStr
      );
    }

    const payload = {
      trainer_id: trainer.id,
      attendance_date: dateStr,
      check_in: new Date().toISOString(),
      status: 'Present',
      remarks: session
        ? 'Session ' +
          (session.session_code || sessionId) +
          (opts.remarks ? ' · ' + opts.remarks : '')
        : opts.remarks || null
    };

    // New columns (ignore if column missing — migration not yet run)
    if (sessionId) payload.session_id = sessionId;
    if (session) {
      if (session.batch_id) payload.batch_id = session.batch_id;
      if (session.college_id) payload.college_id = session.college_id;
      if (session.department_id) payload.department_id = session.department_id;
      if (session.session_code) payload.session_code = session.session_code;
    }
    if (batch) {
      if (!payload.batch_id && batch.id) payload.batch_id = batch.id;
      if (!payload.college_id && batch.college_id)
        payload.college_id = batch.college_id;
      if (!payload.department_id && batch.department_id)
        payload.department_id = batch.department_id;
    }

    async function tryWrite(data, isUpdate, id) {
      if (isUpdate) {
        return c.from('trainer_attendance').update(data).eq('id', id);
      }
      return c.from('trainer_attendance').insert([data]);
    }

    // First attempt with full payload; if column missing, strip extras and retry
    let result;
    if (existing) {
      result = await tryWrite(payload, true, existing.id);
    } else {
      result = await tryWrite(payload, false);
    }

    if (result.error) {
      const msg = String(result.error.message || '');
      const missingCol =
        /session_id|batch_id|college_id|department_id|session_code|column/i.test(
          msg
        );
      const uniqueDay =
        /unique|duplicate|uq_trainer_attendance|trainer_id.*attendance_date/i.test(
          msg
        );

      if (missingCol) {
        const legacy = {
          trainer_id: trainer.id,
          attendance_date: dateStr,
          check_in: payload.check_in,
          status: 'Present',
          remarks: payload.remarks
        };
        const { data: dayRow } = await c
          .from('trainer_attendance')
          .select('*')
          .eq('trainer_id', trainer.id)
          .eq('attendance_date', dateStr)
          .maybeSingle();
        if (dayRow && dayRow.status === 'Present') {
          throw new Error(
            'You already marked Present for ' +
              dateStr +
              '. Run the SQL migration (trainer_attendance_session_fix.sql) so presenty is per-session.'
          );
        }
        if (dayRow) {
          result = await c
            .from('trainer_attendance')
            .update(legacy)
            .eq('id', dayRow.id);
        } else {
          result = await c.from('trainer_attendance').insert([legacy]);
        }
      } else if (uniqueDay && sessionId) {
        const { data: dayRow } = await c
          .from('trainer_attendance')
          .select('*')
          .eq('trainer_id', trainer.id)
          .eq('attendance_date', dateStr)
          .is('session_id', null)
          .maybeSingle();
        if (dayRow) {
          result = await c
            .from('trainer_attendance')
            .update(payload)
            .eq('id', dayRow.id);
        } else {
          throw new Error(
            'Cannot mark presenty per session: day-level unique constraint is still active. ' +
              'Run the SQL migration (trainer_attendance_session_fix.sql) in Supabase, then retry.'
          );
        }
      }
    }

    if (result.error) throw result.error;
    return { ok: true, date: dateStr, sessionId: sessionId || null, status: 'Present' };
  }

  /** Ensure / return QR payload string for a batch (SIIT_BATCH:uuid). */
  function batchQrPayload(batch) {
    if (!batch || !batch.attendance_qr_token) return null;
    return 'SIIT_BATCH:' + batch.attendance_qr_token;
  }

  /**
   * Admin: list trainer attendance for a date range.
   * Joins session / batch / college when session_id is present.
   */
  async function adminListTrainerPresenty(filters) {
    const c = client();
    let q = c
      .from('trainer_attendance')
      .select(
        '*, trainers(id, full_name, email, employment_type, trainer_code), attendance_sessions(id, session_code, topic, session_date, start_time, end_time, batch_id, college_id, department_id, batches(batch_name, batch_code), colleges(college_name))'
      )
      .order('attendance_date', { ascending: false })
      .limit(500);
    if (filters && filters.trainerId) q = q.eq('trainer_id', filters.trainerId);
    if (filters && filters.from) q = q.gte('attendance_date', filters.from);
    if (filters && filters.to) q = q.lte('attendance_date', filters.to);
    const { data, error } = await q;
    if (error) {
      // Fallback if join fails (session_id column missing or FK not ready)
      let q2 = c
        .from('trainer_attendance')
        .select('*, trainers(id, full_name, email, employment_type, trainer_code)')
        .order('attendance_date', { ascending: false })
        .limit(500);
      if (filters && filters.trainerId) q2 = q2.eq('trainer_id', filters.trainerId);
      if (filters && filters.from) q2 = q2.gte('attendance_date', filters.from);
      if (filters && filters.to) q2 = q2.lte('attendance_date', filters.to);
      const r2 = await q2;
      if (r2.error) throw r2.error;
      return r2.data || [];
    }
    return data || [];
  }

  function trainerBanner(msg) {
    const main = document.querySelector('.admin-main');
    if (!main || document.getElementById('trainerBanner')) return;
    const div = document.createElement('div');
    div.id = 'trainerBanner';
    div.className = 'alert alert-info d-flex align-items-start gap-2 mb-3';
    div.innerHTML =
      '<i class="fas fa-chalkboard-teacher mt-1"></i><div><strong>Trainer view</strong> — ' +
      SIIT.Utils.escapeHtml(msg || 'Showing only batches / sessions assigned to you.') +
      '</div>';
    main.insertBefore(div, main.firstChild);
  }

  return {
    isTrainer,
    isFreelance,
    resolveTrainer,
    listAssignedBatchIds,
    listAssignedBatches,
    listMySessions,
    markMyPresenty,
    batchQrPayload,
    adminListTrainerPresenty,
    trainerBanner
  };
})();
