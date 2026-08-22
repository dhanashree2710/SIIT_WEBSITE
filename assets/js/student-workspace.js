/**
 * SIIT Student Workspace
 * When a logged-in user has role "Student", admin pages switch from
 * CRUD management to student actions:
 *   - Take published quizzes
 *   - Mark attendance on running sessions
 *   - View assessment results
 *   - Download issued certificates
 *
 * Links user → student by email (users.email ≈ students.email).
 */
window.StudentWorkspace = (function () {
  let cachedStudent = null;

  function client() {
    return SIIT.initSupabase();
  }

  function session() {
    return SIIT.Session.get();
  }

  function isStudent() {
    const s = session();
    return s && s.role_name === 'Student';
  }

  /** Resolve the students row for the logged-in user (by email, then full_name). */
  async function resolveStudent(force) {
    if (cachedStudent && !force) return cachedStudent;
    const s = session();
    if (!s) throw new Error('Not logged in');
    const c = client();
    if (!c) throw new Error('Service unavailable');

    let row = null;
    if (s.email) {
      const { data } = await c
        .from('students')
        .select('*, colleges(college_name), courses(course_name), batches(batch_name)')
        .ilike('email', s.email.trim())
        .maybeSingle();
      row = data;
    }
    if (!row && s.full_name) {
      const { data } = await c
        .from('students')
        .select('*, colleges(college_name), courses(course_name), batches(batch_name)')
        .ilike('full_name', s.full_name.trim())
        .limit(1)
        .maybeSingle();
      row = data;
    }
    if (!row) {
      throw new Error(
        'No student profile linked to this login. Ask admin to set students.email = your login email.'
      );
    }
    cachedStudent = row;
    return row;
  }

  /* ------------------------------------------------------------------ */
  /*  Quizzes                                                            */
  /* ------------------------------------------------------------------ */
  async function listMyQuizzes() {
    const student = await resolveStudent();
    const c = client();
    // Only published quizzes for this student's batch (or course if no batch on quiz)
    let q = c
      .from('quizzes')
      .select('*, courses(course_name), trainers(full_name), batches(batch_name)')
      .eq('status', 'Published')
      .order('id', { ascending: false });
    const { data: allQuizzes, error } = await q;
    if (error) throw error;

    const quizzes = (allQuizzes || []).filter((qz) => {
      // Prefer batch match
      if (student.batch_id && qz.batch_id) {
        return String(qz.batch_id) === String(student.batch_id);
      }
      // Quiz has no batch → fall back to course
      if (!qz.batch_id && student.course_id && qz.course_id) {
        return String(qz.course_id) === String(student.course_id);
      }
      // Student has batch, quiz has no batch but same course
      if (student.batch_id && !qz.batch_id && student.course_id && qz.course_id) {
        return String(qz.course_id) === String(student.course_id);
      }
      return false;
    });

    const { data: results } = await c
      .from('quiz_results')
      .select('*')
      .eq('student_id', student.id);
    const resultMap = {};
    (results || []).forEach((r) => {
      resultMap[r.quiz_id] = r;
    });

    const { data: attempts } = await c
      .from('quiz_attempts')
      .select('quiz_id, status, score, percentage, result, submitted_at')
      .eq('student_id', student.id)
      .order('id', { ascending: false });
    const attemptMap = {};
    (attempts || []).forEach((a) => {
      if (!attemptMap[a.quiz_id]) attemptMap[a.quiz_id] = a;
    });

    return quizzes.map((qz) => ({
      ...qz,
      myResult: resultMap[qz.id] || null,
      myAttempt: attemptMap[qz.id] || null
    }));
  }

  async function loadQuizQuestions(quizId) {
    const c = client();
    const { data: questions, error } = await c
      .from('quiz_questions')
      .select('*, quiz_options(*)')
      .eq('quiz_id', quizId)
      .order('question_order', { ascending: true });
    if (error) throw error;
    return questions || [];
  }

  /**
   * Start / submit a quiz attempt.
   * If questions exist: scores MCQ automatically.
   * If no questions: records a manual attempt (admin graded later) with score null.
   */
  async function submitQuizAttempt(quizId, answers) {
    const student = await resolveStudent();
    const c = client();

    const { data: quiz, error: qErr } = await c
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    if (qErr || !quiz) throw new Error('Quiz not found');
    if (quiz.status !== 'Published') throw new Error('Quiz is not open');

    const questions = await loadQuizQuestions(quizId);
    let score = 0;
    let total = Number(quiz.total_marks) || 0;
    const answerRows = [];

    if (questions.length) {
      total = questions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
      for (const q of questions) {
        const selectedId = answers && answers[q.id] != null ? Number(answers[q.id]) : null;
        const opts = q.quiz_options || [];
        const correct = opts.find((o) => o.is_correct);
        const isCorrect = selectedId && correct && Number(correct.id) === selectedId;
        const marks = isCorrect ? Number(q.marks) || 1 : 0;
        score += marks;
        answerRows.push({
          question_id: q.id,
          selected_option_id: selectedId,
          is_correct: !!isCorrect,
          marks_awarded: marks
        });
      }
    }

    const percentage = total > 0 ? Math.round((score / total) * 10000) / 100 : null;
    const passing = Number(quiz.passing_marks) || 40;
    const result =
      percentage == null ? 'Pending' : percentage >= passing ? 'Pass' : 'Fail';

    const { data: attempt, error: aErr } = await c
      .from('quiz_attempts')
      .insert([
        {
          quiz_id: quizId,
          student_id: student.id,
          attempt_number: 1,
          submitted_at: new Date().toISOString(),
          score,
          percentage,
          result,
          status: 'Submitted'
        }
      ])
      .select()
      .single();
    if (aErr) throw aErr;

    if (answerRows.length) {
      await c.from('quiz_answers').insert(
        answerRows.map((a) => ({ ...a, attempt_id: attempt.id }))
      );
    }

    // Upsert quiz_results
    const { data: existing } = await c
      .from('quiz_results')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('student_id', student.id)
      .maybeSingle();

    const resultPayload = {
      quiz_id: quizId,
      student_id: student.id,
      best_attempt_id: attempt.id,
      attempts: 1,
      total_marks: total,
      obtained_marks: score,
      percentage,
      result: result === 'Pending' ? null : result,
      completed_at: new Date().toISOString()
    };

    if (existing) {
      await c.from('quiz_results').update(resultPayload).eq('id', existing.id);
    } else {
      await c.from('quiz_results').insert([resultPayload]);
    }

    return { attempt, score, percentage, result, total };
  }

  /* ------------------------------------------------------------------ */
  /*  Attendance                                                         */
  /* ------------------------------------------------------------------ */
  async function listMySessions() {
    const student = await resolveStudent();
    const c = client();

    // Batch-wise only — student must be assigned to a batch
    if (!student.batch_id) {
      throw new Error('No batch assigned to your student profile. Contact admin to assign you to a batch.');
    }

    const { data: batch } = await c
      .from('batches')
      .select('id, batch_name, batch_code, start_date, end_date, course_id')
      .eq('id', student.batch_id)
      .maybeSingle();

    const { data: sessions, error } = await c
      .from('attendance_sessions')
      .select('*, batches(batch_name, start_date, end_date), courses(course_name), trainers(full_name)')
      .eq('batch_id', student.batch_id)
      .in('status', ['Scheduled', 'Running', 'Completed'])
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(300);
    if (error) throw error;

    const { data: logs } = await c
      .from('attendance_logs')
      .select('session_id, status, attendance_time')
      .eq('student_id', student.id);
    const logMap = {};
    (logs || []).forEach((l) => { logMap[l.session_id] = l; });

    const mapped = (sessions || []).map((s) => ({
      ...s,
      myLog: logMap[s.id] || null,
      batchInfo: batch || null
    }));
    const present = mapped.filter((s) => s.myLog && s.myLog.status === 'Present').length;
    const total = mapped.length;
    mapped.summary = {
      batchName: batch?.batch_name || ('Batch #' + student.batch_id),
      durationMonths: null, // optional column — not all DBs have duration_months
      startDate: batch?.start_date || null,
      endDate: batch?.end_date || null,
      present,
      total,
      percentage: total ? Math.round((present / total) * 1000) / 10 : 0
    };
    return mapped;
  }


  /** Group sessions by session_date (YYYY-MM-DD) for day-wise UI */
  function groupSessionsByDay(sessions) {
    const map = {};
    (sessions || []).forEach((s) => {
      const d = (s.session_date || '').toString().slice(0, 10) || 'unknown';
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });
    return Object.keys(map).sort().map((date) => ({
      date,
      sessions: map[date],
      present: map[date].filter((x) => x.myLog && x.myLog.status === 'Present').length,
      total: map[date].length
    }));
  }

  async function markAttendance(sessionId, opts = {}) {
    const student = await resolveStudent();
    const c = client();

    const { data: session, error: sErr } = await c
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (sErr || !session) throw new Error('Session not found');
    if (!['Running', 'Scheduled'].includes(session.status)) {
      throw new Error('Attendance is only open for Running / Scheduled sessions');
    }
    // Enforce batch-wise: session must belong to student batch
    if (student.batch_id && String(session.batch_id) !== String(student.batch_id)) {
      throw new Error('This session is for another batch. You can only mark attendance for your own batch.');
    }

    const { data: existing } = await c
      .from('attendance_logs')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('student_id', student.id)
      .maybeSingle();
    if (existing) {
      throw new Error('You already marked attendance for this session (' + existing.status + ')');
    }

    const { data, error } = await c
      .from('attendance_logs')
      .insert([
        {
          session_id: sessionId,
          student_id: student.id,
          attendance_type: opts.attendance_type || 'Manual',
          status: 'Present',
          attendance_time: new Date().toISOString()
        }
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Mark attendance by scanning trainer batch QR.
   * Payload formats:
   *   SIIT_BATCH:<uuid>
   *   SIIT_BATCH:<uuid>:DEPT:<deptId>
   *   SIIT_SESSION:<sessionId>:BATCH:<uuid>
   */
  /**
   * Mark attendance by QR. Optional rollNo must match the logged-in student's roll
   * (or, if provided without login match, resolve student by roll for kiosk mode).
   */
  async function markAttendanceByQr(payload, rollNo) {
    const raw = String(payload || '').trim();
    if (!raw) throw new Error('Empty QR code');

    let student = null;
    const c = client();
    const today = new Date().toISOString().slice(0, 10);

    // Prefer logged-in student; verify roll if given
    if (isStudent()) {
      student = await resolveStudent();
      if (rollNo) {
        const entered = String(rollNo).trim().toLowerCase();
        const mine = String(student.college_roll_no || '').trim().toLowerCase();
        if (!mine || entered !== mine) {
          throw new Error('Roll number does not match your profile. Enter your college roll no.');
        }
      }
    } else if (rollNo) {
      // Kiosk / shared device: identify by roll number
      const { data: byRoll, error: rErr } = await c
        .from('students')
        .select('*, colleges(college_name), courses(course_name), batches(batch_name)')
        .ilike('college_roll_no', String(rollNo).trim())
        .maybeSingle();
      if (rErr) throw rErr;
      if (!byRoll) throw new Error('No student found with roll no: ' + rollNo);
      student = byRoll;
      cachedStudent = byRoll;
    } else {
      student = await resolveStudent();
    }

    // --- Session QR ---
    if (raw.startsWith('SIIT_SESSION:')) {
      const parts = raw.split(':');
      const sessionId = Number(parts[1]);
      if (!sessionId) throw new Error('Invalid session QR');
      return markAttendance(sessionId, { attendance_type: 'QR' });
    }

    // --- Batch QR ---
    if (!raw.startsWith('SIIT_BATCH:')) {
      throw new Error('Not a valid SIIT attendance QR');
    }

    const parts = raw.split(':');
    const token = parts[1];
    if (!token) throw new Error('Invalid batch QR (missing token)');

    const { data: batch, error: bErr } = await c
      .from('batches')
      .select('id, batch_name, batch_code, attendance_qr_token, status')
      .eq('attendance_qr_token', token)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!batch) throw new Error('Unknown QR — batch not found. Ask trainer to refresh QR.');

    if (student.batch_id && String(student.batch_id) !== String(batch.id)) {
      throw new Error(
        'This QR is for another batch (' +
          (batch.batch_name || batch.batch_code || batch.id) +
          '). Your batch does not match.'
      );
    }
    if (!student.batch_id) {
      throw new Error('No batch assigned on your profile. Contact admin.');
    }

    const { data: sessions, error: sErr } = await c
      .from('attendance_sessions')
      .select('id, session_date, status, topic, start_time, end_time')
      .eq('batch_id', batch.id)
      .eq('session_date', today)
      .in('status', ['Running', 'Scheduled'])
      .order('start_time', { ascending: true });
    if (sErr) throw sErr;

    let session = null;
    if (sessions && sessions.length) {
      session = sessions.find((s) => s.status === 'Running') || sessions[0];
    }

    if (!session) {
      const { data: anyOpen } = await c
        .from('attendance_sessions')
        .select('id, session_date, status, topic, start_time')
        .eq('batch_id', batch.id)
        .in('status', ['Running', 'Scheduled'])
        .order('session_date', { ascending: false })
        .limit(5);
      session = (anyOpen || []).find((s) => s.status === 'Running') || (anyOpen || [])[0] || null;
    }

    if (!session) {
      throw new Error(
        'No open session found for batch "' +
          (batch.batch_name || batch.batch_code) +
          '". Trainer must create / start a session first.'
      );
    }

    const log = await markAttendance(session.id, { attendance_type: 'QR' });
    return {
      log,
      session,
      batch,
      message:
        'Present marked for ' +
        (batch.batch_name || batch.batch_code) +
        (session.topic ? ' · ' + session.topic : '')
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Assessments                                                        */
  /* ------------------------------------------------------------------ */
  async function listMyAssessments() {
    const student = await resolveStudent();
    const c = client();
    const { data: list, error } = await c
      .from('assessments')
      .select('*, courses(course_name), trainers(full_name), batches(batch_name)')
      .in('status', ['Published', 'Completed'])
      .order('assessment_date', { ascending: false });
    if (error) throw error;

    const filtered = (list || []).filter((a) => {
      if (student.batch_id && a.batch_id) {
        return String(a.batch_id) === String(student.batch_id);
      }
      if (!a.batch_id && student.course_id && a.course_id) {
        return String(a.course_id) === String(student.course_id);
      }
      if (student.batch_id && !a.batch_id && student.course_id && a.course_id) {
        return String(a.course_id) === String(student.course_id);
      }
      return false;
    });

    const { data: results } = await c
      .from('assessment_results')
      .select('*')
      .eq('student_id', student.id);
    const map = {};
    (results || []).forEach((r) => {
      map[r.assessment_id] = r;
    });

    return filtered.map((a) => ({ ...a, myResult: map[a.id] || null }));
  }

  /* ------------------------------------------------------------------ */
  /*  Certificates                                                       */
  /* ------------------------------------------------------------------ */
  async function listMyCertificates() {
    const student = await resolveStudent();
    const c = client();
    const { data, error } = await c
      .from('certificates')
      .select('*, courses(course_name)')
      .eq('student_id', student.id)
      .order('issue_date', { ascending: false });
    if (error) throw error;

    let st = [];
    try {
      const { data: stData } = await c
        .from('short_term_certificates')
        .select('*')
        .eq('student_id', student.id)
        .order('issue_date', { ascending: false });
      st = stData || [];
    } catch (_) {}

    return { certificates: data || [], shortTerm: st };
  }

  async function logCertificateDownload(certificateId) {
    try {
      const c = client();
      await c.from('certificate_logs').insert([
        {
          certificate_id: certificateId,
          action: 'Downloaded',
          action_at: new Date().toISOString()
        }
      ]);
    } catch (_) {}
  }

  /* ------------------------------------------------------------------ */
  /*  UI helpers — replace admin CRUD table with student view            */
  /* ------------------------------------------------------------------ */
  function hideAdminChrome() {
    document.querySelectorAll(
      '[onclick^="openForm"], button[onclick*="openForm"], #searchInput'
    ).forEach((el) => {
      if (el.id === 'searchInput') return;
      el.style.display = 'none';
    });
    // Hide primary Add buttons more reliably
    document.querySelectorAll('.btn-primary').forEach((btn) => {
      if (/add/i.test(btn.textContent || '')) btn.style.display = 'none';
    });
  }

  function studentBanner(text) {
    const main = document.querySelector('.admin-main');
    if (!main || document.getElementById('studentModeBanner')) return;
    const div = document.createElement('div');
    div.id = 'studentModeBanner';
    div.className = 'alert alert-info border-0 shadow-sm mb-3';
    div.innerHTML =
      '<i class="fas fa-user-graduate me-2"></i><strong>Student mode</strong> — ' +
      SIIT.Utils.escapeHtml(text);
    main.insertBefore(div, main.firstChild);
  }


  /* ===================== TASKS ===================== */
  async function listMyTasks() {
    const st = await resolveStudent();
    const client = SIIT.initSupabase();
    let q = client.from('tasks').select('*, courses(course_name), batches(batch_name)').eq('status', 'Published').order('due_date', { ascending: true });
    const { data: tasks, error } = await q;
    if (error) throw error;
    let list = tasks || [];
    // Prefer same course / batch when student has them
    if (st.course_id) {
      const byCourse = list.filter(t => String(t.course_id) === String(st.course_id));
      if (byCourse.length) list = byCourse;
    }
    if (st.batch_id) {
      const byBatch = list.filter(t => !t.batch_id || String(t.batch_id) === String(st.batch_id));
      if (byBatch.length) list = byBatch;
    }
    // Attach submission
    const { data: subs } = await client.from('task_submissions').select('*').eq('student_id', st.id);
    const byTask = {};
    (subs || []).forEach(s => { byTask[s.task_id] = s; });
    return list.map(t => ({ ...t, submission: byTask[t.id] || null }));
  }

  /**
   * Create or update task submission.
   * status: 'Pending' | 'In Progress' | 'Completed'
   */
  async function submitTask(taskId, opts = {}) {
    const st = await resolveStudent();
    const client = SIIT.initSupabase();
    const statusMap = {
      'Pending': 'Draft',
      'In Progress': 'Draft',
      'Completed': 'Submitted',
      'Draft': 'Draft',
      'Submitted': 'Submitted',
      'Late': 'Late'
    };
    const uiStatus = opts.status || 'Submitted';
    const submission_status = statusMap[uiStatus] || 'Submitted';
    const remarks = [opts.remarks || '', uiStatus !== submission_status ? ('[' + uiStatus + ']') : ''].filter(Boolean).join(' ').trim() || null;

    let fileUrl = opts.fileUrl || null;
    if (opts.file) {
      const path = `submissions/${st.id}/${taskId}_${Date.now()}_${opts.file.name}`;
      const { error: upErr } = await client.storage.from('tasks').upload(path, opts.file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = client.storage.from('tasks').getPublicUrl(path);
      fileUrl = pub?.publicUrl || path;
    }

    const { data: existing } = await client.from('task_submissions')
      .select('id').eq('task_id', taskId).eq('student_id', st.id).maybeSingle();

    const payload = {
      task_id: taskId,
      student_id: st.id,
      submission_status,
      remarks,
      submitted_at: new Date().toISOString()
    };
    if (fileUrl) payload.submission_file = fileUrl;

    if (existing) {
      const { data, error } = await client.from('task_submissions').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await client.from('task_submissions').insert([payload]).select().single();
    if (error) throw error;
    return data;
  }


  return {
    isStudent,
    resolveStudent,
    listMyQuizzes,
    loadQuizQuestions,
    submitQuizAttempt,
    listMySessions,
    groupSessionsByDay,
    markAttendance,
    markAttendanceByQr,
    listMyAssessments,
    listMyCertificates,
    listMyTasks,
    submitTask,
    logCertificateDownload,
    hideAdminChrome,
    studentBanner
  };
})();
