/**
 * MidLand Constructions — Backend API Server
 * Node.js + Express + Turso (persistent SQLite-compatible DB)
 *
 *   npm install
 *   npm start        ← production
 *   npm run dev      ← development (auto-restart)
 *
 * Required env vars in production (see .env.example):
 *   SESSION_SECRET, ADMIN_PASS (first run only), TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */

require('dotenv').config();
const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@libsql/client');
const { renderPropertyPage, renderNotFound } = require('./views/pages');
const { parsePrice, formatPrice, cityFromLocation } = require('./lib/price');

const app  = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Public business details. Set these in Vercel → Environment Variables so the
// number/email are defined in ONE place and every page picks them up.
const SITE = {
  url:      (process.env.SITE_URL || '').replace(/\/$/, ''),
  whatsapp: process.env.WHATSAPP_NUMBER || '923001234567', // country code, no "+"
  phone:    process.env.CONTACT_PHONE   || '+92 300 1234567',
  email:    process.env.CONTACT_EMAIL   || 'info@midlandpk.com',
  address:  process.env.CONTACT_ADDRESS || 'DHA Phase 6, Lahore',
  hours:    'Mon–Sat, 9:00 AM – 7:00 PM',
};

// Session secret: mandatory in production. Locally, a random per-process
// secret is generated so development "just works" (you'll be logged out on restart).
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  if (IS_PROD) throw new Error('SESSION_SECRET env var is missing or shorter than 32 characters.');
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  SESSION_SECRET not set — using a temporary random secret (dev only).');
}
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const usingTurso = !!process.env.TURSO_DATABASE_URL;
if (!usingTurso && IS_PROD) {
  console.error('❌ TURSO_DATABASE_URL is not set — data will NOT persist on Vercel. See README.md.');
}
// Fallback when Turso isn't configured: a local file. Vercel's code folder is read-only,
// so there the file goes in /tmp — the site works, but data is wiped on every cold start.
const localDbFile = process.env.VERCEL ? '/tmp/midland.sqlite' : path.join(__dirname, 'db.sqlite');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${localDbFile}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const U = (id) => `https://images.unsplash.com/${id}?w=1200&q=75&auto=format&fit=crop`;
const SEED_PROPERTIES = [
  { id: 'S0001', title: 'Luxury Villa – DHA Phase 8', location: 'DHA Phase 8, Karachi', type: 'FOR SALE', category: 'Residential', price_pkr: 120000000, area: '6000', beds: 6, baths: 5, floor: 'G+1',
    images: [U('photo-1613490493576-7fde63acd811'), U('photo-1600607687939-ce8a6c25118c'), U('photo-1600566753086-00f18fb6b3ea'), U('photo-1567767292278-a4f21aa2d36e')],
    desc: "An exceptional 6,000 sq ft villa in the heart of DHA Phase 8, featuring a private swimming pool, home theatre and an imported Italian kitchen. It sits within a gated community with 24/7 security, dedicated parking and a landscaped garden." },
  { id: 'S0002', title: 'Bahria Town Residence', location: 'Bahria Town, Islamabad', type: 'FOR SALE', category: 'Residential', price_pkr: 85000000, area: '5000', beds: 5, baths: 4, floor: 'G+1',
    images: [U('photo-1564013799919-ab600027ffc6'), U('photo-1600585154340-be6161a56a0c')],
    desc: "A double-storey residence set amid Islamabad's hills, with a landscaped garden, underground parking, CCTV surveillance and premium fixtures throughout. Parks, schools and shopping are minutes away." },
  { id: 'R0001', title: 'Luxury Apartment – Gulberg', location: 'Gulberg III, Lahore', type: 'FOR RENT', category: 'Apartment', price_pkr: 250000, area: '2200', beds: 3, baths: 3, floor: '8th Floor',
    images: [U('photo-1502672260266-1c1ef2d93688'), U('photo-1522708323590-d24dbb6b0267')],
    desc: "A fully furnished apartment in Gulberg III with city views from the 8th floor, a rooftop lounge, a fully equipped gym and round-the-clock concierge service." },
  { id: 'R0002', title: 'Family Home – Model Town', location: 'Model Town, Lahore', type: 'FOR RENT', category: 'Residential', price_pkr: 180000, area: '3800', beds: 4, baths: 3, floor: 'G+1',
    images: [U('photo-1600596542815-ffad4c1539a9')],
    desc: "A spacious 4-bedroom family home in Model Town Extension on a quiet tree-lined street, with premium finishes and parks, schools and markets within walking distance." },
  { id: 'R0003', title: 'Studio Apartment – MM Alam', location: 'MM Alam Road, Lahore', type: 'FOR RENT', category: 'Apartment', price_pkr: 60000, area: '900', beds: 1, baths: 1, floor: '4th Floor',
    images: [U('photo-1554995207-c18c203602cb')],
    desc: "A modern, fully furnished studio on MM Alam Road with appliances included and plenty of natural light. Cafes, restaurants and offices are close by." },
  { id: 'C0001', title: 'Commercial Plaza – Main Boulevard', location: 'Main Boulevard, Lahore', type: 'FOR SALE', category: 'Commercial', price_pkr: 250000000, area: '12000', beds: 0, baths: 8, floor: 'G+3',
    images: [U('photo-1486325212027-8081e485255e'), U('photo-1486406146926-c627a92ad1ab')],
    desc: "A G+3 commercial plaza on Main Boulevard with ground-floor retail, offices above, central A/C, full backup power, 3 lifts and ample parking." },
];

async function columnNames(table) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  return rows.map(r => r.name);
}

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, location TEXT NOT NULL,
      type TEXT NOT NULL, category TEXT NOT NULL, price TEXT NOT NULL,
      area TEXT DEFAULT '', beds INTEGER DEFAULT 0, baths INTEGER DEFAULT 0,
      floor TEXT DEFAULT '', img TEXT DEFAULT '', desc TEXT DEFAULT '',
      status TEXT DEFAULT 'available', createdAt TEXT DEFAULT (datetime('now'))
    )`);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
      date TEXT NOT NULL, time TEXT DEFAULT '', purpose TEXT DEFAULT 'General Inquiry',
      msg TEXT DEFAULT '', propertyId TEXT DEFAULT '', propertyName TEXT DEFAULT '',
      confirmed INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime('now'))
    )`);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL
    )`);

  // ── Migrations (safe to run repeatedly) ──
  const cols = await columnNames('properties');
  if (!cols.includes('images'))    await db.execute(`ALTER TABLE properties ADD COLUMN images TEXT DEFAULT '[]'`);
  if (!cols.includes('price_pkr')) await db.execute(`ALTER TABLE properties ADD COLUMN price_pkr INTEGER DEFAULT 0`);
  if (!cols.includes('city'))      await db.execute(`ALTER TABLE properties ADD COLUMN city TEXT DEFAULT ''`);
  // Backfill new columns on old rows
  const { rows: old } = await db.execute(`SELECT id, price, location, img, images, price_pkr, city FROM properties`);
  for (const r of old) {
    const imgs = safeJson(r.images, []);
    const patch = {
      images: imgs.length ? r.images : JSON.stringify(r.img ? [r.img] : []),
      price_pkr: r.price_pkr || parsePrice(r.price),
      city: r.city || cityFromLocation(r.location),
    };
    if (patch.images !== r.images || patch.price_pkr !== r.price_pkr || patch.city !== r.city) {
      await db.execute({ sql: 'UPDATE properties SET images=?, price_pkr=?, city=? WHERE id=?', args: [patch.images, patch.price_pkr, patch.city, r.id] });
    }
  }

  const { rows: propCount } = await db.execute('SELECT COUNT(*) as count FROM properties');
  if (Number(propCount[0].count) === 0) {
    for (const p of SEED_PROPERTIES) await insertProperty({ ...p, status: 'available' });
    console.log(`🏠 Seeded ${SEED_PROPERTIES.length} starter properties`);
  }

  const { rows: adminCount } = await db.execute('SELECT COUNT(*) as count FROM admins');
  if (Number(adminCount[0].count) === 0) {
    let pass = process.env.ADMIN_PASS;
    if (!pass) {
      if (IS_PROD) { console.error('❌ No admin exists and ADMIN_PASS is not set — set it in Vercel and redeploy.'); return; }
      pass = crypto.randomBytes(9).toString('base64url');
      console.log(`🔑 Dev admin created → username: ${process.env.ADMIN_USER || 'admin'} | password: ${pass}`);
    }
    await db.execute({
      sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      args: [process.env.ADMIN_USER || 'admin', bcrypt.hashSync(pass, 10)],
    });
    console.log('✅ First admin account created. Change the password from the admin panel → Settings.');
  }
}
const dbReady = initDb();
dbReady.catch(err => console.error('❌ Database init failed:', err.message));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function safeJson(s, fallback) { try { const v = JSON.parse(s); return v ?? fallback; } catch { return fallback; } }
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const int = (v, min = 0, max = 1e12) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : 0; };
const isHttpUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(u);
const TYPES = ['FOR SALE', 'FOR RENT'];
const CATEGORIES = ['Residential', 'Commercial', 'Apartment', 'Plot'];
const STATUSES = ['available', 'sold', 'rented'];

function hydrate(row) {
  if (!row) return row;
  const images = safeJson(row.images, []);
  return { ...row, images: images.length ? images : (row.img ? [row.img] : []), price_pkr: Number(row.price_pkr) || 0, beds: Number(row.beds) || 0, baths: Number(row.baths) || 0 };
}

/** Validates/normalises a property payload. Returns { error } or { value }. */
function cleanProperty(body, { partial = false } = {}) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('title'))    { out.title = str(body.title, 120); if (!out.title) return { error: 'Title is required' }; }
  if (!partial || has('location')) { out.location = str(body.location, 160); if (!out.location) return { error: 'Location is required' }; }
  if (!partial || has('type'))     { out.type = TYPES.includes(body.type) ? body.type : 'FOR SALE'; }
  if (!partial || has('category')) { out.category = CATEGORIES.includes(body.category) ? body.category : 'Residential'; }
  if (has('city') || !partial)     { out.city = str(body.city, 60) || (out.location ? cityFromLocation(out.location) : ''); }
  if (has('price_pkr') || has('price') || !partial) {
    out.price_pkr = Math.min(parsePrice(body.price_pkr ?? body.price), 1e12);
    if (!out.price_pkr) return { error: 'A valid price is required' };
  }
  if (has('area') || !partial)  out.area  = str(body.area, 20).replace(/[^\d.]/g, '');
  if (has('beds') || !partial)  out.beds  = int(body.beds, 0, 50);
  if (has('baths') || !partial) out.baths = int(body.baths, 0, 50);
  if (has('floor') || !partial) out.floor = str(body.floor, 30);
  if (has('desc') || !partial)  out.desc  = str(body.desc, 4000);
  if (has('status')) { if (!STATUSES.includes(body.status)) return { error: 'Invalid status' }; out.status = body.status; }
  if (has('images') || has('img') || !partial) {
    const raw = (Array.isArray(body.images) ? body.images : [body.img]).map(u => str(u, 600)).filter(Boolean);
    if (raw.some(u => !isHttpUrl(u))) return { error: 'Every image must be a valid http(s) URL' };
    out.images = raw.length ? raw.slice(0, 20) : ['/assets/placeholder.svg'];
  }
  return { value: out };
}

async function insertProperty(p) {
  const type = p.type || 'FOR SALE';
  const price = formatPrice(p.price_pkr, type);
  await db.execute({
    sql: `INSERT INTO properties (id, title, location, city, type, category, price, price_pkr, area, beds, baths, floor, img, images, desc, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [p.id, p.title, p.location, p.city || cityFromLocation(p.location), type, p.category || 'Residential', price, p.price_pkr,
      p.area || '', p.beds || 0, p.baths || 0, p.floor || '', p.images[0] || '', JSON.stringify(p.images), p.desc || '', p.status || 'available'],
  });
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel sits behind a proxy — needed for real client IPs
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
// Site and API share one origin, so no CORS headers are sent (other sites can't call the API from a browser).
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: IS_PROD ? '1h' : 0, extensions: ['html'] }));
app.use((req, res, next) => {
  dbReady.then(() => next(), (err) => {
    console.error('DB unavailable:', err.message);
    if (!req.path.startsWith('/api')) return next();
    res.status(503).json({ error: 'Database unavailable — check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel, then redeploy.' });
  });
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Simple in-memory rate limiter. On Vercel each instance has its own counter, so this
// slows abuse down rather than guaranteeing a hard limit.
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}|${req.path}`, now = Date.now();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    recent.push(now); hits.set(key, recent);
    req.resetRateLimit = () => hits.delete(key);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
    next();
  };
}

// ─── AUTH (signed, stateless token) ───────────────────────────────────────────
function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig || ''), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp && payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}
function requireAdmin(req, res, next) {
  const payload = verifyToken(req.headers['x-admin-token']);
  if (!payload) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  req.admin = payload;
  next();
}

app.post('/api/admin/login', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  const username = str(req.body?.username, 60), password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE username = ?', args: [username] });
    const admin = rows[0];
    if (!admin && Number((await db.execute('SELECT COUNT(*) as n FROM admins')).rows[0].n) === 0)
      return res.status(503).json({ error: 'No admin account exists yet — set ADMIN_PASS in Vercel and redeploy.' });
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      console.warn(`⚠️  Failed login for "${username}" from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.resetRateLimit?.(); // only failed attempts count towards the limit
    const token = signToken({ id: admin.id, username: admin.username, exp: Date.now() + SESSION_MAX_AGE_MS });
    res.json({ success: true, token, username: admin.username });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => res.json({ success: true }));

app.patch('/api/admin/change-password', requireAdmin, rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 10)
    return res.status(400).json({ error: 'New password must be at least 10 characters.' });
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE id=?', args: [req.admin.id] });
    const admin = rows[0];
    if (!admin || !bcrypt.compareSync(String(currentPassword || ''), admin.password_hash))
      return res.status(401).json({ error: 'Current password is incorrect.' });
    await db.execute({ sql: 'UPDATE admins SET password_hash=? WHERE id=?', args: [bcrypt.hashSync(String(newPassword), 10), req.admin.id] });
    res.json({ success: true });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ whatsapp: SITE.whatsapp, phone: SITE.phone, email: SITE.email, address: SITE.address, hours: SITE.hours });
});

async function genPropId(type, category) {
  const prefix = category === 'Commercial' ? 'C' : (type === 'FOR RENT' ? 'R' : 'S');
  const { rows } = await db.execute({ sql: 'SELECT id FROM properties WHERE id LIKE ?', args: [prefix + '%'] });
  const nums = rows.map(r => parseInt(String(r.id).slice(1), 10) || 0);
  return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}

app.get('/api/properties', async (req, res) => {
  try {
    let sql = "SELECT * FROM properties WHERE status = 'available'";
    const args = [];
    if (TYPES.includes(req.query.type)) { sql += ' AND type = ?'; args.push(req.query.type); }
    sql += ' ORDER BY createdAt DESC';
    const { rows } = await db.execute({ sql, args });
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json(rows.map(hydrate));
  } catch (err) {
    console.error('Query error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

async function getAvailableProperty(id) {
  const { rows } = await db.execute({ sql: "SELECT * FROM properties WHERE id = ? AND status = 'available'", args: [String(id)] });
  return hydrate(rows[0]);
}

app.get('/api/properties/:id', async (req, res) => {
  try {
    const p = await getAvailableProperty(req.params.id);
    if (!p) return res.status(404).json({ error: 'Property not found' });
    res.json(p);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

const PURPOSES = ['Buy a Property', 'Rent a Property', 'Sell My Property', 'Construction Consultation', 'Investment Inquiry', 'General Inquiry'];
const TIMES = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'];

app.post('/api/appointments', rateLimit(5, 60 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.status(201).json({ success: true, id: uuidv4() }); // honeypot: silently drop bots
  const c = {
    name: str(b.name, 80), email: str(b.email, 120).toLowerCase(), phone: str(b.phone, 20),
    date: str(b.date, 10), time: TIMES.includes(b.time) ? b.time : '',
    purpose: PURPOSES.includes(b.purpose) ? b.purpose : 'General Inquiry',
    msg: str(b.msg, 1000), propertyId: str(b.propertyId, 10),
  };
  const errors = {};
  if (c.name.length < 2) errors.name = 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) errors.email = 'Please enter a valid email address.';
  if (!/^\+?[0-9][0-9\s-]{8,16}$/.test(c.phone)) errors.phone = 'Please enter a valid phone number, e.g. 0300 1234567.';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? new Date(c.date + 'T00:00:00Z') : null;
  const todayPk = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); // Pakistan time (UTC+5)
  if (!d || isNaN(d)) errors.date = 'Please choose a date.';
  else if (c.date < todayPk) errors.date = 'Please choose a date from today onwards.';
  else if (d.getUTCDay() === 0) errors.date = 'We are closed on Sundays — please pick Monday to Saturday.';
  else if ((d - new Date(todayPk + 'T00:00:00Z')) / 864e5 > 180) errors.date = 'Please choose a date within the next 6 months.';
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], errors });

  try {
    let propertyName = '';
    if (c.propertyId) {
      const p = await getAvailableProperty(c.propertyId);
      if (p) propertyName = p.title; else c.propertyId = '';
    }
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO appointments (id, name, email, phone, date, time, purpose, msg, propertyId, propertyName, confirmed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [id, c.name, c.email, c.phone, c.date, c.time, c.purpose, c.msg, c.propertyId, propertyName],
    });
    console.log(`📅 Appointment booked for ${c.date}${c.propertyId ? ' (property ' + c.propertyId + ')' : ''}`);
    res.status(201).json({ success: true, id, ref: id.slice(0, 8).toUpperCase(), propertyName });
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ error: 'Server error — please try again or contact us on WhatsApp.' });
  }
});

// ─── ADMIN: PROPERTIES ────────────────────────────────────────────────────────
app.get('/api/admin/properties', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM properties ORDER BY createdAt DESC');
    res.json(rows.map(hydrate));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/properties', requireAdmin, async (req, res) => {
  const { error, value } = cleanProperty(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const id = await genPropId(value.type, value.category);
    await insertProperty({ ...value, id, status: 'available' });
    const { rows } = await db.execute({ sql: 'SELECT * FROM properties WHERE id=?', args: [id] });
    console.log(`🏠 Property added: ${id}`);
    res.status(201).json(hydrate(rows[0]));
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/admin/properties/:id', requireAdmin, async (req, res) => {
  const { error, value } = cleanProperty(req.body || {}, { partial: true });
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM properties WHERE id=?', args: [req.params.id] });
    const current = rows[0];
    if (!current) return res.status(404).json({ error: 'Property not found' });
    if (value.images) { value.img = value.images[0]; value.images = JSON.stringify(value.images); }
    if (value.price_pkr !== undefined || value.type !== undefined)
      value.price = formatPrice(value.price_pkr ?? current.price_pkr, value.type ?? current.type);
    const keys = Object.keys(value);
    if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });
    await db.execute({ sql: `UPDATE properties SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`, args: [...keys.map(k => value[k]), req.params.id] });
    const { rows: updated } = await db.execute({ sql: 'SELECT * FROM properties WHERE id=?', args: [req.params.id] });
    res.json(hydrate(updated[0]));
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/properties/:id', requireAdmin, async (req, res) => {
  try {
    const r = await db.execute({ sql: 'DELETE FROM properties WHERE id=?', args: [req.params.id] });
    if (!r.rowsAffected) return res.status(404).json({ error: 'Property not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── ADMIN: APPOINTMENTS ──────────────────────────────────────────────────────
app.get('/api/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM appointments ORDER BY date ASC, createdAt DESC');
    res.json(rows.map(a => ({ ...a, confirmed: !!a.confirmed })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Bulk delete requires an explicit confirmation phrase so it can't happen by accident.
app.delete('/api/admin/appointments', requireAdmin, async (req, res) => {
  if ((req.body || {}).confirm !== 'DELETE ALL') return res.status(400).json({ error: 'Confirmation phrase required' });
  try {
    const r = await db.execute('DELETE FROM appointments');
    console.log(`🗑  Cleared ${r.rowsAffected} appointments (by ${req.admin.username})`);
    res.json({ success: true, cleared: r.rowsAffected });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: 'SELECT id FROM appointments WHERE id=?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    if (req.body?.confirmed !== undefined)
      await db.execute({ sql: 'UPDATE appointments SET confirmed=? WHERE id=?', args: [req.body.confirmed ? 1 : 0, req.params.id] });
    const { rows: updated } = await db.execute({ sql: 'SELECT * FROM appointments WHERE id=?', args: [req.params.id] });
    res.json({ ...updated[0], confirmed: !!updated[0].confirmed });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const r = await db.execute({ sql: 'DELETE FROM appointments WHERE id=?', args: [req.params.id] });
    if (!r.rowsAffected) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const q = async (sql) => Number((await db.execute(sql)).rows[0].n);
    res.json({
      totalProperties:   await q('SELECT COUNT(*) as n FROM properties'),
      available:         await q("SELECT COUNT(*) as n FROM properties WHERE status='available'"),
      sold:              await q("SELECT COUNT(*) as n FROM properties WHERE status='sold'"),
      rented:            await q("SELECT COUNT(*) as n FROM properties WHERE status='rented'"),
      totalAppointments: await q('SELECT COUNT(*) as n FROM appointments'),
      newAppointments:   await q('SELECT COUNT(*) as n FROM appointments WHERE confirmed=0'),
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/health', async (req, res) => {
  try {
    const n = async (t) => Number((await db.execute(`SELECT COUNT(*) as n FROM ${t}`)).rows[0].n);
    res.json({ status: 'ok', persistentDb: usingTurso, properties: await n('properties'), appointments: await n('appointments') });
  } catch { res.status(500).json({ status: 'error' }); }
});

// ─── SERVER-RENDERED PAGES (SEO + rich WhatsApp previews) ─────────────────────
const baseUrl = (req) => SITE.url || `${req.protocol}://${req.get('host')}`;

app.get('/property/:id', async (req, res, next) => {
  try {
    const p = await getAvailableProperty(req.params.id);
    if (!p) return res.status(404).send(renderNotFound(SITE));
    const { rows } = await db.execute({
      sql: "SELECT * FROM properties WHERE status='available' AND id != ? ORDER BY (type = ?) DESC, createdAt DESC LIMIT 3",
      args: [p.id, p.type],
    });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
    res.send(renderPropertyPage(p, rows.map(hydrate), SITE, baseUrl(req)));
  } catch (err) { next(err); }
});

const legal = require('./views/legal');
app.get('/privacy', (req, res) => res.send(legal.privacy(SITE)));
app.get('/terms', (req, res) => res.send(legal.terms(SITE)));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res) => {
  const base = baseUrl(req);
  const { rows } = await db.execute("SELECT id, createdAt FROM properties WHERE status='available'");
  const urls = [`${base}/`, `${base}/privacy`, `${base}/terms`, ...rows.map(r => `${base}/property/${r.id}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`);
});

// Unknown API routes → JSON 404; unknown pages → a real 404 page (not the homepage).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) => res.status(404).send(renderNotFound(SITE)));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path.startsWith('/api')) return res.status(500).json({ error: 'Server error' });
  res.status(500).send('Something went wrong. Please try again.');
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🏠 MidLand Constructions running`);
    console.log(`   Website → http://localhost:${PORT}`);
    console.log(`   Admin   → http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
