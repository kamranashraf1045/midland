# MidLand Constructions — Website

Real estate & construction website for MidLand Constructions (Pakistan).
Node.js + Express + Turso (hosted SQLite), plain HTML/CSS/JS front end, deployed on Vercel.

## Project structure
```
midland/
├── server.js            ← API, security, server-rendered property pages, sitemap
├── lib/price.js         ← price parsing/formatting (PKR crore / lac)
├── views/
│   ├── pages.js         ← property detail page + 404 (server-rendered for SEO / WhatsApp previews)
│   └── legal.js         ← privacy policy + terms (have these reviewed by your lawyer)
├── public/
│   ├── index.html       ← homepage
│   ├── admin.html       ← admin panel (at /admin, not linked publicly)
│   └── assets/
│       ├── site.css     ← all public-site styles
│       ├── app.js       ← shared JS: nav, booking form, cards, lightbox, favourites
│       ├── home.js      ← homepage: search/filters, featured listing, portfolio, testimonials
│       ├── admin.js     ← admin panel logic
│       ├── icons.svg    ← SVG icon set
│       └── logo.jpg, placeholder.svg
├── vercel.json
└── .env.example
```

## Run locally
```bash
npm install
cp .env.example .env     # optional for local dev
npm run dev
```
- Website: http://localhost:3001 · Admin: http://localhost:3001/admin
- Without `.env`, a local `db.sqlite` file is used and, if no admin exists yet, a random admin password is printed in the terminal once.

## Deploy to Vercel
1. Create a free database at https://turso.tech → copy the **Database URL** and an **Auth Token**.
2. In Vercel → Project → Settings → Environment Variables, add:

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | ✅ | 64 hex chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — the server refuses to start without it |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | ✅ | otherwise data is wiped on every deploy |
| `ADMIN_PASS` | first deploy | only used if no admin account exists yet |
| `SITE_URL` | recommended | e.g. `https://midland-pi.vercel.app` (used in sitemap & share links) |
| `WHATSAPP_NUMBER`, `CONTACT_PHONE`, `CONTACT_EMAIL`, `CONTACT_ADDRESS` | recommended | shown everywhere on the site — **replace the placeholder number** |

3. Redeploy, open `/admin`, log in, then **Settings → Change password**.
4. Check `/api/health` → `"persistentDb": true`.

> Upgrading an existing database? Nothing to do — new columns (`images`, `price_pkr`, `city`) are added and filled in automatically on first start.

## Features
**Website**
- Property search: Sale / Rent / Saved tabs, text search, city, category, bedrooms, budget, sorting — filters are kept in the URL so searches can be shared
- Featured listing slideshow (from your newest listing, with pause control)
- A page per listing at `/property/S0001` with photo gallery + lightbox, specs, map, booking form, similar listings, WhatsApp share with rich preview (Open Graph) and Google structured data
- Booking form with inline validation (no past dates, closed Sundays), clear error messages, and a confirmation screen with reference number, “Add to Google Calendar” and WhatsApp
- Favourites saved in the visitor's browser
- `sitemap.xml`, `robots.txt`, privacy & terms pages, real 404 page
- Accessible: keyboard navigation, focus states, screen-reader labels, readable contrast, reduced-motion support

**Admin (`/admin`)**
- Dashboard, add **and edit** every field of a listing, multiple photos per listing, mark sold/rented/re-list, delete
- Appointments: Pending / Confirmed / Past / All, confirm or reschedule via WhatsApp, CSV export, “Delete all” protected by typing `DELETE ALL`
- Calendar of confirmed appointments
- Change password; automatic logout after 30 minutes idle

## Security
- Admin tokens are HMAC-signed and expire after 12 h; no default secret or password exists in code
- Rate limiting on login (5 failed attempts / 15 min) and bookings (5 / hour per IP)
- All user input is validated server-side and escaped before display (admin panel included)
- No CORS: the API can only be called from the site itself
- Security headers (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)

## Editing site content
- **Completed projects & testimonials:** top of `public/assets/home.js` (`PROJECTS`, `TESTIMONIALS`). The testimonials section stays hidden until you add real reviews.
- **Photos:** paste image links (one per line) in Admin → Edit property. Upload photos to Cloudinary or similar first.

## API
Public: `GET /api/properties`, `GET /api/properties/:id`, `POST /api/appointments`, `GET /api/config`, `GET /api/health`
Admin (`x-admin-token` header): `POST /api/admin/login`, `POST /api/admin/logout`, `PATCH /api/admin/change-password`, `GET|POST /api/admin/properties`, `PATCH|DELETE /api/admin/properties/:id`, `GET /api/admin/appointments`, `PATCH|DELETE /api/admin/appointments/:id`, `DELETE /api/admin/appointments` (body `{"confirm":"DELETE ALL"}`), `GET /api/admin/stats`
