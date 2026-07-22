# 🏠 MidLand Constructions — Full Stack Website

> Premier real estate & construction website for Lahore, Pakistan — built with Node.js, Express, and Vanilla HTML/CSS/JS.

---

## What changed in this version

A few serious issues were found and fixed:

1. **The API base URL was hardcoded to `http://localhost:3001/api`** in both
   `index.html` and `admin.html`. That meant once deployed anywhere other than
   your own machine, every request to the backend silently failed, and the
   site fell back to:
   - A hardcoded demo property list on the public site — which is where the
     **Urdu descriptions** were coming from (now rewritten in professional
     English).
   - A client-side-only "demo mode" in the admin panel, with hardcoded
     credentials sitting in plain sight in the page source, managing fake data
     in `localStorage` that no real visitor ever saw.

   Fixed: both files now call `/api` (relative, same-origin), so they always
   reach the real backend no matter where it's deployed.

2. **Data was stored in memory** (`let properties = [...]`, `let appointments
   = []`, and a `Set()` of login tokens). On Vercel, memory is wiped constantly
   and isn't shared between server instances — so listings, bookings, and
   admin sessions could all vanish unpredictably. Fixed by moving everything
   to **Turso** (a free, hosted, SQLite-compatible database).

3. **Login sessions** now use a signed, self-verifying token instead of an
   in-memory list — nothing server-side can go missing between requests, so
   login is reliable regardless of how many server instances Vercel is running.

4. **Admin panel hidden from the public site** — the "⚙ Admin" link has been
   removed from the main site's nav. The admin panel still lives at
   `/admin.html`, it's just not linked anywhere — bookmark that URL.

5. **Click-to-enlarge photos** — clicking any property photo (in the
   Marketplace, inside a property's detail view, or in the "Our Work"
   portfolio section) now opens it full-size in a lightbox viewer.

6. **Share button fixed** — it now opens WhatsApp directly with a pre-filled
   message and link, instead of relying on the browser's native Share API
   (which wasn't reliably supported and is why it "did nothing" before).

7. **`vercel.json` added** — this was missing before, which was part of why
   the hardcoded-localhost bug was never caught during deployment.

## Project Structure
```
midland/
├── server.js          ← Main backend (Node.js + Express + Turso)
├── vercel.json        ← Vercel serverless config
├── package.json        ← Dependencies
├── .env.example        ← Environment variable template
└── public/
    ├── index.html      ← Main website
    └── admin.html      ← Admin dashboard (/admin.html — not linked publicly)
```

## Quick Start (Local)

### 1. Install Node.js
Download from https://nodejs.org (v18+ recommended)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```
Without any `.env` file, this uses a local SQLite file (`db.sqlite`) —
perfect for testing on your own machine.

### 4. Open in Browser
- Website: http://localhost:3001
- Admin panel: http://localhost:3001/admin.html

### Default Admin Credentials
- Username: `admin`
- Password: `midland2025`
⚠️ Change your password immediately after first login — call
`PATCH /api/admin/change-password` with your current + new password
(headers: `x-admin-token: <your login token>`).

---

## Deploying to Vercel (with persistent data)

### Step 1 — Create a free Turso database
1. Go to https://turso.tech and sign up (free tier is plenty for this site).
2. Create a new database (any name, e.g. `midland`).
3. Copy the **Database URL** (`libsql://...`) and create + copy an **Auth Token**.

### Step 2 — Set environment variables in Vercel
In your Vercel project → Settings → Environment Variables, add:
```
TURSO_DATABASE_URL   = libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN     = your-token-here
SESSION_SECRET       = (a long random string — generate with the command below)
```
Generate a `SESSION_SECRET` locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3 — Deploy
Push this folder to GitHub and import it into Vercel (Framework Preset:
"Other" — the included `vercel.json` tells Vercel how to run `server.js`).

### Step 4 — First login
Visit `https://your-site.vercel.app/admin.html` and log in with `admin` /
`midland2025`, then change the password right away.

---

## Features

### Website (`index.html`)
- 🖼️ Featured listing photo slideshow
- 🏘️ Property Marketplace — filter by For Sale / For Rent, detail modal, favourites
- 🔍 **Click any property or portfolio photo to view it full-size**
- 📅 Appointment booking, synced to the backend
- 🏗️ Portfolio ("Our Work") section
- 💬 WhatsApp floating contact button, and WhatsApp share on any property
- 📱 Fully responsive

### Admin Panel (`admin.html` — not linked from the public site)
- 🔐 Secure login, session auto-clears when you leave the tab
- 📊 Dashboard with live stats
- ➕ Add / manage property listings
- 📅 Appointments manager with WhatsApp confirm/reschedule messaging
- 🗓️ Calendar view of confirmed appointments

## 🌐 API Endpoints

### Public
| Method | Endpoint           | Description               |
|--------|--------------------|---------------------------|
| GET    | /api/properties    | List available properties |
| POST   | /api/appointments  | Book an appointment       |

### Admin (requires `x-admin-token` header)
| Method | Endpoint                      | Description                    |
|--------|-------------------------------|--------------------------------|
| POST   | /api/admin/login              | Login, returns session token   |
| POST   | /api/admin/logout             | Logout                         |
| PATCH  | /api/admin/change-password    | Change admin password          |
| GET    | /api/admin/properties         | List ALL properties            |
| POST   | /api/admin/properties         | Add new property               |
| PATCH  | /api/admin/properties/:id     | Update a property               |
| DELETE | /api/admin/properties/:id     | Delete a property               |
| GET    | /api/admin/appointments       | List all appointments          |
| PATCH  | /api/admin/appointments/:id   | Update appointment (confirm)   |
| DELETE | /api/admin/appointments/:id   | Delete single appointment      |
| DELETE | /api/admin/appointments       | Clear all appointments         |
| GET    | /api/admin/stats              | Dashboard statistics           |

## 📱 WhatsApp Setup
Before going live, replace the phone number used by the floating WhatsApp
button in `public/index.html` (`https://wa.me/923001234567?...`) with your own
WhatsApp Business number (country code, no `+`).

## 🔒 Security Notes
- Admin sessions live in `sessionStorage`, cleared when the tab closes or loses focus
- Never commit your `.env` file — it's in `.gitignore` by default
- Change the default admin credentials right after your first deploy
