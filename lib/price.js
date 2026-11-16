// Shared price helpers. Prices are stored as a whole number of rupees (price_pkr)
// so they can be filtered and sorted; the display text is generated from it.

/** "PKR 8.5 Crore" → 85000000, "2.5 Lac/mo" → 250000, "60K/mo" → 60000, "1,500,000" → 1500000 */
function parsePrice(text) {
  if (text === undefined || text === null) return 0;
  const s = String(text).toLowerCase().replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (/crore|\bcr\b/.test(s)) return Math.round(n * 1e7);
  if (/lac|lakh|lacs|\blk\b/.test(s)) return Math.round(n * 1e5);
  if (/\d\s*k\b|thousand/.test(s)) return Math.round(n * 1e3);
  if (/million|\bm\b/.test(s)) return Math.round(n * 1e6);
  return Math.round(n);
}

const trim = (n) => String(Number(n.toFixed(2)));

/** 85000000 → "PKR 8.5 Crore"; rentals get "/mo". */
function formatPrice(pkr, type) {
  const n = Number(pkr) || 0;
  let s;
  if (n >= 1e7) s = `PKR ${trim(n / 1e7)} Crore`;
  else if (n >= 1e5) s = `PKR ${trim(n / 1e5)} Lac`;
  else if (n >= 1e3) s = `PKR ${trim(n / 1e3)}K`;
  else s = `PKR ${n.toLocaleString('en-US')}`;
  return type === 'FOR RENT' ? `${s}/mo` : s;
}

/** "Gulberg III, Lahore" → "Lahore" */
function cityFromLocation(loc) {
  const parts = String(loc || '').split(',').map(x => x.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

module.exports = { parsePrice, formatPrice, cityFromLocation };
