/**
 * SIIT Public Student Portal (no login)
 * Roll number → attendance (QR), take quizzes, submit assessments, give feedback.
 */
window.StudentPortal = {

  async findByRoll(rollNo) {
    const client = SIIT.initSupabase();
    if (!client) throw new Error('Service unavailable. Please try again later.');

    const roll = String(rollNo || '').trim();
    if (!roll) throw new Error('Please enter your College Roll Number.');

    const { data: student, error } = await client
      .from('students')
      .select(`
        *,
        colleges(college_name, city),
        departments(department_name),
        courses(course_name),
        batches(batch_name, start_date, end_date, attendance_qr_token, status, course_id, trainer_id)
      `)
      .ilike('college_roll_no', roll)
      .maybeSingle();

    if (error) {
      console.error(error);
      throw new Error('Could not look up your record. Please try again.');
    }
    if (!student) {
      throw new Error('No student found with this Roll Number. Please check and try again.');
    }

    const id = student.id;

    // Load each block independently so one failure does not hide everything
    async function q(fn) {
      try { return await fn(); } catch (e) { console.warn(e); return null; }
    }

    const attendanceSummaryRes = await q(() =>
      client.from('student_attendance_summary')
        .select('*, batches(batch_name), courses(course_name)')
        .eq('student_id', id)
    );
    const recentAttendanceRes = await q(() =>
      client.from('attendance_logs')
        .select('*, attendance_sessions(topic, session_date)')
        .eq('student_id', id)
        .order('attendance_time', { ascending: false })
        .limit(10)
    );
    // Fallback attendance if summary view missing
    let attendanceSummary = (attendanceSummaryRes && !attendanceSummaryRes.error && attendanceSummaryRes.data) || [];
    if (!attendanceSummary.length && student.batch_id) {
      const logsRes = await q(() =>
        client.from('attendance_logs')
          .select('status, session_id')
          .eq('student_id', id)
      );
      const logs = (logsRes && !logsRes.error && logsRes.data) || [];
      if (logs.length) {
        const present = logs.filter(l => l.status === 'Present' || l.status === 'Late').length;
        attendanceSummary = [{
          attendance_percentage: Math.round((present / logs.length) * 100),
          present_count: present,
          total_sessions: logs.length,
          batches: student.batches || null,
          courses: student.courses || null
        }];
      }
    }
    const recentAttendance = (recentAttendanceRes && !recentAttendanceRes.error && recentAttendanceRes.data) || [];

    const quizResultsRes = await q(() =>
      client.from('quiz_results')
        .select('*, quizzes(title)')
        .eq('student_id', id)
        .order('completed_at', { ascending: false })
    );
    const assessmentResultsRes = await q(() =>
      client.from('assessment_results')
        .select('*, assessments(title, assessment_type)')
        .eq('student_id', id)
        .order('evaluated_at', { ascending: false })
    );
    const feedbackRes = await q(() =>
      client.from('student_feedback')
        .select('*, trainers(full_name), courses(course_name)')
        .eq('student_id', id)
        .order('submitted_at', { ascending: false })
    );

    const publishedQuizzes = await q(() => this._listPublishedQuizzes(client, student)) || [];
    const publishedAssessments = await q(() => this._listPublishedAssessments(client, student)) || [];
    const feedbackForms = await q(() => this._listFeedbackForms(client, student)) || [];

    return {
      student,
      attendanceSummary,
      recentAttendance,
      quizResults: (quizResultsRes && !quizResultsRes.error && quizResultsRes.data) || [],
      assessmentResults: (assessmentResultsRes && !assessmentResultsRes.error && assessmentResultsRes.data) || [],
      feedback: (feedbackRes && !feedbackRes.error && feedbackRes.data) || [],
      availableQuizzes: Array.isArray(publishedQuizzes) ? publishedQuizzes : [],
      availableAssessments: Array.isArray(publishedAssessments) ? publishedAssessments : [],
      feedbackForms: Array.isArray(feedbackForms) ? feedbackForms : []
    };
  },

  async _listPublishedQuizzes(client, student) {
    let q = client
      .from('quizzes')
      .select('id, title, duration_minutes, total_marks, passing_marks, course_id, batch_id, status, file_url, description, courses(course_name)')
      .eq('status', 'Published')
      .order('id', { ascending: false })
      .limit(50);
    if (student.course_id) q = q.eq('course_id', student.course_id);
    const { data: quizzes, error } = await q;
    if (error) return [];
    let list = quizzes || [];
    // Prefer same batch when quiz has batch_id
    if (student.batch_id) {
      const byBatch = list.filter(x => !x.batch_id || String(x.batch_id) === String(student.batch_id));
      if (byBatch.length) list = byBatch;
    }
    const { data: results } = await client
      .from('quiz_results')
      .select('quiz_id, percentage, result, obtained_marks, total_marks')
      .eq('student_id', student.id);
    const map = {};
    (results || []).forEach(r => { map[r.quiz_id] = r; });
    return list.map(qz => ({ ...qz, myResult: map[qz.id] || null }));
  },

  async _listPublishedAssessments(client, student) {
    let q = client
      .from('assessments')
      .select('id, title, assessment_type, assessment_date, total_marks, passing_marks, course_id, batch_id, status, description, file_url, courses(course_name)')
      .in('status', ['Published', 'Completed'])
      .order('assessment_date', { ascending: false })
      .limit(50);
    if (student.course_id) q = q.eq('course_id', student.course_id);
    const { data: list, error } = await q;
    if (error) return [];
    let rows = list || [];
    if (student.batch_id) {
      const byBatch = rows.filter(x => !x.batch_id || String(x.batch_id) === String(student.batch_id));
      if (byBatch.length) rows = byBatch;
    }
    const { data: results } = await client
      .from('assessment_results')
      .select('*')
      .eq('student_id', student.id);
    const map = {};
    (results || []).forEach(r => { map[r.assessment_id] = r; });
    return rows.map(a => ({ ...a, myResult: map[a.id] || null }));
  },


  async _listFeedbackForms(client, student) {
    try {
      // Accept Published (case variants) — avoid over-filtering so buttons work
      let { data, error } = await client
        .from('feedback_forms')
        .select('id, title, form_type, batch_id, course_id, description, form_url, fields_json, status')
        .order('id', { ascending: true })
        .limit(100);
      if (error) {
        console.warn('feedback_forms (run supabase/feedback_forms.sql):', error.message || error);
        return [];
      }
      let list = (data || []).filter(f => {
        const st = String(f.status || '').toLowerCase();
        return st === 'published' || st === 'open' || st === 'active';
      });
      // Prefer same batch / global; if none match, still return published forms
      const matched = list.filter(f => {
        if (f.batch_id == null || f.batch_id === '') return true;
        if (student.batch_id && String(f.batch_id) === String(student.batch_id)) return true;
        return false;
      });
      if (matched.length) list = matched;

      const normType = (t) => {
        const s = String(t || '').toLowerCase().trim();
        if (s === 'first' || s === '1' || s === '1st' || s.includes('first') || s.includes('1st')) return 'first';
        if (s === 'second' || s === '2' || s === '2nd' || s.includes('second') || s.includes('2nd')) return 'second';
        return s;
      };
      const byType = {};
      list.forEach(f => {
        const t = normType(f.form_type);
        const row = { ...f, form_type: t };
        const cur = byType[t];
        if (!cur) byType[t] = row;
        else if (f.batch_id && student.batch_id && String(f.batch_id) === String(student.batch_id)) byType[t] = row;
      });
      return Object.values(byType);
    } catch (e) {
      console.warn(e);
      return [];
    }
  },

  async resolveStudentByRoll(rollNo) {
    const client = SIIT.initSupabase();
    const roll = String(rollNo || '').trim();
    if (!roll) throw new Error('Roll number required');
    const { data: student, error } = await client
      .from('students')
      .select('id, full_name, college_roll_no, batch_id, course_id, college_id, status')
      .ilike('college_roll_no', roll)
      .maybeSingle();
    if (error) throw error;
    if (!student) throw new Error('No student found with this Roll Number.');
    if (student.status && String(student.status).toLowerCase() !== 'active') {
      throw new Error('Student profile is not Active.');
    }
    return student;
  },

  /* ---------- Quiz attempt (no login) ---------- */
  async loadQuizQuestions(quizId) {
    const client = SIIT.initSupabase();
    const { data, error } = await client
      .from('quiz_questions')
      .select('*, quiz_options(*)')
      .eq('quiz_id', quizId)
      .order('question_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async submitQuizByRoll(rollNo, quizId, answers) {
    const client = SIIT.initSupabase();
    const student = await this.resolveStudentByRoll(rollNo);

    const { data: quiz, error: qErr } = await client
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    if (qErr || !quiz) throw new Error('Quiz not found');
    if (quiz.status !== 'Published') throw new Error('Quiz is not open');

    const { data: existing } = await client
      .from('quiz_results')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('student_id', student.id)
      .maybeSingle();
    if (existing) throw new Error('You already submitted this quiz.');

    const questions = await this.loadQuizQuestions(quizId);
    let score = 0;
    let total = Number(quiz.total_marks) || 0;
    const answerRows = [];

    if (questions.length) {
      total = questions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
      for (const q of questions) {
        const selectedId = answers && answers[q.id] != null ? Number(answers[q.id]) : null;
        const opts = q.quiz_options || [];
        const correct = opts.find(o => o.is_correct);
        const isCorrect = selectedId && correct && Number(correct.id) === selectedId;
        const marks = isCorrect ? (Number(q.marks) || 1) : 0;
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
    const result = percentage == null ? 'Pending' : (percentage >= passing ? 'Pass' : 'Fail');

    const { data: attempt, error: aErr } = await client
      .from('quiz_attempts')
      .insert([{
        quiz_id: quizId,
        student_id: student.id,
        attempt_number: 1,
        submitted_at: new Date().toISOString(),
        score,
        percentage,
        result,
        status: 'Submitted'
      }])
      .select()
      .single();
    if (aErr) throw aErr;

    if (answerRows.length) {
      await client.from('quiz_answers').insert(
        answerRows.map(a => ({ ...a, attempt_id: attempt.id }))
      );
    }

    await client.from('quiz_results').insert([{
      quiz_id: quizId,
      student_id: student.id,
      best_attempt_id: attempt.id,
      attempts: 1,
      total_marks: total,
      obtained_marks: score,
      percentage,
      result: result === 'Pending' ? null : result,
      completed_at: new Date().toISOString()
    }]);

    return { attempt, score, percentage, result, total };
  },

  /* ---------- Assessment submit (no login) ---------- */
  async submitAssessmentByRoll(rollNo, assessmentId, opts) {
    const client = SIIT.initSupabase();
    const student = await this.resolveStudentByRoll(rollNo);
    opts = opts || {};

    const { data: assessment, error: aErr } = await client
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single();
    if (aErr || !assessment) throw new Error('Assessment not found');
    if (!['Published', 'Completed'].includes(assessment.status)) {
      throw new Error('Assessment is not open for submission');
    }

    const { data: existing } = await client
      .from('assessment_results')
      .select('id, result')
      .eq('assessment_id', assessmentId)
      .eq('student_id', student.id)
      .maybeSingle();
    if (existing) throw new Error('You already submitted this assessment (' + (existing.result || 'Pending') + ')');

    let remarks = opts.remarks || 'Submitted via Student Portal';
    if (opts.file) {
      try {
        const path = `assessment-submissions/${student.id}/${assessmentId}_${Date.now()}_${opts.file.name}`;
        const { error: upErr } = await client.storage.from('certificates').upload(path, opts.file, { upsert: true });
        if (!upErr) {
          const { data: pub } = client.storage.from('certificates').getPublicUrl(path);
          if (pub?.publicUrl) remarks += '\nSubmission file: ' + pub.publicUrl;
        }
      } catch (e) {
        console.warn('Assessment file upload failed', e);
      }
    }

    const { data, error } = await client
      .from('assessment_results')
      .insert([{
        assessment_id: assessmentId,
        student_id: student.id,
        total_marks: assessment.total_marks || null,
        obtained_marks: null,
        percentage: null,
        result: 'Pending',
        remarks,
        evaluated_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /* ---------- Feedback (no login) ---------- */
  async listTrainersForStudent(student) {
    const client = SIIT.initSupabase();
    // Prefer trainers linked to student's batch
    if (student.batch_id) {
      const { data: bt } = await client
        .from('batch_trainers')
        .select('trainer_id, trainers(id, full_name)')
        .eq('batch_id', student.batch_id);
      if (bt && bt.length) {
        return bt.map(x => x.trainers).filter(Boolean);
      }
    }
    const { data } = await client.from('trainers').select('id, full_name').eq('status', true).order('full_name').limit(100);
    return data || [];
  },

  async submitFeedbackByRoll(rollNo, payload) {
    const client = SIIT.initSupabase();
    const student = await this.resolveStudentByRoll(rollNo);
    const formId = payload.form_id ? Number(payload.form_id) : null;
    const formType = payload.form_type || null;

    // Prevent duplicate for same form
    if (formId) {
      const { data: existing } = await client
        .from('student_feedback')
        .select('id')
        .eq('student_id', student.id)
        .eq('form_id', formId)
        .maybeSingle();
      if (existing) throw new Error('You already submitted this feedback form.');
    }

    const row = {
      student_id: student.id,
      trainer_id: payload.trainer_id ? Number(payload.trainer_id) : null,
      course_id: payload.course_id ? Number(payload.course_id) : (student.course_id || null),
      batch_id: student.batch_id || null,
      form_id: formId,
      form_type: formType,
      rating: payload.rating != null && payload.rating !== '' ? Number(payload.rating) : null,
      teaching_quality: payload.teaching_quality != null && payload.teaching_quality !== '' ? Number(payload.teaching_quality) : null,
      communication: payload.communication != null && payload.communication !== '' ? Number(payload.communication) : null,
      practical_knowledge: payload.practical_knowledge != null && payload.practical_knowledge !== '' ? Number(payload.practical_knowledge) : null,
      overall_experience: payload.overall_experience != null && payload.overall_experience !== '' ? Number(payload.overall_experience) : null,
      comments: payload.comments || null,
      answers_json: payload.answers_json || {},
      submitted_at: new Date().toISOString()
    };
    if (!row.rating) throw new Error('Please select overall rating (1–5)');
    const { data, error } = await client.from('student_feedback').insert([row]).select().single();
    if (error) throw error;
    return data;
  },

  /* ---------- Attendance QR (no login) ---------- */
  async markAttendanceByRoll(rollNo, rawPayload) {
    const client = SIIT.initSupabase();
    if (!client) throw new Error('Service unavailable. Please try again later.');

    const roll = String(rollNo || '').trim();
    if (!roll) throw new Error('Please enter your College Roll Number first.');

    let token = String(rawPayload || '').trim();
    if (token.startsWith('SIIT_BATCH:')) token = token.slice('SIIT_BATCH:'.length).trim();
    const m = token.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (m) token = m[0];
    if (!token) throw new Error('Invalid QR code');

    const student = await this.resolveStudentByRoll(roll);
    if (!student.batch_id) throw new Error('No batch assigned to this student. Contact admin.');

    const { data: batch, error: bErr } = await client
      .from('batches')
      .select('id, batch_name, batch_code, course_id, trainer_id, status, attendance_qr_token')
      .eq('attendance_qr_token', token)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!batch) throw new Error('Unknown or invalid attendance QR');
    if (String(batch.id) !== String(student.batch_id)) {
      throw new Error('This QR is for another batch. You can only mark for your own batch.');
    }
    if (batch.status && !['Active', 'Upcoming'].includes(batch.status)) {
      throw new Error('Batch is not active for attendance');
    }

    const today = new Date();
    const sessionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let { data: session } = await client
      .from('attendance_sessions')
      .select('*')
      .eq('batch_id', batch.id)
      .eq('session_date', sessionDate)
      .maybeSingle();

    if (!session) {
      let trainerId = batch.trainer_id || null;
      if (!trainerId) {
        const { data: bt } = await client
          .from('batch_trainers')
          .select('trainer_id')
          .eq('batch_id', batch.id)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bt?.trainer_id) trainerId = bt.trainer_id;
      }
      if (!trainerId) throw new Error('No trainer linked to this batch. Admin must assign a trainer.');

      const sessionCode = `BAT-${batch.id}-${sessionDate.replace(/-/g, '')}`;
      const insertPayload = {
        session_code: sessionCode,
        batch_id: batch.id,
        course_id: batch.course_id,
        trainer_id: trainerId,
        topic: 'Daily attendance',
        session_date: sessionDate,
        start_time: new Date(`${sessionDate}T00:00:00`).toISOString(),
        end_time: new Date(`${sessionDate}T23:59:59`).toISOString(),
        attendance_mode: 'QR',
        status: 'Running',
        remarks: 'Auto-created from batch QR (roll-number mark)'
      };
      const { data: created, error: cErr } = await client
        .from('attendance_sessions')
        .insert([insertPayload])
        .select()
        .single();
      if (cErr) {
        if (/duplicate|unique|session_code/i.test(cErr.message || '')) {
          const { data: again } = await client
            .from('attendance_sessions')
            .select('*')
            .eq('batch_id', batch.id)
            .eq('session_date', sessionDate)
            .maybeSingle();
          if (again) session = again;
          else throw cErr;
        } else throw cErr;
      } else session = created;
    } else if (!['Running', 'Scheduled'].includes(session.status)) {
      await client.from('attendance_sessions').update({ status: 'Running' }).eq('id', session.id);
      session.status = 'Running';
    }

    const { data: existing } = await client
      .from('attendance_logs')
      .select('id, status')
      .eq('session_id', session.id)
      .eq('student_id', student.id)
      .maybeSingle();
    if (existing) {
      throw new Error('Already marked ' + existing.status + ' for today (' + (student.full_name || roll) + ')');
    }

    const { data: log, error: lErr } = await client
      .from('attendance_logs')
      .insert([{
        session_id: session.id,
        student_id: student.id,
        attendance_type: 'QR',
        status: 'Present',
        attendance_time: new Date().toISOString()
      }])
      .select()
      .single();
    if (lErr) throw lErr;

    return {
      log, session, batch, student,
      message: 'Present marked for ' + (student.full_name || roll) + ' · ' + (batch.batch_name || 'batch') + ' · ' + sessionDate
    };
  }
};
