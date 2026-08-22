/**
 * Course enquiry popup — shows every 10s on course pages, WhatsApp + Call
 */
(function () {
  const PHONE = '9699544383';
  const WHATSAPP = '919699544383';
  const INTERVAL_MS = 10000;
  let timer = null;
  let dismissed = sessionStorage.getItem('siit_enq_dismiss') === '1';

  function buildModal() {
    if (document.getElementById('siitEnqModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
<div class="modal fade" id="siitEnqModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content border-0 shadow-lg" style="border-radius:16px;overflow:hidden">
      <div class="modal-header border-0 pb-0">
        <h5 class="modal-title fw-bold">Enquire About Courses</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" id="siitEnqClose"></button>
      </div>
      <div class="modal-body pt-2">
        <p class="text-muted small">Share your details — we will contact you shortly.</p>
        <form id="siitEnqForm" class="row g-2">
          <div class="col-12"><input type="text" class="form-control" name="name" placeholder="Your Name *" required></div>
          <div class="col-12"><input type="tel" class="form-control" name="mobile" placeholder="Mobile Number *" required pattern="[0-9]{10}"></div>
          <div class="col-12"><input type="text" class="form-control" name="interest" id="siitInterest" placeholder="Course Interest *"></div>
          <div class="col-12"><textarea class="form-control" name="message" rows="2" placeholder="Message (optional)"></textarea></div>
          <div class="col-12 d-flex gap-2 flex-wrap mt-2">
            <button type="submit" class="btn btn-success flex-grow-1 rounded-pill">
              <i class="fab fa-whatsapp me-1"></i> Enquiry (WhatsApp)
            </button>
            <a href="tel:+91${PHONE}" class="btn btn-outline-primary flex-grow-1 rounded-pill">
              <i class="fas fa-phone me-1"></i> Call
            </a>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('siitEnqClose')?.addEventListener('click', () => {
      sessionStorage.setItem('siit_enq_dismiss', '1');
      dismissed = true;
      if (timer) clearInterval(timer);
    });
    document.getElementById('siitEnqForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get('name');
      const mobile = fd.get('mobile');
      const interest = fd.get('interest') || '';
      const message = fd.get('message') || '';
      // Real newlines — encodeURIComponent once (do NOT put %0A in the string)
      const plain =
        'Hello SIIT,\n' +
        'Name: ' + name + '\n' +
        'Mobile: ' + mobile + '\n' +
        'Course: ' + interest + '\n' +
        'Message: ' + message;
      const text = encodeURIComponent(plain);
      // Save to backend + open WhatsApp (clean newlines, not %0A)
      try {
        if (window.SIIT && SIIT.submitEnquiry) {
          await SIIT.submitEnquiry({
            name, phone: mobile, course: interest, message, source: 'Course Popup',
            openWhatsApp: false
          });
        }
      } catch (err) {
        console.warn('Enquiry save failed (WhatsApp still opens):', err);
        if (window.SIIT && SIIT.showAppModal) {
          SIIT.showAppModal({
            title: 'Note',
            message: (err && err.message) || 'Could not save online. WhatsApp will still open.',
            type: 'info'
          });
        }
      }
      if (window.SIIT && SIIT.openEnquiryWhatsApp) {
        SIIT.openEnquiryWhatsApp({ name, phone: mobile, course: interest, message, source: 'Course Popup' });
      } else {
        window.open('https://wa.me/' + WHATSAPP + '?text=' + text, '_blank');
      }
      bootstrap.Modal.getInstance(document.getElementById('siitEnqModal'))?.hide();
    });
  }

  function show() {
    if (dismissed) return;
    buildModal();
    // prefill course from page title or query
    const params = new URLSearchParams(location.search);
    const course = params.get('course') || document.querySelector('h1')?.textContent || '';
    const interest = document.getElementById('siitInterest');
    if (interest && !interest.value) interest.value = course.trim().slice(0, 80);
    const el = document.getElementById('siitEnqModal');
    if (el && window.bootstrap) new bootstrap.Modal(el).show();
  }

  function start() {
    buildModal();
    // first popup after 10s, then every 10s if still open/dismissed not set
    timer = setInterval(() => {
      if (dismissed) { clearInterval(timer); return; }
      const open = document.getElementById('siitEnqModal')?.classList.contains('show');
      if (!open) show();
    }, INTERVAL_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
