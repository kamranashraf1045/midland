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

  // ─── HERO SCENE: skyline, working crane, traffic, sky ───────────────────────
  // A looping construction scene. The crane delivers floors one by one; when the
  // building is finished its lights come on, a FOR SALE sign flips to SOLD, and
  // a new building starts. Seeded layout, so it looks the same on every visit.
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  function buildSkyline() {
    const host = $('#skyline'); if (!host) return;
    let seed = 1995; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const W = 1440, H = 300, ROAD = 286, SITE = [735, 885];
    const r = (n) => Math.round(n * 10) / 10;
    let back = '', front = '', wins = '';

    // back layer: lighter, no windows
    for (let x = -10; x < W; ) {
      const w = 38 + rnd() * 60, h = 70 + rnd() * 130;
      back += `<rect class="bld" style="--d:${r(.1 + x / W * .9)}s" x="${r(x)}" y="${r(ROAD - h)}" width="${r(w)}" height="${r(h)}"/>`;
      if (rnd() > .7) back += `<rect class="bld" style="--d:${r(.1 + x / W * .9)}s" x="${r(x + w / 2 - 2)}" y="${r(ROAD - h - 18)}" width="4" height="18"/>`;
      x += w + 2 + rnd() * 6;
    }
    // front layer: dark silhouettes with lit windows (none on the left, behind the hero text)
    let tallest = { h: 0 };
    for (let x = -6; x < W; ) {
      if (x > SITE[0] - 30 && x < SITE[1]) { x = SITE[1] + 4; continue; }
      const w = 44 + rnd() * 52, h = 50 + rnd() * (x > 900 && x < 1300 ? 140 : 90);
      const d = .35 + x / W * 1.1, y = ROAD - h, roof = rnd();
      front += `<g class="bld" style="--d:${r(d)}s"><rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"/>` +
        (roof > .78 ? `<path d="M${r(x)} ${r(y)} L${r(x + w / 2)} ${r(y - 16)} L${r(x + w)} ${r(y)}Z"/>` : roof > .6 ? `<rect x="${r(x + 6)}" y="${r(y - 8)}" width="${r(w - 12)}" height="8"/>` : '') + '</g>';
      if (h > tallest.h && x > 1050) tallest = { h, x: x + w / 2, y };
      const cols = x < 700 ? 0 : Math.floor((w - 10) / 11), rows = Math.floor((h - 16) / 15);
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        if (rnd() > .26) continue;
        wins += `<rect class="win" style="--d:${r(d + 1.1 + rnd() * 2.5)}s;--tw:${r(5 + rnd() * 9)}s" x="${r(x + 7 + c * 11)}" y="${r(y + 10 + rr * 15)}" width="4.5" height="7" rx=".8"/>`;
      }
      x += w + 3 + rnd() * 10;
    }

    // tower crane (mast at MX, jib reaching left over the construction site)
    const MX = 1012, TOP = 104, JIB_L = MX - 250;
    let lattice = '', jibLat = '';
    for (let y = ROAD; y > TOP + 14; y -= 16) lattice += `M${MX - 8} ${y} L${MX + 8} ${y - 16} M${MX + 8} ${y} L${MX - 8} ${y - 16} `;
    for (let x = JIB_L; x < MX + 70; x += 14) jibLat += `M${x} ${TOP + 14} L${x + 7} ${TOP + 4} L${x + 14} ${TOP + 14} `;
    const HX = MX - 57;              // hook x when the trolley is "home" (near the mast)
    const HOOK_Y = TOP + 50;         // beam top when the hook is raised
    const crane = `<g class="crane">
      <path class="steel" d="M${MX - 8} ${ROAD} V${TOP + 14} M${MX + 8} ${ROAD} V${TOP + 14} ${lattice}"/>
      <path class="steel" d="M${JIB_L} ${TOP + 14} H${MX + 70} M${JIB_L} ${TOP + 4} H${MX + 70} ${jibLat}"/>
      <path class="steel" d="M${MX} ${TOP - 18} L${JIB_L} ${TOP + 4} M${MX} ${TOP - 18} L${MX + 70} ${TOP + 4} M${MX - 8} ${TOP + 4} L${MX} ${TOP - 18} L${MX + 8} ${TOP + 4}"/>
      <rect class="cab" x="${MX + 4}" y="${TOP + 14}" width="18" height="14" rx="2"/>
      <rect class="weight" x="${MX + 40}" y="${TOP + 14}" width="26" height="18"/>
      <circle class="beacon" cx="${MX}" cy="${TOP - 20}" r="3"/>
      <g class="trolley"><rect class="cab" x="${HX - 7}" y="${TOP + 13}" width="14" height="6"/>
        <g class="hoist"><line class="cable" x1="${HX}" y1="${TOP + 19}" x2="${HX}" y2="${HOOK_Y}"/>
          <g class="load"><path class="steel" d="M${HX - 6} ${HOOK_Y} L${HX} ${HOOK_Y - 6} L${HX + 6} ${HOOK_Y}"/>
          <rect class="beam" x="${HX - 28}" y="${HOOK_Y}" width="56" height="8" rx="1"/></g></g></g>
    </g>`;
    const beacon = tallest.h ? `<line class="steel" x1="${r(tallest.x)}" y1="${r(tallest.y)}" x2="${r(tallest.x)}" y2="${r(tallest.y - 26)}"/><circle class="beacon" cx="${r(tallest.x)}" cy="${r(tallest.y - 28)}" r="2.6"/>` : '';

    // road with traffic (cars loop forever, both directions)
    let cars = '';
    for (let i = 0; i < 9; i++) {
      const dir = i % 2 ? -1 : 1, lane = dir > 0 ? ROAD + 9 : ROAD + 4, len = 16 + rnd() * 8;
      const body = `<rect width="${r(len)}" height="5" rx="2"/><rect x="${r(len * .25)}" y="-3" width="${r(len * .45)}" height="4" rx="1.5"/>`;
      const lights = dir > 0 ? `<circle class="head" cx="${r(len)}" cy="2.5" r="1.3"/><circle class="tail" cx="0" cy="2.5" r="1"/>` : `<circle class="head" cx="0" cy="2.5" r="1.3"/><circle class="tail" cx="${r(len)}" cy="2.5" r="1"/>`;
      cars += `<g class="car" style="--dur:${r(16 + rnd() * 14)}s;--delay:-${r(rnd() * 30)}s;--from:${dir > 0 ? -40 : W + 40}px;--to:${dir > 0 ? W + 40 : -40}px"><g transform="translate(0 ${lane - 4})">${body}${lights}</g></g>`;
    }
    const road = `<rect class="road" x="0" y="${ROAD}" width="${W}" height="${H - ROAD}"/>
      <line class="lane" x1="0" y1="${ROAD + 7}" x2="${W}" y2="${ROAD + 7}"/>${cars}`;

    // drifting clouds
    let clouds = '';
    for (let i = 0; i < 4; i++) {
      const y = 40 + rnd() * 60, s = .7 + rnd() * .8;
      clouds += `<g class="cloud" style="--dur:${r(70 + rnd() * 60)}s;--delay:-${r(rnd() * 120)}s"><g transform="translate(0 ${r(y)}) scale(${r(s)})">
        <ellipse cx="40" cy="12" rx="40" ry="10"/><ellipse cx="26" cy="6" rx="18" ry="9"/><ellipse cx="52" cy="4" rx="20" ry="11"/></g></g>`;
    }

    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
      <style>
        .back rect{fill:#24506a;opacity:.45}.front .bld{fill:#0b2130}.win{fill:#e2c47a}
        .slab rect{fill:rgba(201,168,76,.1);stroke:rgba(201,168,76,.6);stroke-width:1.2}.slab path{stroke:rgba(201,168,76,.35);stroke-width:.8;fill:none}
        .slab.done rect{fill:#0d2738;stroke:rgba(201,168,76,.25)}.slab.done path{opacity:0}
        .site-win{fill:#e2c47a}.site-roof{fill:#0d2738;stroke:rgba(201,168,76,.4)}
        .sign rect{fill:#c9a84c}.sign text{font:700 9px 'DM Sans',sans-serif;fill:#0f2530;letter-spacing:.6px}.sign line{stroke:#c9a84c;stroke-width:1.2}
        .steel{stroke:#c9a84c;stroke-width:1.4;fill:none;opacity:.8}.cable{stroke:#c9a84c;stroke-width:1;opacity:.8}
        .cab,.weight{fill:#c9a84c;opacity:.85}.beam{fill:#e2c47a}.beacon{fill:#ff5a4f}
        .road{fill:#08192a}.lane{stroke:rgba(201,168,76,.35);stroke-width:.8;stroke-dasharray:10 12}
        .car rect{fill:#16354a}.head{fill:#fff6d5}.tail{fill:#ff5a4f}.cloud ellipse{fill:#fff;opacity:.05}
      </style>
      <g class="clouds">${clouds}</g>
      <g class="layer back" data-depth=".06">${back}</g>
      <g class="layer front" data-depth=".12">${front}${wins}<g id="site"></g>${crane}${beacon}</g>
      ${road}
    </svg>`;

    const svg = $('svg', host);
    if (!reduceMotion) {
      // gentle parallax while scrolling past the hero
      const layers = $$('.layer', host);
      let ticking = false;
      addEventListener('scroll', () => {
        if (ticking || scrollY > innerHeight * 1.2) return;
        ticking = true;
        requestAnimationFrame(() => { layers.forEach(l => l.setAttribute('transform', `translate(0 ${r(scrollY * l.dataset.depth)})`)); ticking = false; });
      }, { passive: true });
    }
    runConstruction(svg, { ROAD, HX, HOOK_Y, SITE_X: SITE[0] + 28 });
  }

  // ─── CONSTRUCTION LOOP ──────────────────────────────────────────────────────
  async function runConstruction(svg, { ROAD, HX, HOOK_Y, SITE_X }) {
    const site = svg.querySelector('#site'), trolley = svg.querySelector('.trolley');
    const cable = svg.querySelector('.cable'), load = svg.querySelector('.load'), beam = svg.querySelector('.beam');
    const FLOORS = 6, FH = 17, BW = 96, CENTER = SITE_X + BW / 2, OUT = CENTER - HX;
    const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); parent?.appendChild(n); return n; };
    const anim = (node, frames, ms, easing = 'ease-in-out') => node.animate(frames, { duration: ms, easing, fill: 'forwards' }).finished;
    const CABLE_LEN = HOOK_Y - (+cable.getAttribute('y1'));
    [cable, load, trolley].forEach(n => { n.style.transformBox = 'fill-box'; });
    cable.style.transformOrigin = '50% 0';

    function addSlab(i) {
      const y = ROAD - (i + 1) * FH;
      const g = el('g', { class: 'slab' }, site);
      el('rect', { x: SITE_X, y, width: BW, height: FH }, g);
      el('path', { d: [0, 24, 48, 72].map(o => `M${SITE_X + o} ${y + FH} L${SITE_X + o + 24} ${y}`).join(' ') }, g);
      return g;
    }
    // Wait while the hero is off-screen or the tab is hidden, to save battery
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);
    const whenVisible = async () => { while (!visible || document.hidden) await wait(500); };

    if (reduceMotion) { for (let i = 0; i < FLOORS; i++) addSlab(i).classList.add('done'); return; }
    await wait(2200); // let the skyline rise first

    for (;;) {
      site.replaceChildren();
      for (let i = 0; i < FLOORS; i++) {
        await whenVisible();
        // 1. pick up a beam at the mast
        await anim(beam, [{ opacity: 0 }, { opacity: 1 }], 400);
        // 2. carry it over the site
        await anim(trolley, [{ transform: 'translateX(0)' }, { transform: `translateX(${OUT}px)` }], 2300);
        // 3. lower it onto the top of the building
        const drop = (ROAD - i * FH - 8) - HOOK_Y;
        await Promise.all([
          anim(cable, [{ transform: 'scaleY(1)' }, { transform: `scaleY(${(CABLE_LEN + drop) / CABLE_LEN})` }], 1300),
          anim(load, [{ transform: 'translateY(0)' }, { transform: `translateY(${drop}px)` }], 1300),
        ]);
        // 4. the beam becomes a new floor
        beam.getAnimations().forEach(x => x.cancel()); // back to hidden (CSS)
        const slab = addSlab(i);
        slab.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
        // 5. raise the empty hook and return
        await Promise.all([
          anim(cable, [{ transform: `scaleY(${(CABLE_LEN + drop) / CABLE_LEN})` }, { transform: 'scaleY(1)' }], 900),
          anim(load, [{ transform: `translateY(${drop}px)` }, { transform: 'translateY(0)' }], 900),
        ]);
        await anim(trolley, [{ transform: `translateX(${OUT}px)` }, { transform: 'translateX(0)' }], 2000);
      }

      // Finished: cladding, roof, lights on one by one, FOR SALE → SOLD
      await whenVisible();
      const extras = el('g', {}, site);
      [...site.querySelectorAll('.slab')].forEach(s => s.classList.add('done'));
      const topY = ROAD - FLOORS * FH;
      const roof = el('rect', { class: 'site-roof', x: SITE_X + 8, y: topY - 7, width: BW - 16, height: 7 }, extras);
      roof.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'forwards' });
      const lights = [];
      for (let f = 0; f < FLOORS; f++) for (let c = 0; c < 6; c++) {
        lights.push(el('rect', { class: 'site-win', x: SITE_X + 9 + c * 14, y: ROAD - (f + 1) * FH + 5, width: 6, height: 8, rx: 1, opacity: 0 }, extras));
      }
      lights.sort(() => Math.random() - .5).forEach((w, i) => w.animate([{ opacity: 0 }, { opacity: .9 }], { duration: 300, delay: 600 + i * 45, fill: 'forwards' }));
      await wait(600 + lights.length * 45 + 300);

      const sign = el('g', { class: 'sign' }, extras);
      const sy = topY - 34;
      el('line', { x1: CENTER, y1: topY - 7, x2: CENTER, y2: sy + 14 }, sign);
      el('rect', { x: CENTER - 30, y: sy, width: 60, height: 15, rx: 2 }, sign);
      const label = el('text', { x: CENTER, y: sy + 10.5, 'text-anchor': 'middle' }, sign);
      label.textContent = 'FOR SALE';
      sign.style.transformBox = 'fill-box'; sign.style.transformOrigin = '50% 100%';
      await anim(sign, [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1.08)', opacity: 1, offset: .7 }, { transform: 'scaleY(1)', opacity: 1 }], 600, 'ease-out');
      await wait(2200);
      await anim(sign, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], 220, 'ease-in');
      label.textContent = 'SOLD!';
      await anim(sign, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1.15)', offset: .7 }, { transform: 'scaleX(1)' }], 380, 'ease-out');
      await wait(4500);
      await anim(site, [{ opacity: 1 }, { opacity: 0 }], 900);
      site.replaceChildren();
      site.getAnimations().forEach(x => x.cancel());
      await wait(800);
    }
  }

  // Night sky above the skyline: twinkling stars and an occasional shooting star
  function buildSky() {
    const hero = $('.hero'); if (!hero || $('.sky', hero)) return;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 46 }, () =>
      `<circle cx="${(rnd() * 100).toFixed(2)}%" cy="${(rnd() * 55).toFixed(2)}%" r="${(.6 + rnd() * 1.1).toFixed(2)}" style="--tw:${(3 + rnd() * 5).toFixed(1)}s;--d:-${(rnd() * 6).toFixed(1)}s"/>`).join('');
    hero.insertAdjacentHTML('afterbegin', `<svg class="sky" aria-hidden="true">${stars}</svg><span class="shooting-star" aria-hidden="true"></span>`);
  }

  buildSky();

  buildSkyline();
  applyStateToControls();
  renderPortfolio(); renderTestimonials(); animateCounters(); load();
})();
