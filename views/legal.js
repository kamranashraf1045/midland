// Privacy policy and terms of use.
// ⚠️ These are a plain-language starting point, not legal advice. Have them
// reviewed by your lawyer before relying on them, and update the date when you change them.
const { layout } = require('./pages');
const UPDATED = '16 November 2026';

const wrap = (inner) => `<section class="page-top"><div class="container legal">${inner}</div></section>`;

function privacy(site) {
  return layout({
    title: 'Privacy Policy | MidLand Constructions', description: 'How MidLand Constructions collects and uses your personal information.', site,
    body: wrap(`
      <h1>Privacy Policy</h1><p><em>Last updated: ${UPDATED}</em></p>
      <h2>What we collect</h2>
      <p>When you book an appointment we collect your name, email address, phone number, preferred date and time, the purpose of your visit, any message you write, and the property you are enquiring about.</p>
      <h2>How we use it</h2>
      <ul><li>To confirm, reschedule or follow up on your appointment by phone, WhatsApp or email.</li>
      <li>To answer your questions about properties and our services.</li></ul>
      <p>We do not sell your information or share it with third parties for their marketing.</p>
      <h2>Where it is stored</h2>
      <p>Your booking is stored in our secure database and is only accessible to authorised MidLand staff. Saved ("favourite") properties are stored only in your own browser.</p>
      <h2>How long we keep it</h2>
      <p>We keep appointment records only as long as needed to serve you and meet legal obligations, after which they are deleted.</p>
      <h2>Your rights</h2>
      <p>You can ask us to show, correct or delete the information we hold about you by contacting us at <a href="mailto:${site.email}">${site.email}</a> or ${site.phone}.</p>
      <h2>Third-party services</h2>
      <p>This website loads fonts from Google Fonts, maps from Google Maps and some images from Unsplash. These services may receive your IP address when the page loads.</p>`),
  });
}

function terms(site) {
  return layout({
    title: 'Terms of Use | MidLand Constructions', description: 'Terms for using the MidLand Constructions website.', site,
    body: wrap(`
      <h1>Terms of Use</h1><p><em>Last updated: ${UPDATED}</em></p>
      <h2>Listings</h2>
      <p>Property details, prices and availability are provided in good faith and may change without notice. Photos may be illustrative. Please confirm all details with our team before making any decision or payment.</p>
      <h2>Appointments</h2>
      <p>Booking through the website is a request; it is confirmed only once our team contacts you.</p>
      <h2>No offer or advice</h2>
      <p>Nothing on this website is a binding offer, or legal, financial or investment advice.</p>
      <h2>Content</h2>
      <p>The MidLand name, logo and website content belong to MidLand Constructions and may not be copied without permission.</p>
      <h2>Contact</h2>
      <p>${site.address} · ${site.phone} · <a href="mailto:${site.email}">${site.email}</a></p>`),
  });
}

module.exports = { privacy, terms };
