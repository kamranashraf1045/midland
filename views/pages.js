// Server-rendered pages: property detail (for SEO + rich WhatsApp/Facebook previews) and 404.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="/assets/icons.svg#${n}"/></svg>`;
// JSON inside <script> must not be able to close the tag
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function layout({ title, description, canonical, image, head = '', body, site, bookHref = '/#appointment' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0f2530">
<link rel="icon" href="/assets/logo.jpg">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:site_name" content="MidLand Constructions">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
${image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${head}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="nav scrolled">
  <a class="brand" href="/" aria-label="MidLand Constructions — home">
    <img class="brand-logo" src="/assets/logo.jpg" alt="" width="44" height="44">
    <span><span class="brand-name">MidLand Constructions</span><br><span class="brand-tag">Building Dreams Since 1995</span></span>
  </a>
  <button class="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${icon('menu')}</button>
  <nav aria-label="Main"><ul class="nav-links" id="nav-links">
    <li><a href="/#properties">Properties</a></li><li><a href="/#portfolio">Our Work</a></li>
    <li><a href="/#why-us">Why Us</a></li><li><a class="nav-cta" href="${bookHref}">Book a Visit</a></li>
  </ul></nav>
</header>
<main id="main">${body}</main>
<footer class="footer">
  <div class="footer-bottom" style="border:0;padding:0">
    <span>© <span data-year>${new Date().getFullYear()}</span> MidLand Constructions · <span data-cfg="phone">${esc(site.phone)}</span> · <span data-cfg="hours">${esc(site.hours)}</span></span>
    <span><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a></span>
  </div>
</footer>
<a class="wa-float" data-wa="Assalam o Alaikum! I'm interested in a property on your website." href="https://wa.me/${esc(site.whatsapp)}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">${icon('whatsapp')}</a>
<script src="/assets/app.js"></script>
</body>
</html>`;
}

function renderPropertyPage(p, related, site, base) {
  const url = `${base}/property/${encodeURIComponent(p.id)}`;
  const imgs = p.images.length ? p.images : ['/assets/placeholder.svg'];
  const absImg = (u) => (u.startsWith('http') ? u : base + u);
  const isRent = p.type === 'FOR RENT';
  const specs = [
    p.beds ? ['bed', p.beds, 'Bedrooms'] : null,
    p.baths ? ['bath', p.baths, 'Bathrooms'] : null,
    p.area ? ['area', Number(p.area).toLocaleString('en-US'), 'Sq ft'] : null,
    p.floor ? ['layers', p.floor, 'Floors / level'] : null,
  ].filter(Boolean);
  const shareText = `${p.title}\n${p.location}\n${p.price}\n\n${url}`;
  const description = `${p.price} · ${p.category} ${isRent ? 'for rent' : 'for sale'} in ${p.location}${p.beds ? ` · ${p.beds} bed` : ''}${p.area ? ` · ${p.area} sq ft` : ''}. ${String(p.desc || '').slice(0, 120)}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing', name: p.title, url, description: p.desc,
    image: imgs.map(absImg), datePosted: String(p.createdAt || '').slice(0, 10) || undefined,
    offers: { '@type': 'Offer', price: p.price_pkr, priceCurrency: 'PKR', businessFunction: isRent ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell' },
    about: { '@type': p.category === 'Commercial' ? 'Place' : 'House', address: { '@type': 'PostalAddress', streetAddress: p.location, addressLocality: p.city, addressCountry: 'PK' },
      ...(p.beds ? { numberOfRooms: p.beds } : {}), ...(p.area ? { floorSize: { '@type': 'QuantitativeValue', value: Number(p.area), unitCode: 'FTK' } } : {}) },
  };
  const client = { id: p.id, title: p.title, location: p.location, type: p.type, images: imgs.slice(0, 1) };

  const gallery = `<div class="gallery${imgs.length === 1 ? ' single' : ''}">
    ${imgs.slice(0, 3).map((src, i) => `<button type="button" data-photo="${i}" aria-label="Open photo ${i + 1} of ${imgs.length}">
      <img src="${esc(src)}" alt="${esc(p.title)} — photo ${i + 1}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} onerror="this.src='/assets/placeholder.svg'">
      ${i === 2 && imgs.length > 3 ? `<span class="more">+${imgs.length - 3} more photos</span>` : ''}</button>`).join('')}
  </div>`;

  const body = `
  <section class="page-top" style="padding-bottom:40px">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/?type=${encodeURIComponent(p.type)}#properties">${isRent ? 'For rent' : 'For sale'}</a><span aria-hidden="true">/</span><span aria-current="page">#${esc(p.id)}</span></nav>
      ${gallery}
      <div class="detail-grid">
        <article class="detail">
          <span class="chip" style="position:static;display:inline-block;margin-bottom:12px">${isRent ? 'For Rent' : 'For Sale'} · ${esc(p.category)}</span>
          <h1>${esc(p.title)}</h1>
          <p class="loc">${icon('pin')} ${esc(p.location)}</p>
          <div class="price">${esc(p.price)}<small>Listing #${esc(p.id)}</small></div>
          ${specs.length ? `<div class="spec-grid">${specs.map(([ic, v, l]) => `<div class="spec-box">${icon(ic, 'ic ic-lg')}<b>${esc(v)}</b><span>${l}</span></div>`).join('')}</div>` : ''}
          <div class="side-actions" style="max-width:420px">
            <a class="btn btn-wa" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">${icon('share')} Share on WhatsApp</a>
            <button class="btn btn-ghost" type="button" data-fav="${esc(p.id)}" aria-pressed="false" aria-label="Save to favourites: ${esc(p.title)}">${icon('heart')} Save</button>
          </div>
          ${p.desc ? `<h2>About this property</h2><p class="desc">${esc(p.desc)}</p>` : ''}
          <h2>Location</h2>
          <iframe class="map" title="Map of ${esc(p.location)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=${encodeURIComponent(p.location + ', Pakistan')}&output=embed"></iframe>
        </article>
        <aside class="sticky" id="book" aria-label="Book a viewing">
          <div class="form-card" data-booking data-locked></div>
        </aside>
      </div>
    </div>
  </section>
  ${related.length ? `<section style="background:#fff;padding-top:64px">
    <div class="container">
      <div class="section-head"><div><div class="eyebrow">You may also like</div><h2 class="h2">Similar <em>properties</em></h2></div>
        <a class="btn btn-ghost" href="/#properties">All properties ${icon('arrow-r')}</a></div>
      <div class="grid-3" id="related"></div>
    </div></section>` : ''}
  <script>window.__PROPERTY__=${safeJson(client)};window.__PHOTOS__=${safeJson(imgs)};window.__RELATED__=${safeJson(related)};</script>
  <script>
  document.addEventListener('DOMContentLoaded', function () {
    var MC = window.MC, title = ${safeJson(p.title)};
    document.querySelectorAll('[data-photo]').forEach(function (b) {
      b.addEventListener('click', function () {
        MC.openLightbox(window.__PHOTOS__.map(function (src, i) { return { src: src, alt: title + ' — photo ' + (i + 1) }; }), +b.dataset.photo);
      });
    });
    var fav = document.querySelector('.detail [data-fav]');
    if (fav && MC.favs.has(fav.dataset.fav)) { fav.setAttribute('aria-pressed', 'true'); fav.setAttribute('aria-label', fav.getAttribute('aria-label').replace('Save to', 'Remove from')); }
    var rel = document.getElementById('related');
    if (rel) { rel.innerHTML = window.__RELATED__.map(MC.propertyCard).join(''); MC.observeReveal(rel); }
  });
  </script>`;

  return layout({
    title: `${p.title} – ${p.price} | MidLand Constructions`, description, canonical: url, image: absImg(imgs[0]), site, body, bookHref: '#book',
    head: `<script type="application/ld+json">${safeJson(ld)}</script>`,
  });
}

function renderNotFound(site) {
  return layout({
    title: 'Page not found | MidLand Constructions', description: 'This page could not be found.', site,
    head: '<meta name="robots" content="noindex">',
    body: `<section class="page-top" style="min-height:70vh;display:flex;align-items:center">
      <div class="container center">
        <div class="eyebrow">404</div>
        <h1 class="h2">This page <em>isn't here</em></h1>
        <p class="lead">The listing may have been sold or rented, or the link may be wrong.</p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap">
          <a class="btn btn-teal" href="/#properties">Browse properties</a><a class="btn btn-ghost" href="/">Go home</a>
        </div>
      </div></section>`,
  });
}

module.exports = { renderPropertyPage, renderNotFound, layout };
