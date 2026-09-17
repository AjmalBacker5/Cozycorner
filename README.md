# The Cozy Corner — setup & deploy guide

A Node/Express site that sells three digital products — Indian Dropshipping
Mastery (₹299), the AI Video Ads Course (₹399), and the Verified Sellers &
Suppliers Database (₹199) — each with its own dedicated page, real Cashfree
checkout, and auto-delivery of the purchased file by email + an instant
download link once payment is confirmed.

## 1. How it fits together

```
public/index.html              hub/landing page linking to the 3 plan pages
public/dropshipping.html       Indian Dropshipping Mastery — ₹299
public/ai-video-course.html    AI Video Ads Course — ₹399
public/suppliers-data.html     Verified Sellers & Suppliers Database — ₹199
public/success.html            order-status / download page after checkout
public/checkout.js             shared checkout modal + Cashfree SDK logic (used by all 3 plan pages)
public/main.js                 shared mobile nav + FAQ accordion logic
public/styles.css              shared styles for every page
server.js        Express app: serves public/ and the API routes below
lib/cashfree.js  talks to Cashfree's REST API (create order, fetch order, verify webhook)
lib/email.js     sends the purchased file by email via Resend
lib/products.js  product catalog — names, prices, filenames
lib/orderStore.js tiny flat-file record of each order (data/orders.json)
private-files/   your real product files — never served publicly
```

Flow: buyer opens a plan's page → clicks Buy → fills name/email/phone →
Cashfree's hosted checkout opens → on success Cashfree redirects the buyer
to `/success.html` *and* calls your server at `/api/webhook` → the webhook
re-checks the payment directly with Cashfree, then emails the file and
unlocks the download link.

## 2. You don't have to wait for Cashfree's approval to start

Cashfree gives you **Test (Sandbox) API keys the moment you sign up** — no
verification needed. You can build, deploy, and fully test the entire
purchase flow today using test cards/UPI IDs. Production ("Live Mode") keys
are only needed for real money to move, and Cashfree requires your site to
already be live before they'll review it for that — which is exactly the
order this guide follows.

## 3. Add your real product files

Drop the actual files into `private-files/` using these exact names (or
edit the names in `lib/products.js` if you'd rather use your own):

```
private-files/dropshipping-module.pdf
private-files/ai-video-course.zip
private-files/sellers-contact-list.xlsx
```

These are never linked from the site — the server only reads them after
Cashfree confirms `order_status: "PAID"`. Until you add them, the whole
flow still works — buyers get a confirmation without the attachment, and a
warning is logged so you notice.

## 4. Local setup

Requires Node.js 18+.

```bash
npm install
cp .env.example .env   # then fill in the values, see steps 5 & 6
npm start              # -> http://localhost:3000
```

## 5. Get Cashfree sandbox keys (today, no approval needed)

1. Sign up at [merchant.cashfree.com](https://merchant.cashfree.com/merchants/signup).
2. Go to **Developers → API Keys**, make sure the **Test Mode** toggle is on.
3. Copy the App ID and Secret Key into `.env`:
   ```
   CASHFREE_APP_ID=...
   CASHFREE_SECRET_KEY=...
   CASHFREE_ENV=SANDBOX
   ```
4. Go to **Developers → Webhooks** and add one pointed at:
   `https://YOUR-DEPLOYED-DOMAIN/api/webhook`, subscribed to payment events.
   Test-mode webhooks fire even before you're approved for live payments.
5. Test a purchase using Cashfree's published sandbox test cards/UPI IDs
   (see their [Test Cashfree Integration](https://www.cashfree.com/docs) docs
   — these values change occasionally). No real money moves in sandbox.

## 6. Set up email delivery (Resend)

1. Sign up free at [resend.com](https://resend.com).
2. Add and verify **thecozycorner.in** as a sending domain — Resend gives
   you a few DNS records to add at your domain registrar.
3. Create an API key and put it in `.env` as `RESEND_API_KEY`.
4. Set `FROM_EMAIL=orders@thecozycorner.in` (or any address on the
   verified domain).

## 7. Deploy to Render with thecozycorner.in

1. Push this project to a GitHub repo (or use Render's manual deploy).
2. On [render.com](https://render.com): **New → Web Service** → connect the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Add every variable from `.env` in Render's **Environment** tab.
4. Once deployed, go to **Settings → Custom Domain**, add `thecozycorner.in`
   (and `www.thecozycorner.in` if you use it).
5. Render shows you a DNS target — add that record at your domain
   registrar's DNS settings.
6. Update `SITE_URL` in Render's environment to `https://thecozycorner.in`
   once the domain resolves.
7. Update the Cashfree webhook URL from step 5.4 to the live domain.

Render's free tier works fine for this; any other Node host (Railway,
Fly.io, a VPS) works the same way — the app just needs `npm install` +
`npm start` and the same environment variables.

## 8. Go live with real payments, once Cashfree approves you

1. In the Cashfree dashboard, submit your business + live website
   (`https://thecozycorner.in`) for verification (KYC). This is the step
   you were waiting on — you now have a live site to submit.
2. Once approved, switch to **Live Mode** in the dashboard and copy the
   live App ID / Secret Key.
3. In Render's environment variables, update `CASHFREE_APP_ID`,
   `CASHFREE_SECRET_KEY`, and set `CASHFREE_ENV=PRODUCTION`.
4. In `public/checkout.js` (shared by all 3 plan pages), change:
   ```js
   var CASHFREE_MODE = 'sandbox';
   ```
   to
   ```js
   var CASHFREE_MODE = 'production';
   ```
   and redeploy — one edit updates all three checkout pages.
5. Add a **live-mode** webhook URL in the Cashfree dashboard (same URL,
   configured under Live Mode this time).
6. Make one small real purchase yourself to confirm the full flow, then
   you're genuinely live.

## 9. Notes & limits

- Each of the 3 plans is sold and delivered separately — there's no bundle discount.
- Orders are recorded in `data/orders.json`, a simple local file — fine to
  start with; move to a real database if volume grows, since that file
  isn't guaranteed to survive every hosting provider's redeploys.
- Refunds/cancellations aren't automated — issue them from the Cashfree
  dashboard directly.
- The webhook always re-verifies payment status directly with Cashfree
  before delivering anything, rather than trusting the webhook payload
  alone, per Cashfree's own recommendation.
