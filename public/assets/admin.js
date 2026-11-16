/* MidLand Constructions — admin panel. Works only against the real API (no demo/offline mode). */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // Escape for HTML text AND attribute values. Never put data inside inline JS (onclick=…);
  // all actions use data-* attributes + event delegation instead.
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let token = sessionStorage.getItem('mc_tok');
  let properties = [], appointments = [], apptFilter = 'pending', editingId = null;

  // ─── PRICE HELPERS (mirror of lib/price.js) ────────────────────────────────
  function parsePrice(text) {
    const s = String(text || '').toLowerCase().replace(/,/g, ''), m = s.match(/(\d+(?:\.\d+)?)/);
    if (!m) return 0; const n = parseFloat(m[1]);
    if (/crore|\bcr\b/.test(s)) return Math.round(n * 1e7);
    if (/lac|lakh/.test(s)) return Math.round(n * 1e5);
    if (/\d\s*k\b|thousand/.test(s)) return Math.round(n * 1e3);
    if (/million|\bm\b/.test(s)) return Math.round(n * 1e6);
    return Math.round(n);
  }
  const t2 = (n) => String(Number(n.toFixed(2)));
  function formatPrice(n, type) {
    let s = n >= 1e7 ? `PKR ${t2(n / 1e7)} Crore` : n >= 1e5 ? `PKR ${t2(n / 1e5)} Lac` : n >= 1e3 ? `PKR ${t2(n / 1e3)}K` : `PKR ${n}`;
    return type === 'FOR RENT' ? s + '/mo' : s;
  }

  // ─── API ────────────────────────────────────────────────────────────────────
  async function api(path, opts = {}) {
    const r = await fetch('/api' + path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '', ...(opts.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== '/admin/login') { forceLogout('Your session expired. Please log in again.'); throw new Error('Session expired'); }
    if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
    return body;
  }

  let toastT;
  function toast(msg) {
    $('#tm').textContent = msg; const t = $('#toast'); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3800);
  }
  function showErr(el, msg) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }

  // ─── AUTH ───────────────────────────────────────────────────────────────────
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#login-err'), btn = $('#login-btn');
    showErr(err, ''); btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const d = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username: $('#l-user').value.trim(), password: $('#l-pass').value }) });
      token = d.token; sessionStorage.setItem('mc_tok', token); sessionStorage.setItem('mc_user', d.username);
      $('#l-pass').value = '';
      await enter();
    } catch (ex) {
      showErr(err, ex.message === 'Failed to fetch' ? 'Could not reach the server. Check your connection and try again.' : ex.message);
    } finally { btn.disabled = false; btn.textContent = 'Sign in →'; }
  });

  async function enter() {
    $('#login-screen').style.display = 'none';
    const user = sessionStorage.getItem('mc_user') || 'Administrator';
    $('#su-name').textContent = user; $('#su-av').textContent = user[0].toUpperCase();
    await refresh();
    route();
  }
  function forceLogout(msg) {
    token = null; sessionStorage.removeItem('mc_tok');
    properties = []; appointments = [];
    $('#login-screen').style.display = 'flex';
    showErr($('#login-err'), msg || '');
  }
  $('#logout-btn').addEventListener('click', () => {
    if (!confirm('Log out of the admin panel?')) return;
    api('/admin/logout', { method: 'POST' }).catch(() => {});
    forceLogout(); toast('Logged out.');
  });

  async function refresh() {
    try {
      [properties, appointments] = await Promise.all([api('/admin/properties'), api('/admin/appointments')]);
      renderAll();
    } catch (ex) { if (token) toast('⚠️ Could not load data: ' + ex.message); }
  }

  // ─── ROUTING (hash-based, so browser back/forward works) ───────────────────
  const TITLES = { dashboard: 'Dashboard', properties: 'Property listings', edit: 'Add property', appointments: 'Appointments', calendar: 'Calendar', settings: 'Settings' };
  function route() {
    if (!token) return;
    let [page, arg] = location.hash.slice(1).split('/');
    if (!TITLES[page]) page = 'dashboard';
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    $$('.nav-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    $('#tb-title').textContent = page === 'edit' && arg ? 'Edit property' : TITLES[page];
    $('#sidebar').classList.remove('open');
    if (page === 'edit') openEditor(arg ? decodeURIComponent(arg) : null);
    if (page === 'calendar') renderCalendar();
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  $('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  const todayStr = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  const isPast = (a) => a.date < todayStr();
  const pendingAppts = () => appointments.filter(a => !a.confirmed && !isPast(a));

  function renderAll() { renderDashboard(); renderPropsTable(); renderAppts(); renderCalendar(); updateTopbar(); }

  function updateTopbar() {
    const pending = pendingAppts().length;
    $('#tb-listings').textContent = properties.filter(p => p.status === 'available').length;
    $('#tb-appts').textContent = pending;
    const b = $('#appt-badge'); b.textContent = pending; b.style.display = pending ? 'inline' : 'none';
  }

  function renderDashboard() {
    const tot = properties.length, avail = properties.filter(p => p.status === 'available').length;
    $('#k-total').textContent = tot; $('#k-avail').textContent = avail;
    $('#k-appts').textContent = pendingAppts().length; $('#k-closed').textContent = tot - avail;
    const upcoming = appointments.filter(a => !isPast(a)).slice(0, 6);
    $('#dash-appts').innerHTML = !upcoming.length ? '<div class="empty"><div class="empty-ico">📭</div><p>No upcoming appointments</p></div>'
      : upcoming.map(a => `
      <div class="mini-appt">
        <div><div class="ma-name">${esc(a.name)}</div><div class="ma-info">${esc(a.purpose)} · ${esc(a.phone)}</div>
          ${a.propertyId ? `<div style="font-size:11px;font-weight:700;color:#8a5f00;margin-top:2px">🏠 #${esc(a.propertyId)} — ${esc(a.propertyName)}</div>` : ''}</div>
        <div><div class="ma-date">📅 ${esc(a.date)} · ${esc(a.time || 'TBD')}</div><span class="badge ${a.confirmed ? 'available' : 'new'}">${a.confirmed ? 'Confirmed' : 'Pending'}</span></div>
      </div>`).join('');
    const items = [
      ['For sale', properties.filter(p => p.type === 'FOR SALE').length, '#c9a84c'], ['For rent', properties.filter(p => p.type === 'FOR RENT').length, '#1a3a4a'],
      ['Residential', properties.filter(p => p.category === 'Residential').length, '#2e7d32'], ['Commercial', properties.filter(p => p.category === 'Commercial').length, '#c0392b'],
      ['Apartment', properties.filter(p => p.category === 'Apartment').length, '#1565c0'], ['Plot', properties.filter(p => p.category === 'Plot').length, '#6d4c41'],
      ['Available', avail, '#2e7d32'], ['Closed', tot - avail, '#888'],
    ];
    $('#dash-breakdown').innerHTML = items.map(([l, c, col]) => `
      <div class="bar-row"><div class="bar-top"><span>${l}</span><span style="font-weight:600">${c}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${tot ? Math.round(c / tot * 100) : 0}%;background:${col}"></div></div></div>`).join('');
  }

  function renderPropsTable() {
    const tb = $('#props-body');
    if (!properties.length) { tb.innerHTML = '<tr><td colspan="8"><div class="empty"><div class="empty-ico">🏠</div><p>No properties yet. <a href="#edit">Add your first listing</a>.</p></div></td></tr>'; return; }
    tb.innerHTML = properties.map(p => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:12px">
          <img class="prop-thumb" src="${esc(p.images[0] || '/assets/placeholder.svg')}" alt="" onerror="this.src='/assets/placeholder.svg'">
          <strong style="font-size:13px;max-width:200px;display:block">${esc(p.title)}</strong></div></td>
        <td><a href="/property/${encodeURIComponent(p.id)}" target="_blank" rel="noopener" style="font-weight:700;color:#8a5f00">#${esc(p.id)}</a></td>
        <td style="font-size:12px;color:var(--text-mid)">${esc(p.location)}</td>
        <td><span class="badge ${p.type === 'FOR SALE' ? 'sale' : 'rent'}">${esc(p.type)}</span><div style="font-size:11px;color:var(--text-light);margin-top:3px">${esc(p.category)}</div></td>
        <td style="font-weight:600">${esc(p.price)}</td>
        <td>${p.images.length}</td>
        <td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td>
        <td><div style="display:flex;gap:6px">
          <a class="btn btn-sm btn-ghost" href="#edit/${encodeURIComponent(p.id)}">Edit</a>
          ${p.status === 'available'
            ? `<button class="btn btn-sm btn-gold" data-act="status" data-id="${esc(p.id)}" data-status="${p.type === 'FOR RENT' ? 'rented' : 'sold'}">Mark ${p.type === 'FOR RENT' ? 'rented' : 'sold'}</button>`
            : `<button class="btn btn-sm btn-teal" data-act="status" data-id="${esc(p.id)}" data-status="available">Re-list</button>`}
          <button class="btn btn-sm btn-red" data-act="del-prop" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.title)}">🗑</button>
        </div></td>
      </tr>`).join('');
  }

  const WA_SVG = '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor"><use href="/assets/icons.svg#whatsapp"/></svg>';
  function apptCard(a) {
    const past = isPast(a);
    return `<div class="appt-card${a.confirmed ? ' confirmed' : ''}">
      <div class="ac-name">${esc(a.name)}<span class="badge ${past ? 'past' : a.confirmed ? 'available' : 'new'}">${past ? 'Past' : a.confirmed ? 'Confirmed' : 'Pending'}</span></div>
      <div style="background:${a.propertyId ? '#fff8e1' : '#f5f5f5'};border:2px solid ${a.propertyId ? '#f0c040' : '#ddd'};border-radius:10px;padding:10px 14px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:.08em">Property enquiry</div>
        ${a.propertyId ? `<a href="/property/${encodeURIComponent(a.propertyId)}" target="_blank" rel="noopener" style="font-size:14px;font-weight:700;color:#8a5f00">#${esc(a.propertyId)} — ${esc(a.propertyName || 'Unknown property')}</a>`
          : '<div style="font-size:13px;color:#777;font-style:italic">General enquiry</div>'}
      </div>
      <div class="ac-detail"><span>📧</span><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></div>
      <div class="ac-detail"><span>📞</span><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></div>
      <div class="ac-detail"><span>🎯</span>${esc(a.purpose)}</div>
      ${a.msg ? `<div class="ac-msg">“${esc(a.msg)}”</div>` : ''}
      <div class="ac-foot">
        <div><div class="ac-date">📅 ${esc(a.date)}</div><div class="ac-time">🕐 ${esc(a.time || 'TBD')}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${!a.confirmed && !past ? `<button class="btn btn-sm btn-gold" data-act="confirm" data-id="${esc(a.id)}">✓ Confirm</button>
            <button class="btn btn-sm btn-wa" data-act="reschedule" data-id="${esc(a.id)}" style="background:#fff8e1;color:#8a5f00;border-color:#f0d080">${WA_SVG} Reschedule</button>` : ''}
          ${a.confirmed && !past ? `<a class="btn btn-sm btn-wa" href="${esc(waConfirmLink(a))}" target="_blank" rel="noopener">${WA_SVG} Re-notify</a>` : ''}
          <button class="btn btn-sm btn-red" data-act="del-appt" data-id="${esc(a.id)}">Delete</button>
        </div>
      </div>
    </div>`;
  }

  function renderAppts() {
    const pend = pendingAppts().length, conf = appointments.filter(a => a.confirmed && !isPast(a)).length, past = appointments.filter(isPast).length;
    $('#appt-sub').textContent = `${pend} pending · ${conf} confirmed upcoming · ${past} past`;
    $$('#appt-tabs .tab').forEach(t => t.setAttribute('aria-pressed', t.dataset.filter === apptFilter));
    const list = appointments.filter(a => apptFilter === 'all' ? true : apptFilter === 'past' ? isPast(a)
      : apptFilter === 'confirmed' ? a.confirmed && !isPast(a) : !a.confirmed && !isPast(a));
    $('#appt-container').innerHTML = list.length ? `<div class="appt-grid-cards">${list.map(apptCard).join('')}</div>`
      : `<div class="empty"><div class="empty-ico">📭</div><p>No ${apptFilter === 'all' ? '' : apptFilter + ' '}appointments.</p></div>`;
    updateTopbar();
  }
  $('#appt-tabs').addEventListener('click', e => { const t = e.target.closest('[data-filter]'); if (t) { apptFilter = t.dataset.filter; renderAppts(); } });

  // ─── ACTIONS (event delegation) ─────────────────────────────────────────────
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    b.disabled = true;
    try {
      if (act === 'status') {
        const upd = await api('/admin/properties/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ status: b.dataset.status }) });
        properties = properties.map(p => p.id === id ? upd : p); toast(`Marked as ${b.dataset.status}.`);
      } else if (act === 'del-prop') {
        if (!confirm(`Delete listing #${id} permanently? This cannot be undone.`)) return;
        await api('/admin/properties/' + encodeURIComponent(id), { method: 'DELETE' });
        properties = properties.filter(p => p.id !== id); toast('Property deleted.');
      } else if (act === 'confirm') {
        const a = appointments.find(x => x.id === id);
        const w = window.open('', '_blank'); // open synchronously so pop-up blockers allow it
        await api('/admin/appointments/' + id, { method: 'PATCH', body: JSON.stringify({ confirmed: true }) });
        a.confirmed = true; toast(`Confirmed — opening WhatsApp for ${a.name}.`);
        if (w) w.location = waConfirmLink(a);
      } else if (act === 'reschedule') {
        const a = appointments.find(x => x.id === id);
        if (!confirm(`Send ${a.name} a reschedule message on WhatsApp and remove this request?`)) return;
        const w = window.open('', '_blank');
        await api('/admin/appointments/' + id, { method: 'DELETE' });
        appointments = appointments.filter(x => x.id !== id);
        if (w) w.location = waRescheduleLink(a);
        toast('Reschedule message opened; request removed.');
      } else if (act === 'del-appt') {
        if (!confirm('Delete this appointment?')) return;
        await api('/admin/appointments/' + id, { method: 'DELETE' });
        appointments = appointments.filter(x => x.id !== id); toast('Appointment deleted.');
      } else if (act === 'cal-detail') {
        showCalDetail(id); return;
      }
      renderAll();
    } catch (ex) { if (ex.message !== 'Session expired') toast('⚠️ ' + ex.message); }
    finally { b.disabled = false; }
  });

  $('#clear-all').addEventListener('click', async () => {
    if (!appointments.length) return toast('No appointments to delete.');
    const typed = prompt(`This permanently deletes all ${appointments.length} appointments (export a CSV first if you need them).\n\nType DELETE ALL to confirm:`);
    if (typed !== 'DELETE ALL') { if (typed !== null) toast('Not deleted — confirmation text did not match.'); return; }
    try {
      const r = await api('/admin/appointments', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE ALL' }) });
      appointments = []; renderAll(); toast(`Deleted ${r.cleared} appointments.`);
    } catch (ex) { toast('⚠️ ' + ex.message); }
  });

  $('#export-csv').addEventListener('click', () => {
    const cols = ['date', 'time', 'name', 'phone', 'email', 'purpose', 'propertyId', 'propertyName', 'msg', 'confirmed', 'createdAt'];
    // Prefix cells starting with = + - @ so spreadsheet apps don't run them as formulas
    const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const csv = [cols.join(','), ...appointments.map(a => cols.map(c => cell(a[c])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `midland-appointments-${todayStr()}.csv` });
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  });

  // ─── ADD / EDIT PROPERTY ────────────────────────────────────────────────────
  const form = $('#prop-form');
  function openEditor(id) {
    editingId = id; form.reset(); showErr($('#prop-err'), '');
    const p = id ? properties.find(x => x.id === id) : null;
    if (id && !p) { toast('Property not found.'); location.hash = 'properties'; return; }
    $('#edit-title').textContent = p ? `Edit #${p.id}` : 'Add new property';
    $('#edit-sub').textContent = p ? p.title : 'Fill in the details below to publish a new listing';
    $('#prop-submit').textContent = p ? '✓ Save changes' : '✓ Publish property';
    $('#status-wrap').hidden = !p;
    if (p) {
      const f = form.elements;
      ['title', 'location', 'city', 'type', 'category', 'area', 'floor', 'beds', 'baths', 'desc', 'status'].forEach(k => { f[k].value = p[k] ?? ''; });
      f.price_pkr.value = p.price_pkr || ''; f.images.value = p.images.join('\n');
    }
    updatePreviews();
  }
  function updatePreviews() {
    const f = form.elements, n = parsePrice(f.price_pkr.value);
    $('#price-preview').textContent = n ? `Shown on website as: ${formatPrice(n, f.type.value)}` : '';
    const urls = f.images.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12);
    $('#img-previews').innerHTML = urls.map(u => /^https?:\/\//i.test(u) ? `<img src="${esc(u)}" alt="" onerror="this.style.outline='2px solid #c0392b'">` : '').join('');
  }
  form.addEventListener('input', updatePreviews);
  $('#prop-cancel').addEventListener('click', () => { location.hash = 'properties'; });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements, err = $('#prop-err');
    const data = {
      title: f.title.value.trim(), location: f.location.value.trim(), city: f.city.value.trim(), type: f.type.value, category: f.category.value,
      price_pkr: parsePrice(f.price_pkr.value), area: f.area.value.trim(), floor: f.floor.value.trim(),
      beds: f.beds.value, baths: f.baths.value, desc: f.desc.value.trim(),
      images: f.images.value.split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (editingId) data.status = f.status.value;
    if (!data.title || !data.location || !data.price_pkr) return showErr(err, 'Title, location and a valid price are required.');
    const bad = data.images.find(u => !/^https?:\/\/\S+$/i.test(u));
    if (bad) return showErr(err, `This photo link is not a valid URL: ${bad}`);
    const btn = $('#prop-submit'); btn.disabled = true;
    try {
      if (editingId) {
        const upd = await api('/admin/properties/' + encodeURIComponent(editingId), { method: 'PATCH', body: JSON.stringify(data) });
        properties = properties.map(p => p.id === editingId ? upd : p); toast(`Saved #${upd.id}.`);
      } else {
        const created = await api('/admin/properties', { method: 'POST', body: JSON.stringify(data) });
        properties.unshift(created); toast(`Published #${created.id}.`);
      }
      renderAll(); location.hash = 'properties';
    } catch (ex) { showErr(err, ex.message); }
    finally { btn.disabled = false; }
  });

  // ─── SETTINGS ───────────────────────────────────────────────────────────────
  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#pw-err'), cur = $('#pw-cur').value, nw = $('#pw-new').value;
    if (nw.length < 10) return showErr(err, 'New password must be at least 10 characters.');
    if (nw !== $('#pw-new2').value) return showErr(err, 'The new passwords do not match.');
    try {
      await api('/admin/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword: cur, newPassword: nw }) });
      e.target.reset(); showErr(err, ''); toast('Password updated.');
    } catch (ex) { showErr(err, ex.message); }
  });

  // ─── CALENDAR ───────────────────────────────────────────────────────────────
  let calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
  $$('[data-cal]').forEach(b => b.addEventListener('click', () => {
    calMonth += +b.dataset.cal;
    if (calMonth > 11) { calMonth = 0; calYear++; } if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  }));
  function renderCalendar() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    $('#cal-month-label').textContent = `${months[calMonth]} ${calYear}`;
    const confirmed = appointments.filter(a => a.confirmed);
    $('#cal-sub').textContent = `${confirmed.filter(a => !isPast(a)).length} confirmed appointment(s) upcoming`;
    const first = new Date(calYear, calMonth, 1).getDay(), days = new Date(calYear, calMonth + 1, 0).getDate(), prevDays = new Date(calYear, calMonth, 0).getDate();
    const today = todayStr();
    let cells = '', n = 0;
    for (let i = first - 1; i >= 0; i--, n++) cells += `<div class="cal-cell other-month"><div class="cal-day-num" style="opacity:.3">${prevDays - i}</div></div>`;
    for (let d = 1; d <= days; d++, n++) {
      const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells += `<div class="cal-cell${ds === today ? ' today' : ''}"><div class="cal-day-num">${d}</div>
        ${confirmed.filter(a => a.date === ds).map(a => `<button class="cal-appt-dot" style="border:0;width:100%;text-align:left" data-act="cal-detail" data-id="${esc(a.id)}">🕐 ${esc(a.time || 'TBD')} ${esc(a.name.split(' ')[0])}${a.propertyId ? ' [' + esc(a.propertyId) + ']' : ''}</button>`).join('')}</div>`;
    }
    for (let t = 1; n % 7; t++, n++) cells += `<div class="cal-cell other-month"><div class="cal-day-num" style="opacity:.3">${t}</div></div>`;
    $('#cal-body').innerHTML = cells; $('#cal-detail').innerHTML = '';
  }
  function showCalDetail(id) {
    const a = appointments.find(x => x.id === id); if (!a) return;
    $('#cal-detail').innerHTML = apptCard(a);
  }

  // ─── WHATSAPP MESSAGES ──────────────────────────────────────────────────────
  function waPhone(raw) { let n = String(raw || '').replace(/[^\d+]/g, ''); if (n.startsWith('0')) n = '92' + n.slice(1); return n.replace('+', ''); }
  function waConfirmLink(a) {
    const prop = a.propertyId ? `🏠 Property: ${a.propertyName || ''} (#${a.propertyId})\n` : '';
    const msg = `Assalam o Alaikum ${a.name}!\n\nYour appointment with *MidLand Constructions* is *confirmed*.\n\n📅 Date: ${a.date}\n🕐 Time: ${a.time || 'TBD'}\n🎯 Purpose: ${a.purpose}\n${prop}\nIf you need to reschedule, just reply to this message.\n\n— MidLand Constructions Team`;
    return `https://wa.me/${waPhone(a.phone)}?text=${encodeURIComponent(msg)}`;
  }
  function waRescheduleLink(a) {
    const msg = `Assalam o Alaikum ${a.name},\n\nThank you for booking with *MidLand Constructions*. Unfortunately we can't confirm *${a.date} at ${a.time || 'TBD'}*.\n\nPlease reply with another date and time that suits you and we'll confirm right away.\n\n— MidLand Constructions Team`;
    return `https://wa.me/${waPhone(a.phone)}?text=${encodeURIComponent(msg)}`;
  }

  // ─── SESSION SECURITY ───────────────────────────────────────────────────────
  // Log out automatically after 30 minutes without activity (token itself expires after 12h).
  let idleT;
  const resetIdle = () => { clearTimeout(idleT); if (token) idleT = setTimeout(() => forceLogout('Logged out after 30 minutes of inactivity.'), 30 * 60 * 1000); };
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev => addEventListener(ev, resetIdle, { passive: true }));

  // ─── INIT ───────────────────────────────────────────────────────────────────
  if (token) enter().then(resetIdle); else $('#l-user').focus();
})();
