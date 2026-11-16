/* MidLand Constructions — shared front-end code (all pages) */
(function () {
  'use strict';

  // ─── UTILITIES ──────────────────────────────────────────────────────────────
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="/assets/icons.svg#${name}"/></svg>`;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  /** Today's date in Pakistan time, as YYYY-MM-DD */
  const todayPK = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

  // ─── CONFIG (contact details come from the server, defined in one place) ──
  const DEFAULT_CONFIG = { whatsapp: '923001234567', phone: '+92 300 1234567', email: 'info@midlandpk.com', address: 'DHA Phase 6, Lahore', hours: 'Mon–Sat, 9:00 AM – 7:00 PM' };
  const configReady = fetch('/api/config').then(r => r.ok ? r.json() : DEFAULT_CONFIG).catch(() => DEFAULT_CONFIG);
  const waLink = (number, text) => `https://wa.me/${number}${text ? '?text=' + encodeURIComponent(text) : ''}`;

  configReady.then(cfg => {
    $$('[data-wa]').forEach(a => { a.href = waLink(cfg.whatsapp, a.dataset.wa || ''); });
    $$('[data-cfg]').forEach(el => {
      const key = el.dataset.cfg, val = cfg[key];
      if (!val) return;
      el.textContent = val;
      if (el.tagName === 'A' && key === 'phone') el.href = 'tel:' + val.replace(/[^\d+]/g, '');
      if (el.tagName === 'A' && key === 'email') el.href = 'mailto:' + val;
    });
  });

  // ─── TOAST ──────────────────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg, kind = 'check') {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.innerHTML = icon(kind) + `<span>${esc(msg)}</span>`;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
  }

  // ─── NAV / CHROME ───────────────────────────────────────────────────────────
  function initChrome() {
    const nav = $('.nav'), btn = $('.menu-btn'), links = $('.nav-links');
    if (btn && links) {
      btn.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
        btn.innerHTML = icon(open ? 'x' : 'menu');
      });
      links.addEventListener('click', e => { if (e.target.closest('a')) { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.innerHTML = icon('menu'); } });
    }
    const back = $('.back-top');
    back?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    const onScroll = () => {
      nav?.classList.toggle('scrolled', scrollY > 40);
      back?.classList.toggle('show', scrollY > 700);
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // Highlight the nav link of the section in view
    const sectionLinks = $$('.nav-links a[href^="#"], .nav-links a[href^="/#"]');
    if ('IntersectionObserver' in window && sectionLinks.length) {
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        sectionLinks.forEach(a => a.setAttribute('aria-current', a.getAttribute('href').endsWith('#' + en.target.id) ? 'true' : 'false'));
      }), { rootMargin: '-45% 0px -50% 0px' });
      sectionLinks.forEach(a => { const s = document.getElementById(a.getAttribute('href').split('#')[1]); if (s) io.observe(s); });
    }
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    observeReveal();
  }

  let revealObs;
  function observeReveal(root = document) {
    if (!('IntersectionObserver' in window)) { $$('.reveal', root).forEach(el => el.classList.add('visible')); return; }
    revealObs = revealObs || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } }), { threshold: .08 });
    $$('.reveal:not(.visible)', root).forEach(el => revealObs.observe(el));
  }

  // ─── FAVOURITES ─────────────────────────────────────────────────────────────
  const favs = {
    all: () => new Set(store.get('mc_favs', [])),
    has: (id) => favs.all().has(id),
    toggle(id) { const s = favs.all(); s.has(id) ? s.delete(id) : s.add(id); store.set('mc_favs', [...s]); return s.has(id); },
  };

  // ─── LIGHTBOX (keyboard + focus managed) ────────────────────────────────────
  let lb, lbItems = [], lbIdx = 0, lbReturnFocus;
  function openLightbox(items, index = 0) {
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo viewer');
      lb.innerHTML = `<button class="icon-btn close" aria-label="Close">${icon('x')}</button>
        <button class="icon-btn prev" aria-label="Previous photo">${icon('chev-l')}</button>
        <figure><img alt=""><figcaption></figcaption></figure>
        <button class="icon-btn next" aria-label="Next photo">${icon('chev-r')}</button>`;
      document.body.appendChild(lb);
      lb.addEventListener('click', e => {
        if (e.target === lb || e.target.closest('.close')) closeLightbox();
        else if (e.target.closest('.prev')) showLb(lbIdx - 1);
        else if (e.target.closest('.next')) showLb(lbIdx + 1);
      });
      lb.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showLb(lbIdx - 1);
        if (e.key === 'ArrowRight') showLb(lbIdx + 1);
        if (e.key === 'Tab') trapFocus(e, lb);
      });
    }
    lbItems = items; lbReturnFocus = document.activeElement;
    $('.prev', lb).hidden = $('.next', lb).hidden = items.length < 2;
    showLb(index);
    lb.classList.add('open'); document.body.style.overflow = 'hidden';
    $('.close', lb).focus();
  }
  function showLb(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    const it = lbItems[lbIdx];
    $('img', lb).src = it.src; $('img', lb).alt = it.alt || '';
    $('figcaption', lb).textContent = lbItems.length > 1 ? `${it.alt || ''} · ${lbIdx + 1} / ${lbItems.length}` : (it.alt || '');
  }
  function closeLightbox() { lb.classList.remove('open'); document.body.style.overflow = ''; lbReturnFocus?.focus(); }
  function trapFocus(e, container) {
    const f = $$('button:not([hidden]),a[href],input,select,textarea', container).filter(el => !el.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }

  // ─── BOOKING FORM (one implementation, used on every page) ─────────────────
  const TIMES = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'];
  const PURPOSES = ['Buy a Property', 'Rent a Property', 'Sell My Property', 'Construction Consultation', 'Investment Inquiry'];
  let bookingProperty = null;

  function bookingFormHTML() {
    return `
      <h3>Schedule your visit</h3>
      <p>Fill in your details and our team will confirm by phone or WhatsApp within 2 business hours (Mon–Sat, 9 AM – 7 PM).</p>
      <div class="prop-banner" data-prop-banner hidden></div>
      <div class="form-alert" role="alert" data-form-alert>${icon('alert')}<span></span></div>
      <form novalidate data-booking-form>
        <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="fg"><label class="label" for="bk-name">Full name *</label>
          <input class="input" id="bk-name" name="name" autocomplete="name" required maxlength="80" aria-describedby="bk-name-err">
          <div class="err" id="bk-name-err"></div></div>
        <div class="form-row">
          <div class="fg"><label class="label" for="bk-email">Email *</label>
            <input class="input" id="bk-email" name="email" type="email" autocomplete="email" required maxlength="120" aria-describedby="bk-email-err">
            <div class="err" id="bk-email-err"></div></div>
          <div class="fg"><label class="label" for="bk-phone">Phone / WhatsApp *</label>
            <input class="input" id="bk-phone" name="phone" type="tel" autocomplete="tel" required maxlength="20" placeholder="0300 1234567" aria-describedby="bk-phone-err">
            <div class="err" id="bk-phone-err"></div></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="label" for="bk-date">Preferred date *</label>
            <input class="input" id="bk-date" name="date" type="date" required aria-describedby="bk-date-err bk-date-hint">
            <div class="hint" id="bk-date-hint">Monday to Saturday</div>
            <div class="err" id="bk-date-err"></div></div>
          <div class="fg"><label class="label" for="bk-time">Preferred time</label>
            <select class="input" id="bk-time" name="time">${TIMES.map(t => `<option>${t}</option>`).join('')}</select></div>
        </div>
        <div class="fg"><label class="label" for="bk-purpose">Purpose</label>
          <select class="input" id="bk-purpose" name="purpose">${PURPOSES.map(p => `<option>${p}</option>`).join('')}</select></div>
        <div class="fg"><label class="label" for="bk-msg">Message <span style="text-transform:none;font-weight:400">(optional)</span></label>
          <textarea class="input" id="bk-msg" name="msg" maxlength="1000" placeholder="Budget, preferred area, questions…"></textarea></div>
        <button class="btn btn-teal btn-block" type="submit" data-submit>Confirm appointment ${icon('arrow-r')}</button>
        <p class="hint" style="text-align:center;margin-top:12px">By booking you agree to our <a href="/privacy">privacy policy</a>.</p>
      </form>
      <div class="success" data-success hidden tabindex="-1"></div>`;
  }

  function validate(data) {
    const e = {};
    if (data.name.trim().length < 2) e.name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) e.email = 'Please enter a valid email address.';
    if (!/^\+?[0-9][0-9\s-]{8,16}$/.test(data.phone.trim())) e.phone = 'Please enter a valid phone number, e.g. 0300 1234567.';
    if (!data.date) e.date = 'Please choose a date.';
    else if (data.date < todayPK()) e.date = 'Please choose a date from today onwards.';
    else if (new Date(data.date + 'T00:00:00Z').getUTCDay() === 0) e.date = 'We are closed on Sundays — please pick Monday to Saturday.';
    return e;
  }

  function showErrors(form, errors) {
    $$('.fg', form).forEach(fg => fg.classList.remove('invalid'));
    $$('[aria-invalid]', form).forEach(i => i.removeAttribute('aria-invalid'));
    Object.entries(errors).forEach(([k, msg]) => {
      const input = form.elements[k]; if (!input) return;
      input.closest('.fg').classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      $('#bk-' + k + '-err', form).textContent = msg;
    });
    const first = Object.keys(errors)[0];
    if (first && form.elements[first]) form.elements[first].focus();
  }

  function calendarLink(data, cfg) {
    const [y, m, d] = data.date.split('-');
    let [hm, ap] = (data.time || '10:00 AM').split(' ');
    let [h, min] = hm.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const p2 = n => String(n).padStart(2, '0');
    const start = `${y}${m}${d}T${p2(h)}${p2(min)}00`, end = `${y}${m}${d}T${p2(h + 1)}${p2(min)}00`;
    const q = new URLSearchParams({
      action: 'TEMPLATE', text: 'MidLand Constructions — appointment', dates: `${start}/${end}`, ctz: 'Asia/Karachi',
      details: `${data.purpose}${bookingProperty ? ' · ' + bookingProperty.title + ' (#' + bookingProperty.id + ')' : ''}\nWe will confirm by phone/WhatsApp.`,
      location: cfg.address,
    });
    return 'https://calendar.google.com/calendar/render?' + q;
  }

  function setBookingProperty(p) {
    bookingProperty = p || null;
    $$('[data-prop-banner]').forEach(b => {
      if (!p) { b.hidden = true; b.innerHTML = ''; return; }
      b.hidden = false;
      b.innerHTML = `<img src="${esc((p.images || [])[0] || p.img || '/assets/placeholder.svg')}" alt="">
        <div><small>Booking a viewing for</small><b>${esc(p.title)}</b><div class="hint" style="margin:0">#${esc(p.id)} · ${esc(p.location)}</div></div>
        ${b.dataset.locked ? '' : '<button type="button" class="link-btn" data-clear-prop>Remove</button>'}`;
    });
    $$('[data-booking-form]').forEach(f => { f.elements.purpose.value = p ? (p.type === 'FOR RENT' ? 'Rent a Property' : 'Buy a Property') : f.elements.purpose.value; });
  }

  function mountBooking(container, opts = {}) {
    container.innerHTML = bookingFormHTML();
    const form = $('[data-booking-form]', container), alertBox = $('[data-form-alert]', container), success = $('[data-success]', container);
    if (opts.locked) $('[data-prop-banner]', container).dataset.locked = '1';
    form.elements.date.min = todayPK();
    container.addEventListener('click', e => { if (e.target.closest('[data-clear-prop]')) setBookingProperty(null); });
    form.addEventListener('input', e => {
      const fg = e.target.closest('.fg');
      if (fg?.classList.contains('invalid')) { fg.classList.remove('invalid'); e.target.removeAttribute('aria-invalid'); }
    });
    form.elements.date.addEventListener('change', () => {
      const err = validate({ name: 'xx', email: 'a@b.cd', phone: '03001234567', date: form.elements.date.value }).date;
      showErrors(form, err ? { date: err } : {});
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      alertBox.classList.remove('show');
      const data = Object.fromEntries(new FormData(form));
      const errors = validate(data);
      showErrors(form, errors);
      if (Object.keys(errors).length) return;

      const btn = $('[data-submit]', form);
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending…';
      try {
        const res = await fetch('/api/appointments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, propertyId: bookingProperty?.id || '' }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (body.errors) showErrors(form, body.errors);
          throw new Error(body.error || 'Something went wrong.');
        }
        const cfg = await configReady;
        const waText = `Assalam o Alaikum! I just booked an appointment (ref ${body.ref}) for ${data.date} at ${data.time}.`;
        success.innerHTML = `${icon('check')}
          <h3>Appointment requested</h3>
          <p style="color:var(--text-mid)">Thank you, ${esc(data.name.split(' ')[0])}. We'll confirm your visit on <b>${esc(data.date)}</b> at <b>${esc(data.time)}</b> by phone or WhatsApp.</p>
          <div class="ref">Ref: ${esc(body.ref)}</div>
          <div class="success-actions">
            <a class="btn btn-ghost" href="${esc(calendarLink(data, cfg))}" target="_blank" rel="noopener">${icon('calendar')} Add to Google Calendar</a>
            <a class="btn btn-wa" href="${esc(waLink(cfg.whatsapp, waText))}" target="_blank" rel="noopener">${icon('whatsapp')} Message us</a>
          </div>
          <button class="link-btn" style="margin-top:18px" data-again>Book another appointment</button>`;
        form.hidden = true; $('[data-prop-banner]', container).hidden = true; success.hidden = false; success.focus();
        $('[data-again]', success).addEventListener('click', () => {
          form.reset(); form.hidden = false; success.hidden = true;
          if (!opts.locked) setBookingProperty(null); else setBookingProperty(bookingProperty);
          form.elements.name.focus();
        });
      } catch (err) {
        alertBox.querySelector('span').textContent = `${err.message} If this keeps happening, please contact us on WhatsApp.`;
        alertBox.classList.add('show');
      } finally {
        btn.disabled = false; btn.innerHTML = `Confirm appointment ${icon('arrow-r')}`;
      }
    });
  }

  // ─── PROPERTY CARD (shared by home + related listings) ─────────────────────
  function propertyCard(p) {
    const img = (p.images || [])[0] || p.img || '/assets/placeholder.svg';
    const count = (p.images || []).length;
    const liked = favs.has(p.id);
    return `<article class="card reveal">
      <div class="card-media">
        <img src="${esc(img)}" alt="${esc(p.title)} — ${esc(p.location)}" loading="lazy" decoding="async" width="600" height="450" onerror="this.src='/assets/placeholder.svg'">
        <span class="chip ${p.type === 'FOR RENT' ? 'rent' : ''}">${p.type === 'FOR RENT' ? 'For Rent' : 'For Sale'}</span>
        ${count > 1 ? `<span class="photo-count">${count} photos</span>` : ''}
      </div>
      <button class="fav" type="button" data-fav="${esc(p.id)}" aria-pressed="${liked}" aria-label="${liked ? 'Remove from' : 'Save to'} favourites: ${esc(p.title)}">${icon('heart')}</button>
      <div class="card-body">
        <h3 class="card-title"><a href="/property/${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>
        <div class="card-loc">${icon('pin')} ${esc(p.location)}</div>
        <div class="specs">
          ${p.beds ? `<span class="spec">${icon('bed')} ${p.beds} Bed${p.beds > 1 ? 's' : ''}</span>` : ''}
          ${p.baths ? `<span class="spec">${icon('bath')} ${p.baths} Bath${p.baths > 1 ? 's' : ''}</span>` : ''}
          ${p.area ? `<span class="spec">${icon('area')} ${Number(p.area).toLocaleString()} sqft</span>` : ''}
        </div>
        <div class="card-foot">
          <div class="price">${esc(p.price)}<small>${esc(p.category)} · #${esc(p.id)}</small></div>
          <span class="card-cta">View ${icon('arrow-r')}</span>
        </div>
      </div>
    </article>`;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    const on = favs.toggle(b.dataset.fav);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', b.getAttribute('aria-label').replace(on ? 'Save to' : 'Remove from', on ? 'Remove from' : 'Save to'));
    toast(on ? 'Saved to favourites' : 'Removed from favourites', 'heart');
    document.dispatchEvent(new CustomEvent('favs:change'));
  });

  window.MC = { $, $$, esc, icon, toast, store, favs, configReady, waLink, openLightbox, trapFocus, mountBooking, setBookingProperty, propertyCard, observeReveal, todayPK };
  document.addEventListener('DOMContentLoaded', () => {
    initChrome();
    $$('[data-booking]').forEach(el => mountBooking(el, { locked: el.hasAttribute('data-locked') }));
    if (window.__PROPERTY__) setBookingProperty(window.__PROPERTY__);
  });
})();
