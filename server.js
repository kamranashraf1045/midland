/**
 * ╔══════════════════════════════════════════════════════════════╗
 *   MidLand Constructions — Backend API Server
 *   Node.js + Express + Turso (persistent SQLite-compatible DB)
 *
 *   HOW TO RUN:
 *     npm install
 *     npm start           ← production
 *     npm run dev         ← development (auto-restart)
 *
 *   Website : http://localhost:3001
 *   Admin   : http://localhost:3001/admin.html
 *   Login   : admin / midland2025   (change this after first login!)
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@libsql/client');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────
// Uses Turso (hosted, persistent SQLite) when TURSO_DATABASE_URL is set.
// Falls back to a local file for local development only — this does NOT
// persist reliably on Vercel, so production MUST set the Turso env vars.
const usingTurso = !!process.env.TURSO_DATABASE_URL;
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'db.sqlite')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

if (!usingTurso && process.env.VERCEL) {
  console.warn('⚠️  No TURSO_DATABASE_URL set — data will NOT persist on Vercel. See README.md.');
}

const SEED_PROPERTIES = [
  { id: 'S0001', title: "Luxury Villa – DHA Phase 8", location: "DHA Phase 8, Karachi", type: "FOR SALE", category: "Residential", price: "PKR 12 Crore", area: "6000", beds: 6, baths: 5, floor: "G+1", img: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600", desc: "An exceptional 6,000 sq ft villa set in the heart of DHA Phase 8. Featuring a private swimming pool, home theatre, and an imported Italian kitchen, this residence sits within one of Pakistan's finest gated communities. Complete with 24/7 security, dedicated parking, and a beautifully landscaped garden — a true dream home." },
  { id: 'S0002', title: "Bahria Town Residence", location: "Bahria Town, Islamabad", type: "FOR SALE", category: "Residential", price: "PKR 8.5 Crore", area: "5000", beds: 5, baths: 4, floor: "G+1", img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600", desc: "Set amid Islamabad's scenic hills, this double-storey residence in Bahria Town offers a world of its own. Built with a landscaped garden, underground parking, CCTV surveillance, and premium fixtures throughout, it's designed for families who value both quality and security. Parks, top schools, and shopping malls are all just minutes away." },
  { id: 'R0001', title: "Luxury Apartment – Gulberg", location: "Gulberg III, Lahore", type: "FOR RENT", category: "Apartment", price: "PKR 2.5 Lac/mo", area: "2200", beds: 3, baths: 3, floor: "8th Floor", img: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600", desc: "This fully furnished luxury apartment is available for rent in Gulberg III — Lahore's most sought-after address. Enjoy breathtaking city views from the 8th floor, a rooftop lounge, a fully equipped gym, and round-the-clock concierge service. For anyone who truly wants to live in the heart of the city, this apartment is the perfect fit." },
  { id: 'R0002', title: "Family Home – Model Town", location: "Model Town, Lahore", type: "FOR RENT", category: "Residential", price: "PKR 1.8 Lac/mo", area: "3800", beds: 4, baths: 3, floor: "G+1", img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600", desc: "A spacious 4-bedroom family home in Model Town Extension, ideal for those seeking a peaceful, secure, and welcoming neighbourhood. Mature trees line the street outside, premium finishes furnish the interior, and parks, schools, and markets are all within easy walking distance." },
  { id: 'R0003', title: "Studio Apartment – MM Alam", location: "MM Alam Road, Lahore", type: "FOR RENT", category: "Apartment", price: "PKR 60K/mo", area: "900", beds: 1, baths: 1, floor: "4th Floor", img: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=600", desc: "A modern studio apartment on MM Alam Road — one of Lahore's most vibrant streets — built for young professionals who want to live life on their own terms. Fully furnished with appliances included, and filled with natural light on the 4th floor. Cafes, restaurants, and offices are all close by." },
  { id: 'C0001', title: "Commercial Plaza – Main Boulevard", location: "Main Boulevard, Lahore", type: "FOR SALE", category: "Commercial", price: "PKR 25 Crore", area: "12000", beds: 0, baths: 8, floor: "G+3", img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600", desc: "A G+3 commercial plaza on Main Boulevard, positioned in one of Pakistan's most prominent business districts. Ground-floor retail space, premium offices on the upper floors, central A/C, full backup power, 3 lifts, and ample parking. A rare opportunity for investors and business owners alike." },
];

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS properties (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      location    TEXT NOT NULL,
      type        TEXT NOT NULL,
      category    TEXT NOT NULL,
      price       TEXT NOT NULL,
      area        TEXT DEFAULT '',
      beds        INTEGER DEFAULT 0,
      baths       INTEGER DEFAULT 0,
      floor       TEXT DEFAULT '',
      img         TEXT DEFAULT '',
      desc        TEXT DEFAULT '',
      status      TEXT DEFAULT 'available',
      createdAt   TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appointments (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL,
      phone         TEXT NOT NULL,
      date          TEXT NOT NULL,
      time          TEXT DEFAULT '',
      purpose       TEXT DEFAULT 'General Inquiry',
      msg           TEXT DEFAULT '',
      propertyId    TEXT DEFAULT '',
      propertyName  TEXT DEFAULT '',
      confirmed     INTEGER DEFAULT 0,
      createdAt     TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  const { rows: propCount } = await db.execute('SELECT COUNT(*) as count FROM properties');
  if (propCount[0].count === 0) {
    for (const p of SEED_PROPERTIES) {
      await db.execute({
        sql: `INSERT INTO properties (id, title, location, type, category, price, area, beds, baths, floor, img, desc, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
        args: [p.id, p.title, p.location, p.type, p.category, p.price, p.area, p.beds, p.baths, p.floor, p.img, p.desc],
      });
    }
    console.log(`🏠 Seeded ${SEED_PROPERTIES.length} starter properties`);
  }

  const { rows: adminCount } = await db.execute('SELECT COUNT(*) as count FROM admins');
  if (adminCount[0].count === 0) {
    const defaultPass = process.env.ADMIN_PASS || 'midland2025';
    const hash = bcrypt.hashSync(defaultPass, 10);
    await db.execute({
      sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      args: [process.env.ADMIN_USER || 'admin', hash],
    });
    console.log(`✅ Default admin created → username: ${process.env.ADMIN_USER || 'admin'} | password: ${defaultPass}`);
    console.log('   ⚠️  Change this password immediately after first login!');
  }
}
const dbReady = initDb().catch(err => console.error('❌ Database init failed:', err.message));

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => { dbReady.then(() => next()).catch(next); });

// Request logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── STATELESS AUTH (signed token — no server-side session store) ────────────
// Vercel functions are stateless and ephemeral: tokens kept in an in-memory
// Set() (the original approach) vanish on every cold start / restart and
// differ between concurrent instances, causing unpredictable "logged out"
// behaviour. A signed token carries everything needed to verify itself, so
// there's nothing server-side that can go missing between requests.
const SESSION_SECRET = process.env.SESSION_SECRET || 'midland-secret-change-me-in-production';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized. Please log in via /api/admin/login' });
  req.admin = payload;
  next();
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE username = ?', args: [username] });
    const admin = rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      console.warn(`⚠️  Failed login for "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ id: admin.id, username: admin.username, exp: Date.now() + SESSION_MAX_AGE_MS });
    console.log(`✅ Admin logged in`);
    res.json({ success: true, token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  // Stateless tokens can't be revoked server-side; the frontend discards it.
  res.json({ success: true });
});

app.patch('/api/admin/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM admins WHERE id=?', args: [req.admin.id] });
    const admin = rows[0];
    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash))
      return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.execute({ sql: 'UPDATE admins SET password_hash=? WHERE id=?', args: [hash, req.admin.id] });
    res.json({ success: true });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PROPERTY ID GENERATOR ────────────────────────────────────────────────────
async function genPropId(type, category) {
  const prefix = category === 'Commercial' ? 'C' : (type === 'FOR RENT' ? 'R' : 'S');
  const { rows } = await db.execute({ sql: `SELECT id FROM properties WHERE id LIKE ?`, args: [prefix + '%'] });
  const nums = rows.map(r => parseInt(r.id.slice(1)) || 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return prefix + String(next).padStart(4, '0');
}

// ─── PUBLIC: PROPERTIES ────────────────────────────────────────────────────────
app.get('/api/properties', async (req, res) => {
  try {
    let sql = "SELECT * FROM properties WHERE status = 'available'";
    const args = [];
    if (req.query.type && req.query.type !== 'all') {
      sql += ' AND type = ?';
      args.push(req.query.type);
    }
    sql += ' ORDER BY createdAt DESC';
    const { rows } = await db.execute({ sql, args });
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const { rows } = await db.execute({
      sql: "SELECT * FROM properties WHERE id = ? AND status = 'available'",
      args: [req.params.id],
    });
    if (!rows[0]) return res.status(404).json({ error: 'Property not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: PROPERTIES ────────────────────────────────────────────────────────
app.get('/api/admin/properties', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM properties ORDER BY createdAt DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/properties', requireAdmin, async (req, res) => {
  const { title, location, type, category, price, area, beds, baths, floor, img, desc } = req.body;
  if (!title || !location || !price)
    return res.status(400).json({ error: 'title, location, and price are required' });
  try {
    const id = await genPropId(type || 'FOR SALE', category || 'Residential');
    const prop = {
      id, title, location,
      type: type || 'FOR SALE',
      category: category || 'Residential',
      price, area: area || '',
      beds: parseInt(beds) || 0,
      baths: parseInt(baths) || 0,
      floor: floor || '',
      img: img || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600',
      desc: desc || '',
    };
    await db.execute({
      sql: `INSERT INTO properties (id, title, location, type, category, price, area, beds, baths, floor, img, desc, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      args: [prop.id, prop.title, prop.location, prop.type, prop.category, prop.price, prop.area, prop.beds, prop.baths, prop.floor, prop.img, prop.desc],
    });
    console.log(`🏠 Property added: "${title}"`);
    res.status(201).json({ ...prop, status: 'available' });
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/admin/properties/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const allowed = ['status', 'title', 'price', 'desc', 'img', 'area', 'floor'];
  const updates = [], args = [];
  allowed.forEach(k => { if (req.body[k] !== undefined) { updates.push(`${k}=?`); args.push(req.body[k]); } });
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM properties WHERE id=?', args: [id] });
    if (!rows[0]) return res.status(404).json({ error: 'Property not found' });
    args.push(id);
    await db.execute({ sql: `UPDATE properties SET ${updates.join(',')} WHERE id=?`, args });
    const { rows: updated } = await db.execute({ sql: 'SELECT * FROM properties WHERE id=?', args: [id] });
    console.log(`✏️  Property updated: "${updated[0].title}" → ${JSON.stringify(req.body)}`);
    res.json(updated[0]);
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/properties/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM properties WHERE id=?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Property not found' });
    await db.execute({ sql: 'DELETE FROM properties WHERE id=?', args: [req.params.id] });
    console.log(`🗑  Property removed: "${rows[0].title}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUBLIC: APPOINTMENTS ─────────────────────────────────────────────────────
app.post('/api/appointments', async (req, res) => {
  const { name, email, phone, date, time, purpose, msg, propertyId, propertyName } = req.body;
  if (!name || !email || !phone || !date)
    return res.status(400).json({ error: 'name, email, phone, and date are required' });
  try {
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO appointments (id, name, email, phone, date, time, purpose, msg, propertyId, propertyName, confirmed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [id, name, email, phone, date, time || '', purpose || 'General Inquiry', msg || '', propertyId || '', propertyName || ''],
    });
    console.log(`📅 Appointment: ${name} <${email}> on ${date}${propertyId ? ' for property ' + propertyId : ''}`);
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: APPOINTMENTS ──────────────────────────────────────────────────────
app.get('/api/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM appointments ORDER BY createdAt DESC');
    res.json(rows.map(a => ({ ...a, confirmed: !!a.confirmed })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT COUNT(*) as count FROM appointments');
    await db.execute('DELETE FROM appointments');
    console.log(`🗑  Cleared ${rows[0].count} appointments`);
    res.json({ success: true, cleared: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM appointments WHERE id=?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    if (req.body.confirmed !== undefined) {
      await db.execute({ sql: 'UPDATE appointments SET confirmed=? WHERE id=?', args: [req.body.confirmed ? 1 : 0, req.params.id] });
    }
    const { rows: updated } = await db.execute({ sql: 'SELECT * FROM appointments WHERE id=?', args: [req.params.id] });
    console.log(`✅ Appointment ${req.params.id} confirmed for ${updated[0].name}`);
    res.json({ ...updated[0], confirmed: !!updated[0].confirmed });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/appointments/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: 'SELECT id FROM appointments WHERE id=?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    await db.execute({ sql: 'DELETE FROM appointments WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: STATS ─────────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const q = async (sql) => (await db.execute(sql)).rows[0].n;
    const totalProperties  = await q("SELECT COUNT(*) as n FROM properties");
    const available        = await q("SELECT COUNT(*) as n FROM properties WHERE status='available'");
    const sold              = await q("SELECT COUNT(*) as n FROM properties WHERE status='sold'");
    const rented             = await q("SELECT COUNT(*) as n FROM properties WHERE status='rented'");
    const forSale           = await q("SELECT COUNT(*) as n FROM properties WHERE type='FOR SALE'");
    const forRent            = await q("SELECT COUNT(*) as n FROM properties WHERE type='FOR RENT'");
    const totalAppointments = await q("SELECT COUNT(*) as n FROM appointments");
    const newAppointments   = await q("SELECT COUNT(*) as n FROM appointments WHERE confirmed=0");
    res.json({ totalProperties, available, sold, rented, forSale, forRent, totalAppointments, newAppointments });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const props = (await db.execute('SELECT COUNT(*) as n FROM properties')).rows[0].n;
    const appts = (await db.execute('SELECT COUNT(*) as n FROM appointments')).rows[0].n;
    res.json({ status: 'ok', uptime: process.uptime().toFixed(0) + 's', properties: props, appointments: appts });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ─── CATCH-ALL: SPA ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log(`║   🏠  MidLand Constructions API            ║`);
    console.log(`║   Website  → http://localhost:${PORT}        ║`);
    console.log(`║   Admin    → http://localhost:${PORT}/admin.html ║`);
    console.log('╚════════════════════════════════════════════╝\n');
  });
}

module.exports = app;
