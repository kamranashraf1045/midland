/* MidLand Constructions — homepage */
(function () {
  'use strict';
  const { $, $$, esc, icon, favs, propertyCard, observeReveal, openLightbox } = window.MC;

  // ─── CONTENT YOU CAN EDIT ───────────────────────────────────────────────────
  // Completed projects shown under "Our Work". Replace the stock photos with
  // real photos of your projects as soon as you have them.
  const PROJECTS = [
    { title: 'Luxury Villas – DHA Phase 8', location: 'Karachi', year: 2024, category: 'Residential', img: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=70&auto=format&fit=crop' },
    { title: 'Grand Mall Complex', location: 'Lahore', year: 2023, category: 'Commercial', img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=70&auto=format&fit=crop' },
    { title: 'Bahria Town Residences', location: 'Islamabad', year: 2024, category: 'Residential', img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=70&auto=format&fit=crop' },
    { title: 'Model Town Extension', location: 'Lahore', year: 2022, category: 'Residential', img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=70&auto=format&fit=crop' },
    { title: 'Clifton Heights', location: 'Karachi', year: 2023, category: 'Apartment', img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=70&auto=format&fit=crop' },
    { title: 'F-7 Corporate Tower', location: 'Islamabad', year: 2021, category: 'Commercial', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=70&auto=format&fit=crop' },
  ];
  // Real client testimonials only (with the client's permission). The section
  // stays hidden while this list is empty. Example entry:
  //   { quote: '…', name: 'Client name', detail: 'Bought in DHA Phase 6, 2024' },
  const TESTIMONIALS = [];

  // Budget options (PKR) — different scales for sale and rent
  const BUDGETS = {
    'FOR SALE': [[2e7, '2 Crore'], [5e7, '5 Crore'], [1e8, '10 Crore'], [2.5e8, '25 Crore'], [5e8, '50 Crore']],
    'FOR RENT': [[5e4, '50K / month'], [1e5, '1 Lac / month'], [2e5, '2 Lac / month'], [3e5, '3 Lac / month'], [5e5, '5 Lac / month']],
  };

  // ─── STATE (mirrored to the URL so filtered views can be shared) ────────────
  let all = [];
  const params = new URLSearchParams(location.search);
  const state = {
    type: params.get('type') || 'all', q: params.get('q') || '', city: params.get('city') || '',
    cat: params.get('cat') || '', beds: params.get('beds') || '', max: params.get('max') || '', sort: params.get('sort') || 'new',
  };
  const grid = $('#prop-grid'), form = $('#filters');

  function syncUrl() {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => { if (v && !(k === 'type' && v === 'all') && !(k === 'sort' && v === 'new')) p.set(k, v); });
    const qs = p.toString();
    history.replaceState(null, '', (qs ? '?' + qs : location.pathname) + location.hash);
  }

  function fillBudget() {
    const sel = form.elements.max, opts = BUDGETS[state.type];
    sel.disabled = !opts;
    sel.innerHTML = opts ? `<option value="">Any budget</option>` + opts.map(([v, l]) => `<option value="${v}">Up to ${l}</option>`).join('')
                         : `<option value="">Choose Sale/Rent</option>`;
    if (opts && opts.some(([v]) => String(v) === state.max)) sel.value = state.max; else state.max = '';
  }

  function applyStateToControls() {
    $$('.tab').forEach(t => t.setAttribute('aria-pressed', t.dataset.type === state.type));
    fillBudget();
    ['q', 'city', 'cat', 'beds', 'sort'].forEach(k => { form.elements[k].value = state[k]; });
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const saved = favs.all();
    let list = all.filter(p =>
      (state.type === 'all' || (state.type === 'saved' ? saved.has(p.id) : p.type === state.type)) &&
      (!state.city || p.city === state.city) &&
      (!state.cat || p.category === state.cat) &&
      (!state.beds || p.beds >= +state.beds) &&
      (!state.max || p.price_pkr <= +state.max) &&
      (!q || [p.title, p.location, p.id, p.category].join(' ').toLowerCase().includes(q)));
    const by = { 'price-asc': (a, b) => a.price_pkr - b.price_pkr, 'price-desc': (a, b) => b.price_pkr - a.price_pkr, 'area-desc': (a, b) => (+b.area || 0) - (+a.area || 0) }[state.sort];
    return by ? list.sort(by) : list;
  }

  function render() {
    const list = filtered();
    const active = state.q || state.city || state.cat || state.beds || state.max || state.type !== 'all';
    $('#clear-filters').hidden = !active;
    $('#saved-count').textContent = favs.all().size ? `(${favs.all().size})` : '';
    $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'property' : 'properties'}${active ? ' match your filters' : ' available'}`;
    grid.setAttribute('aria-busy', 'false');
    if (!list.length) {
      grid.innerHTML = state.type === 'saved'
        ? `<div class="state">${icon('heart')}<p>You haven't saved any properties yet. Tap the heart on a listing to keep it here.</p></div>`
        : `<div class="state">${icon('search')}<p>No properties match these filters.</p><button class="btn btn-ghost" data-clear>Clear filters</button></div>`;
      return;
    }
    grid.innerHTML = list.map(propertyCard).join('');
    observeReveal(grid);
  }

  function update(changes) { Object.assign(state, changes); applyStateToControls(); syncUrl(); render(); }
  const clearAll = () => update({ type: 'all', q: '', city: '', cat: '', beds: '', max: '', sort: 'new' });

  // ─── EVENTS ─────────────────────────────────────────────────────────────────
  $$('.tab').forEach(t => t.addEventListener('click', () => update({ type: t.dataset.type })));
  let qTimer;
  form.addEventListener('input', e => {
    if (e.target.name === 'q') { clearTimeout(qTimer); qTimer = setTimeout(() => update({ q: e.target.value }), 200); }
  });
  form.addEventListener('change', e => { if (e.target.name && e.target.name !== 'q') update({ [e.target.name]: e.target.value }); });
  $('#clear-filters').addEventListener('click', clearAll);
  grid.addEventListener('click', e => { if (e.target.closest('[data-clear]')) clearAll(); });
  document.addEventListener('favs:change', () => { if (state.type === 'saved') render(); else $('#saved-count').textContent = favs.all().size ? `(${favs.all().size})` : ''; });
  $$('[data-filter]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    update({ type: 'all', cat: '', ...JSON.parse(a.dataset.filter) });
    $('#properties').scrollIntoView({ behavior: 'smooth' });
  }));
  $('#hero-search').addEventListener('submit', e => {
    e.preventDefault();
    update({ type: $('#hs-type').value, city: $('#hs-city').value });
    $('#properties').scrollIntoView({ behavior: 'smooth' });
  });

  // ─── LOAD LISTINGS ──────────────────────────────────────────────────────────
  function skeletons(n = 6) {
    grid.innerHTML = Array.from({ length: n }, () => `<div class="card skeleton" aria-hidden="true"><div class="card-media"></div><div class="card-body"><div class="sk" style="width:70%"></div><div class="sk" style="width:45%"></div><div class="sk" style="width:90%;margin-top:16px"></div><div class="sk" style="width:35%;height:22px;margin-top:10px"></div></div></div>`).join('');
  }

  async function load() {
    skeletons(); grid.setAttribute('aria-busy', 'true');
    try {
      const r = await fetch('/api/properties');
      if (!r.ok) throw new Error();
      all = await r.json();
      const cities = [...new Set(all.map(p => p.city).filter(Boolean))].sort();
      const opts = cities.map(c => `<option>${esc(c)}</option>`).join('');
      form.elements.city.insertAdjacentHTML('beforeend', opts);
      $('#hs-city').insertAdjacentHTML('beforeend', opts);
      applyStateToControls(); render(); renderFeatured();
    } catch {
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = `<div class="state">${icon('alert')}<p>We couldn't load the listings right now. Please check your connection and try again.</p><button class="btn btn-teal" data-retry>Try again</button></div>`;
      $('[data-retry]', grid).addEventListener('click', load);
      $('#featured').hidden = true;
    }
  }

  // ─── FEATURED LISTING (hero) ────────────────────────────────────────────────
  function renderFeatured() {
    const box = $('#featured');
    const sale = all.filter(p => p.type === 'FOR SALE');
    const p = (sale.length ? sale : all).slice().sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0))[0];
    if (!p) { box.hidden = true; return; }
    const imgs = (p.images?.length ? p.images : [p.img]).slice(0, 5);
    box.innerHTML = `
      <div class="featured-price"><small>Featured · ${p.type === 'FOR RENT' ? 'For rent' : 'For sale'}</small><b>${esc(p.price)}</b></div>
      <div class="featured-frame">
        ${imgs.map((src, i) => `<div class="featured-slide${i ? '' : ' active'}"><img src="${esc(src)}" alt="${esc(p.title)} — photo ${i + 1} of ${imgs.length}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="800" height="600"></div>`).join('')}
        <a class="featured-link" href="/property/${encodeURIComponent(p.id)}" aria-label="View ${esc(p.title)}"></a>
        ${imgs.length > 1 ? `
          <button class="icon-btn featured-nav prev" aria-label="Previous photo">${icon('chev-l')}</button>
          <button class="icon-btn featured-nav next" aria-label="Next photo">${icon('chev-r')}</button>
          <div class="featured-ctrl"><button class="icon-btn" data-pause aria-label="Pause slideshow">${icon('pause')}</button></div>
          <div class="featured-dots">${imgs.map((_, i) => `<button aria-label="Photo ${i + 1}" aria-current="${!i}"></button>`).join('')}</div>` : ''}
        <div class="featured-info"><span class="tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${icon('pin')} ${esc(p.location)}</p></div>
      </div>`;
    if (imgs.length < 2) return;

    const slides = $$('.featured-slide', box), dots = $$('.featured-dots button', box), pauseBtn = $('[data-pause]', box);
    let idx = 0, timer = null, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = (n) => {
      slides[idx].classList.remove('active'); dots[idx].setAttribute('aria-current', 'false');
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('active'); dots[idx].setAttribute('aria-current', 'true');
    };
    const start = () => { clearInterval(timer); if (!paused) timer = setInterval(() => go(idx + 1), 5000); };
    const setPaused = (v) => { paused = v; pauseBtn.innerHTML = icon(v ? 'play' : 'pause'); pauseBtn.setAttribute('aria-label', v ? 'Play slideshow' : 'Pause slideshow'); start(); };
    $('.prev', box).addEventListener('click', () => { go(idx - 1); start(); });
    $('.next', box).addEventListener('click', () => { go(idx + 1); start(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
    pauseBtn.addEventListener('click', () => setPaused(!paused));
    box.addEventListener('mouseenter', () => clearInterval(timer));
    box.addEventListener('mouseleave', start);
    box.addEventListener('focusin', () => clearInterval(timer));
    box.addEventListener('focusout', start);
    setPaused(paused);
  }

  // ─── PORTFOLIO ──────────────────────────────────────────────────────────────
  function renderPortfolio() {
    const g = $('#portfolio-grid');
    g.innerHTML = PROJECTS.map((p, i) => `
      <article class="card project reveal">
        <button class="card-media" style="border:0;padding:0;cursor:zoom-in" data-project="${i}" aria-label="View photo: ${esc(p.title)}">
          <img src="${esc(p.img)}" alt="${esc(p.title)}, ${esc(p.location)}" loading="lazy" width="600" height="450">
          <span class="chip">${esc(p.category)}</span>
        </button>
        <div class="card-body"><h3 class="card-title">${esc(p.title)}</h3><p>${icon('pin')} ${esc(p.location)}</p><div class="year">Completed ${p.year}</div></div>
      </article>`).join('');
    g.addEventListener('click', e => {
      const b = e.target.closest('[data-project]'); if (!b) return;
      openLightbox(PROJECTS.map(p => ({ src: p.img.replace('w=800', 'w=1600'), alt: `${p.title} — ${p.location}` })), +b.dataset.project);
    });
  }

  function renderTestimonials() {
    if (!TESTIMONIALS.length) return;
    $('#testimonials').hidden = false;
    $('#quotes').innerHTML = TESTIMONIALS.map(t => `<figure class="quote reveal"><blockquote>“${esc(t.quote)}”</blockquote><figcaption><b>${esc(t.name)}</b>${esc(t.detail || '')}</figcaption></figure>`).join('');
  }

  // ─── COUNTERS ───────────────────────────────────────────────────────────────
  function animateCounters() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, to = +el.dataset.to, t0 = performance.now();
      const tick = (now) => { const t = Math.min((now - t0) / 1600, 1); el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * to); if (t < 1) requestAnimationFrame(tick); };
      el.textContent = '0'; requestAnimationFrame(tick);
    }), { threshold: .4 });
    $$('.count').forEach(c => io.observe(c));
  }

  applyStateToControls();
  renderPortfolio(); renderTestimonials(); animateCounters(); load();
})();
