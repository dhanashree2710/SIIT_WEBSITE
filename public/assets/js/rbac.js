/**
 * SIIT ERP — Role Based Access Control
 * Include AFTER supabase-config.js on every /admin/*.html except login.html
 * Call RBAC.enforce() at the top of each page's script.
 *
 * Trainer (Full-Time): assigned data only · cannot create/edit/delete attendance sessions
 * Freelancer: dashboard + attendance + batches (view) only · timetable + student QR only
 */
window.RBAC = (function () {

  const FULL_ACCESS_ROLES = ['Super Admin', 'Institute Admin', 'Accounts', 'Placement Officer'];

  const ROLE_ACCESS = {
    'College Coordinator': {
      pages: ['dashboard.html', 'attendance.html', 'quizzes.html', 'assessments.html', 'feedback-forms.html', 'batches.html', 'students.html', 'certificates.html'],
      readonlyPages: 'ALL',
      landing: 'dashboard.html'
    },
    // Full-Time trainer — no student/admin CRUD; attendance is view + QR only
    'Trainer': {
      pages: ['dashboard.html', 'attendance.html', 'quizzes.html', 'assessments.html', 'feedback-forms.html', 'batches.html', 'tasks.html'],
      readonlyPages: ['batches.html', 'attendance.html'],
      landing: 'dashboard.html'
    },
    // Freelancer — minimal menu: home, timetable/QR, assigned batches
    'TrainerFreelancer': {
      pages: ['dashboard.html', 'attendance.html', 'batches.html'],
      readonlyPages: ['batches.html', 'attendance.html'],
      landing: 'dashboard.html'
    },
    'Student': {
      pages: [
        'dashboard.html', 'attendance.html', 'quizzes.html', 'assessments.html',
        'tasks.html', 'fees.html', 'certificates.html'
      ],
      readonlyPages: ['fees.html'],
      landing: 'dashboard.html'
    },
    'Reception': {
      pages: ['dashboard.html', 'students.html', 'enquiries.html', 'fees.html'],
      readonlyPages: ['fees.html'],
      landing: 'dashboard.html'
    }
  };

  const DEFAULT_RESTRICTED = {
    pages: ['dashboard.html'],
    readonlyPages: 'ALL',
    landing: 'dashboard.html'
  };

  function currentPage() {
    return location.pathname.split('/').pop() || 'dashboard.html';
  }

  function isFullAccess(role) {
    return FULL_ACCESS_ROLES.includes(role);
  }

  function configFor(role) {
    return ROLE_ACCESS[role] || DEFAULT_RESTRICTED;
  }

  function injectReadOnlyStyle() {
    if (document.getElementById('rbacReadonlyStyle')) return;
    const style = document.createElement('style');
    style.id = 'rbacReadonlyStyle';
    style.textContent = `
      body.rbac-readonly [onclick^="openForm("],
      body.rbac-readonly [onclick^="deleteRow("],
      body.rbac-readonly [onclick^="openForm()"],
      body.rbac-readonly [onclick^="viewBatchDetails("],
      body.rbac-readonly #btnGenerate,
      body.rbac-readonly #btnAddSession,
      body.rbac-readonly #sessionForm,
      body.rbac-readonly .admin-crud-actions { display: none !important; }
      body.rbac-readonly .admin-main::before {
        content: "View only — your role does not have edit access to this page.";
        display: block; background: #fff3cd; color: #664d03; border: 1px solid #ffe69c;
        border-radius: 10px; padding: .6rem 1rem; margin-bottom: 1rem; font-size: .85rem; font-weight: 500;
      }
      body.rbac-readonly.rbac-student .admin-main::before {
        content: "Your fees (view only). Contact the office if something looks incorrect.";
        background: #e7f1ff; color: #084298; border-color: #b6d4fe;
      }
      body.rbac-readonly.rbac-trainer-batches .admin-main::before {
        content: "Assigned batches only — view & student attendance QR. No edit or delete.";
        background: #e7f1ff; color: #084298; border-color: #b6d4fe;
      }
      body.rbac-readonly.rbac-trainer-attendance .admin-main::before {
        content: "Assigned sessions only — view timetable & show QR to students. You cannot create or edit sessions.";
        background: #e7f1ff; color: #084298; border-color: #b6d4fe;
      }
    `;
    document.head.appendChild(style);
  }

  function filterSidebar(allowedPages) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('a.nav-link').forEach(a => {
      const href = a.getAttribute('href');
      if (!allowedPages.includes(href)) a.style.display = 'none';
    });
    sidebar.querySelectorAll('.nav-section').forEach(section => {
      const visible = [...section.querySelectorAll('a.nav-link')].some(a => a.style.display !== 'none');
      section.style.display = visible ? '' : 'none';
    });
  }

  function showRoleBadge(role) {
    const nameEl = document.getElementById('userName');
    if (!nameEl || document.getElementById('roleBadge')) return;
    const badge = document.createElement('span');
    badge.id = 'roleBadge';
    badge.className = 'badge bg-primary-subtle text-primary ms-2';
    badge.textContent = role;
    nameEl.insertAdjacentElement('afterend', badge);
  }

  function showDeniedToastIfAny() {
    const msg = sessionStorage.getItem('rbac_denied');
    if (msg) {
      sessionStorage.removeItem('rbac_denied');
      setTimeout(() => SIIT.Utils.toast(msg, 'error'), 200);
    }
  }

  function blockAttendanceEdits() {
    window.openForm = function () {
      SIIT.Utils.toast('Trainers cannot create or edit sessions. Contact admin.', 'error');
    };
    window.deleteRow = function () {
      SIIT.Utils.toast('Trainers cannot delete sessions.', 'error');
    };
    window.deleteSession = function () {
      SIIT.Utils.toast('Trainers cannot delete sessions.', 'error');
    };
  }

  function enforce() {
    const session = SIIT.Session.get();
    if (!session) return;

    const role = session.role_name || '';
    const page = currentPage();

    showRoleBadge(role || 'User');

    if (page === 'users.html' && !['Super Admin', 'Institute Admin'].includes(role)) {
      sessionStorage.setItem('rbac_denied', 'Only Super Admin or Institute Admin can manage users.');
      window.location.href = 'dashboard.html';
      return;
    }

    if (isFullAccess(role)) {
      showDeniedToastIfAny();
      if (!['Super Admin', 'Institute Admin'].includes(role)) {
        const sidebar = document.getElementById('sidebar');
        sidebar?.querySelectorAll('a.nav-link').forEach(a => {
          if ((a.getAttribute('href') || '') === 'users.html') a.style.display = 'none';
        });
      }
      return;
    }

    const cfg = configFor(role);

    if (!cfg.pages.includes(page)) {
      sessionStorage.setItem('rbac_denied', 'Your role (' + role + ') does not have access to that page.');
      window.location.href = cfg.landing;
      return;
    }

    filterSidebar(cfg.pages);

    const isReadonly = cfg.readonlyPages === 'ALL' ||
      (Array.isArray(cfg.readonlyPages) && cfg.readonlyPages.includes(page));
    if (isReadonly) {
      injectReadOnlyStyle();
      document.body.classList.add('rbac-readonly');
      if (role === 'Student') document.body.classList.add('rbac-student');
      if (role === 'Trainer' && page === 'batches.html') {
        document.body.classList.add('rbac-trainer-batches');
      }
      if (role === 'Trainer' && page === 'attendance.html') {
        document.body.classList.add('rbac-trainer-attendance');
        blockAttendanceEdits();
      }
      window.openForm = function () {
        SIIT.Utils.toast(role === 'Student' ? 'Students can only view this page.' : 'Your role has view-only access here.', 'error');
      };
      window.deleteRow = function () {
        SIIT.Utils.toast(role === 'Student' ? 'Students can only view this page.' : 'Your role has view-only access here.', 'error');
      };
      if (page === 'batches.html') {
        window.viewBatchDetails = function () {
          SIIT.Utils.toast('Trainers cannot open batch quiz / assessment / feedback details.', 'error');
        };
      }
    }

    showDeniedToastIfAny();

    if (role === 'Trainer') {
      enforceTrainerType(page);
    }
  }

  async function enforceTrainerType(page) {
    try {
      if (typeof TrainerWorkspace === 'undefined' || !TrainerWorkspace.isTrainer()) return;
      const trainer = await TrainerWorkspace.resolveTrainer();
      const freelance = TrainerWorkspace.isFreelance(trainer);

      if (!freelance) {
        // Full-time trainer
        if (page === 'batches.html') {
          injectReadOnlyStyle();
          document.body.classList.add('rbac-readonly', 'rbac-trainer-batches');
          window.openForm = function () { SIIT.Utils.toast('Trainers can only view assigned batches.', 'error'); };
          window.deleteRow = function () { SIIT.Utils.toast('Trainers can only view assigned batches.', 'error'); };
          window.viewBatchDetails = function () {
            SIIT.Utils.toast('Trainers cannot open batch quiz / assessment / feedback details.', 'error');
          };
        }
        if (page === 'attendance.html') {
          injectReadOnlyStyle();
          document.body.classList.add('rbac-readonly', 'rbac-trainer-attendance');
          blockAttendanceEdits();
        }
        filterSidebar(ROLE_ACCESS['Trainer'].pages);
        return;
      }

      // Freelancer — strict menu
      const cfg = ROLE_ACCESS['TrainerFreelancer'];
      if (!cfg.pages.includes(page)) {
        sessionStorage.setItem(
          'rbac_denied',
          'Freelancer trainers can only open Dashboard, Attendance (timetable + QR), and assigned Batches.'
        );
        window.location.href = cfg.landing;
        return;
      }
      filterSidebar(cfg.pages);

      const isReadonly = cfg.readonlyPages === 'ALL' ||
        (Array.isArray(cfg.readonlyPages) && cfg.readonlyPages.includes(page));
      if (isReadonly) {
        injectReadOnlyStyle();
        document.body.classList.add('rbac-readonly', 'rbac-trainer-batches');
        if (page === 'attendance.html') {
          document.body.classList.add('rbac-trainer-attendance');
          blockAttendanceEdits();
        }
        window.openForm = function () { SIIT.Utils.toast('Freelancer trainers have view-only access.', 'error'); };
        window.deleteRow = function () { SIIT.Utils.toast('Freelancer trainers have view-only access.', 'error'); };
        window.deleteSession = function () { SIIT.Utils.toast('Freelancer trainers have view-only access.', 'error'); };
        window.viewBatchDetails = function () {
          SIIT.Utils.toast('Trainers cannot open batch quiz / assessment / feedback details.', 'error');
        };
      }
    } catch (_) {}
  }

  return { enforce, FULL_ACCESS_ROLES, ROLE_ACCESS, isFullAccess, configFor, enforceTrainerType };
})();
