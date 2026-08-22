/**
 * Sujata Institute - Supabase Configuration (LIVE)
 * Project: dpaamjvrvktzlnkqfgal
 */
const SUPABASE_URL = 'https://dpaamjvrvktzlnkqfgal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwYWFtanZydmt0emxua3FmZ2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzk0NzEsImV4cCI6MjEwMDcxNTQ3MX0.RBVZ7i44YDyahMLtPLIc-wVwPzMv3BHA2MrNhG50jZQ';

let supabaseClient = null;

/**
 * Create (once) and return the Supabase client.
 * Always call this – never use the global `supabase` library object directly.
 */
function initSupabase() {
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    console.warn('Supabase JS SDK not loaded. Add the CDN script BEFORE this file.');
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/* ------------------------------------------------------------------ */
/*  Session helpers                                                    */
/* ------------------------------------------------------------------ */
const Session = {
  KEY: 'siit_user_session',

  set(user) {
    const session = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id,
      role_name: user.role_name || (user.roles && user.roles.role_name) || '',
      college_id: user.college_id || null,
      profile_image: user.profile_image || null,
      logged_at: new Date().toISOString()
    };
    localStorage.setItem(this.KEY, JSON.stringify(session));
    return session;
  },

  get() {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },

  isLoggedIn() {
    return !!this.get();
  },

  requireAuth(redirectTo) {
    if (!this.isLoggedIn()) {
      window.location.href = redirectTo || '../admin/login.html';
      return false;
    }
    return true;
  },

  hasRole(...roles) {
    const s = this.get();
    return s ? roles.includes(s.role_name) : false;
  },

  isSuperAdmin() {
    return this.hasRole('Super Admin');
  }
};

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/* ------------------------------------------------------------------ */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'siit_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function loginUser(email, password) {
  const client = initSupabase();
  if (!client) throw new Error('Supabase not available');

  const passwordHash = await hashPassword(password);
  const plain = String(password || '');

  const { data, error } = await client
    .from('users')
    .select('*, roles(role_name)')
    .eq('email', email.trim().toLowerCase())
    .eq('status', true)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error('Login failed. Please try again.');
  }
  if (!data) throw new Error('Invalid email or password');

  // Accept either SHA-256 hash OR legacy plain-text stored in password_hash
  const stored = data.password_hash || '';
  const matchHash = stored === passwordHash;
  const matchPlain = stored === plain;
  const matchPlainCol = data.password_plain && data.password_plain === plain;
  if (!matchHash && !matchPlain && !matchPlainCol) {
    throw new Error('Invalid email or password');
  }

  // Upgrade plain-text password to hash (+ password_plain for admin view)
  const patch = { last_login: new Date().toISOString() };
  if (matchPlain && !matchHash) {
    patch.password_hash = passwordHash;
    patch.password_plain = plain;
  } else if (matchHash && data.password_plain == null) {
    patch.password_plain = plain;
  }

  await client.from('users').update(patch).eq('id', data.id);

  return Session.set({
    ...data,
    role_name: data.roles?.role_name || ''
  });
}

function logoutUser() {
  Session.clear();
  const isAdmin = window.location.pathname.includes('/admin/');
  window.location.href = isAdmin ? 'login.html' : '../admin/login.html';
}

/* ------------------------------------------------------------------ */
/*  Public data helpers                                                */
/* ------------------------------------------------------------------ */
async function fetchCourses(activeOnly = true) {
  const client = initSupabase();
  if (!client) return [];
  let q = client.from('courses').select('*').order('course_name');
  if (activeOnly) q = q.eq('status', true);
  const { data, error } = await q;
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchColleges() {
  const client = initSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('colleges')
    .select('*')
    .eq('status', true)
    .order('college_name');
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchStats() {
  const client = initSupabase();
  if (!client) return { students: 0, courses: 0, placements: 0, companies: 0 };

  try {
    const count = async (table, filterFn) => {
      try {
        let q = client.from(table).select('id', { count: 'exact', head: true });
        if (filterFn) q = filterFn(q);
        const { count: n, error } = await q;
        if (error) return 0;
        return n || 0;
      } catch (_) {
        return 0;
      }
    };

    const [students, courses, placedOld, placedNew, companies] = await Promise.all([
      count('students'),
      count('courses', q => q.eq('status', true)),
      count('placed_students'),
      count('placed_candidates'),
      count('companies', q => q.eq('status', true))
    ]);

    return {
      students,
      courses,
      placements: Math.max(placedOld, placedNew),
      companies
    };
  } catch (e) {
    console.error(e);
    return { students: 0, courses: 0, placements: 0, companies: 0 };
  }
}

/** Student feedback / testimonials for public website */
/** Student feedback / testimonials for public website */
async function fetchTestimonials(limit = 12) {
  const client = initSupabase();
  if (!client) return [];

  // 1) Prefer dedicated testimonials table
  try {
    const { data, error } = await client
      .from('testimonials')
      .select('*')
      .eq('is_approved', true)
      .order('sort_order', { ascending: true })
      .limit(limit);

    if (!error && data && data.length) {
      return data.map(t => ({
        name: t.name || 'Student',
        designation: t.designation || t.company || '',
        rating: t.rating || 5,
        review: t.review || t.comments || '',
        photo: t.photo || null
      }));
    }
  } catch (_) {}

  // 2) Fallback: use placed_students reviews as testimonials
  try {
    const { data, error } = await client
      .from('placed_students')
      .select(`
        manual_student_name,
        designation,
        student_review,
        student_photo_url,
        company_id,
        placement_status
      `)
      .not('student_review', 'is', null)
      .order('id', { ascending: false })
      .limit(limit);

    if (error || !data || !data.length) return [];

    // Resolve company names
    const companyIds = [...new Set(data.map(d => d.company_id).filter(Boolean))];
    let companyMap = {};
    if (companyIds.length) {
      const { data: cos } = await client
        .from('companies')
        .select('id, company_name')
        .in('id', companyIds);
      (cos || []).forEach(c => { companyMap[c.id] = c.company_name; });
    }

    return data
      .filter(d => d.student_review && String(d.student_review).trim())
      .map(d => ({
        name: d.manual_student_name || 'Student',
        designation: d.designation
          ? `${d.designation}${companyMap[d.company_id] ? ' @ ' + companyMap[d.company_id] : ''}`
          : (companyMap[d.company_id] || 'Placed Student'),
        rating: 5,
        review: d.student_review,
        photo: d.student_photo_url || null
      }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function submitEnquiry(formData) {
  const client = initSupabase();
  if (!client) throw new Error('Database not available');

  const courseRaw = String(
    formData.course || formData.course_interest || formData.interest || ''
  ).trim();

  // Live DB: course_interest is BIGINT FK → courses(id)
  // Resolve course name or id → numeric id (or null)
  let courseId = null;
  let courseLabel = courseRaw || null;
  if (courseRaw) {
    if (/^\d+$/.test(courseRaw)) {
      courseId = Number(courseRaw);
    } else if (courseRaw.toLowerCase() !== 'other') {
      try {
        // exact match first
        let { data: found } = await client
          .from('courses')
          .select('id, course_name')
          .ilike('course_name', courseRaw)
          .limit(1)
          .maybeSingle();
        if (!found) {
          // partial match (e.g. "Full Stack" vs "Full Stack Development")
          const { data: list } = await client
            .from('courses')
            .select('id, course_name')
            .ilike('course_name', '%' + courseRaw + '%')
            .limit(5);
          if (list && list.length === 1) found = list[0];
          else if (list && list.length > 1) {
            const exact = list.find(
              (c) => String(c.course_name).toLowerCase() === courseRaw.toLowerCase()
            );
            found = exact || list[0];
          }
        }
        if (found) {
          courseId = Number(found.id);
          courseLabel = found.course_name || courseRaw;
        }
      } catch (e) {
        console.warn('Course lookup failed', e);
      }
    }
  }

  let message = formData.message ? String(formData.message).trim() : '';
  // Keep human-readable course name in message when we only store the id
  if (courseLabel && courseId) {
    const prefix = 'Course: ' + courseLabel;
    if (!message) message = prefix;
    else if (!message.toLowerCase().includes(String(courseLabel).toLowerCase())) {
      message = prefix + '\n' + message;
    }
  } else if (courseLabel && !courseId) {
    const prefix = 'Course interest: ' + courseLabel;
    if (!message) message = prefix;
    else message = prefix + '\n' + message;
  }

  const payload = {
    name: String(formData.name || '').trim(),
    phone: String(formData.phone || formData.mobile || '').trim(),
    email: formData.email ? String(formData.email).trim() : null,
    college: formData.college ? String(formData.college).trim() : null,
    course_interest: courseId, // bigint FK to courses.id (null if unknown / Other)
    city: formData.city ? String(formData.city).trim() : null,
    message: message || null,
    source: formData.source || 'Website',
    status: 'New'
  };

  if (!payload.name || !payload.phone) {
    throw new Error('Name and phone are required');
  }

  const { data, error } = await client
    .from('enquiries')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Enquiry insert error:', error);
    // Friendly messages only — never expose SQL internals to the user
    if (error.code === '22P02' || /invalid input syntax for type bigint/i.test(error.message || '')) {
      throw new Error('Could not save enquiry. Please select a valid course from the list and try again.');
    }
    if (error.code === '23503') {
      throw new Error('Selected course is not available. Please choose another program.');
    }
    throw new Error('Could not save enquiry. Please try again or contact us on WhatsApp.');
  }

  // Open WhatsApp unless caller handles it (e.g. course popup)
  if (formData.openWhatsApp !== false) {
    try {
      openEnquiryWhatsApp({
        name: payload.name,
        phone: payload.phone,
        course: courseLabel || '',
        message: formData.message || message || '',
        email: payload.email || '',
        source: payload.source
      });
    } catch (_) {}
  }

  return data;
}

/** Primary WhatsApp number for institute (digits only, with country code) */
const ENQUIRY_WHATSAPP = '919699544383';

/**
 * Build a clean WhatsApp enquiry message and open wa.me.
 * Uses real newlines then encodeURIComponent once — never put %0A in the string.
 */
function openEnquiryWhatsApp(info) {
  const name = (info && info.name) || '';
  const phone = (info && info.phone) || '';
  const course = (info && info.course) || '';
  const message = (info && info.message) || '';
  const email = (info && info.email) || '';
  const source = (info && info.source) || 'Website';

  let plain = 'Hello SIIT,\n';
  plain += 'Name: ' + name + '\n';
  plain += 'Mobile: ' + phone + '\n';
  if (email) plain += 'Email: ' + email + '\n';
  if (course) plain += 'Course: ' + course + '\n';
  if (message) plain += 'Message: ' + message + '\n';
  plain += 'Source: ' + source;

  const url = 'https://wa.me/' + ENQUIRY_WHATSAPP + '?text=' + encodeURIComponent(plain);
  window.open(url, '_blank');
  return url;
}

/**
 * Nice Bootstrap modal instead of browser alert()
 */
function showAppModal(opts) {
  const title = (opts && opts.title) || 'Message';
  const message = (opts && opts.message) || '';
  const type = (opts && opts.type) || 'success'; // success | error | info
  const icon =
    type === 'error' ? 'fa-exclamation-circle text-danger' :
    type === 'info' ? 'fa-info-circle text-primary' :
    'fa-check-circle text-success';

  let el = document.getElementById('siitAppModal');
  if (el) el.remove();

  const div = document.createElement('div');
  div.innerHTML = `
<div class="modal fade" id="siitAppModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content border-0 shadow-lg" style="border-radius:16px;overflow:hidden">
      <div class="modal-header border-0 pb-0">
        <h5 class="modal-title fw-bold d-flex align-items-center gap-2">
          <i class="fas ${icon}"></i> ${String(title).replace(/</g,'&lt;')}
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body pt-2">
        <p class="mb-0 text-secondary" style="white-space:pre-line">${String(message).replace(/</g,'&lt;')}</p>
      </div>
      <div class="modal-footer border-0 pt-0">
        <button type="button" class="btn btn-primary rounded-pill px-4" data-bs-dismiss="modal">OK</button>
      </div>
    </div>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
  const modalEl = document.getElementById('siitAppModal');
  if (window.bootstrap && modalEl) {
    const m = new bootstrap.Modal(modalEl);
    m.show();
    modalEl.addEventListener('hidden.bs.modal', () => { try { modalEl.remove(); } catch(_){} }, { once: true });
  } else {
    // fallback if bootstrap not loaded
    alert(title + '\n\n' + message);
  }
}

/* ------------------------------------------------------------------ */
/*  Utils                                                              */
/* ------------------------------------------------------------------ */
const Utils = {
  formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  formatCurrency(n) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(n || 0);
  },

  toast(msg, type = 'success') {
    // Prefer Bootstrap toast-style popup with clear success/error styling
    const existing = document.getElementById('siitToastHost');
    if (existing) existing.remove();
    const host = document.createElement('div');
    host.id = 'siitToastHost';
    host.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    host.style.zIndex = 99999;
    const bg = type === 'error' || type === 'danger' ? 'danger' : (type === 'warning' ? 'warning' : 'success');
    const icon = bg === 'danger' ? 'fa-exclamation-circle' : (bg === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle');
    host.innerHTML = `
      <div class="alert alert-${bg} alert-dismissible fade show shadow-lg d-flex align-items-center gap-2 mb-0" role="alert" style="min-width:280px;max-width:92vw;border-radius:12px;">
        <i class="fas ${icon} fs-5"></i>
        <div class="flex-grow-1">${String(msg || '').replace(/</g,'&lt;')}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>`;
    document.body.appendChild(host);
    setTimeout(() => { try { host.remove(); } catch(_){} }, 5500);
  },

  getCollegeFilter() {
    const s = Session.get();
    if (!s || s.role_name === 'Super Admin') return null;
    return s.college_id;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

/* ------------------------------------------------------------------ */
/*  Expose everything on window.SIIT                                   */
/* ------------------------------------------------------------------ */
window.SIIT = {
  // core
  Session,
  loginUser,
  logoutUser,
  submitEnquiry,
  openEnquiryWhatsApp,
  showAppModal,
  hashPassword,
  initSupabase,

  // data helpers
  fetchCourses,
  fetchColleges,
  fetchStats,
  fetchTestimonials,

  Utils,
  SUPABASE_URL,

  // ★ This is the important fix – always returns the real client
  get supabase() {
    return initSupabase();
  }
};

// Also expose a global shortcut many pages already expect
window.supabaseClient = null;
Object.defineProperty(window, 'supabaseClient', {
  get() {
    return initSupabase();
  }
});