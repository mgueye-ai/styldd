# Supabase setup (Hair by Nadjae)

Follow these steps once per environment (staging / production).

## 1. Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project.
2. Wait until the database is ready. Note the **region** you chose.

## 2. Run the database schema

1. In the Supabase dashboard: **SQL Editor** → **New query**.
2. Paste the full contents of `supabase/schema.sql` from this repo and run it.
3. If your `bookings` table already existed from an older version, also run `supabase/migrations/20260430140000_booking_payment_fields.sql` (or the `ALTER TABLE` comments at the bottom of `schema.sql`) so payment columns exist.
4. Run `supabase/migrations/20260504140000_pricing_situation_and_inquiries.sql` if you already had `bookings` without `pricing_situation` or need the `inquiries` table.
5. Run `supabase/migrations/20260505120000_salon_email_sent.sql` so salon notification emails dedupe correctly (`notify-salon` + Database Webhooks).
6. Run later migrations in order under `supabase/migrations/` (booking slots, removing legacy Cal columns if applicable).

This creates:

- `public.bookings` with Row Level Security (RLS), including optional **`pricing_situation`** for multi-sheet pricing
- `public.inquiries` for the contact form (`contact.html`)
- Policies so **anon** can **insert** (public booking form) and **select** (admin dashboard — see security note below)
- Storage bucket **`booking-photos`** (private) and an **anon insert** policy for paths under a UUID folder

## 3. API keys → website config

1. Dashboard → **Project Settings** → **API**.
2. Copy **Project URL** and the **anon public** key (not the `service_role` key).
3. Put them **only** in `js/supabase-config.local.js` (that file is **gitignored** so keys are not committed). Keep `js/supabase-config.js` empty in git — it is the safe default for the repo.

   Use the same shape as in that file’s comments, for example:

   ```js
   (function () {
     var o = window.__NADJAE_SUPABASE;
     if (!o) return;
     o.url = "https://YOUR_PROJECT_REF.supabase.co";
     o.anonKey = "YOUR_ANON_PUBLIC_KEY";
   })();
   ```

   On a fresh clone, create `js/supabase-config.local.js` if it is missing (you can start from `js/supabase-config.example.js` and paste into the pattern above).

4. Reload `booking.html` and submit a test booking. You should see a row in **Table Editor** → `bookings` and files under **Storage** → `booking-photos` if photos were attached.

**If you see `new row violates row-level security policy for table "bookings"`:** your policies may be fine but **`anon` still needs `GRANT`** on the table. Run **`supabase/fix_bookings_anon_grants.sql`** once in the SQL Editor, then try the booking again.

## 4. Hosting the static site

- Serve the site over **HTTPS** (recommended). `file://` may block or restrict the Supabase JS client and uploads.
- If you use a separate domain, add it under **Authentication** → **URL configuration** only if you later enable Supabase Auth (not required for anon + RLS as shipped).

## 5. Security (important)

The included RLS policy **allows anyone with the anon key to read all bookings** so the simple HTML admin dashboard can query data. That is fine for a private admin URL and a key kept off the public internet, but it is **not** suitable for a fully public anon key embedded in a high-traffic marketing site without further hardening.

**Production hardening options:**

- Replace anon read with **Supabase Auth** (e.g. staff login) and RLS `to authenticated`, or
- Move reads to a **Edge Function** that checks a secret / session and returns only what admins need.

## 6. CLI (optional)

This repo includes `supabase/config.toml` from `supabase init`. To link your remote project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

You can use `supabase db push` only if you adopt migrations as the source of truth; today the canonical one-shot script is `schema.sql` in the SQL Editor.

## 7. Stripe Checkout (deposit)

The booking page saves the row in Supabase, then calls an **Edge Function** that creates a **Stripe Checkout Session** (your **secret** key never touches the browser).

### A. Stripe Dashboard

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **API keys** — copy **Secret key** (`sk_test_…` or `sk_live_…`).
2. **Developers** → **Webhooks** → **Add endpoint**  
   - URL: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`  
   - Events: `checkout.session.completed`  
   - Copy the **Signing secret** (`whsec_…`).

### B. Supabase secrets

In Supabase: **Project Settings** → **Edge Functions** → **Secrets** (or CLI `supabase secrets set`), add:

| Name | Value |
|------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook above |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to functions automatically on hosted projects.

**Live / production:** real card charges use **`sk_live_…`** and a **live** webhook signing secret (`whsec_…`) from Stripe **Dashboard → Live mode** → Developers. Add or update those values in **Supabase** secrets (not only on Vercel). Variables named `STRIPE_SECRET_KEY` on **Vercel** do **not** reach Supabase Edge Functions — Checkout still uses whatever secret is stored in the Supabase project.

**Vercel (this repo’s static deploy):** set `STRIPE_PUBLISHABLE_KEY` = `pk_live_…` (or `pk_test_…`). The build script (`npm run build` → `scripts/vercel-build-inject.cjs`) writes `js/stripe-config.local.js` so the booking page can show correct Stripe live vs test messaging. Keep **`sk_…` out of the frontend**; only `pk_…` is injected for display hints.

### C. Deploy Edge Functions

From this repo (with CLI logged in and project linked):

```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy stripe-webhook
npx supabase functions deploy notify-salon
npx supabase functions deploy resend-notify
npx supabase functions deploy notify-booking-status
npx supabase functions deploy admin-cancel-booking
npx supabase functions deploy daily-booking-emails
```

`supabase/config.toml` sets `verify_jwt = false` for `create-checkout-session` so the **public booking page** can invoke it using the anon client (no Supabase Auth login). JWT verification was rejecting those calls with errors like “Failed to send a request to the Edge Function.” `stripe-webhook` stays `verify_jwt = false` (Stripe signature, not Supabase JWT).

### D. Client flags

- `js/stripe-config.js` — `depositCheckoutEnabled: true` (default) turns on “save booking → redirect to Checkout”.
- `js/stripe-config.local.js` — optional locally; set `depositCheckoutEnabled = false` to skip Checkout while testing. On **Vercel**, this file is generated at build when `STRIPE_PUBLISHABLE_KEY` is set (see §7.B above).

### E. Flow

1. Guest completes the form → booking row inserted → `create-checkout-session` loads the row, creates Checkout for **deposit** in cents, stores `stripe_checkout_session_id`, returns `url` → browser redirects to Stripe.
2. After payment, Stripe sends `checkout.session.completed` → `stripe-webhook` sets `payment_status` to `deposit_paid` and saves payment intent id.
3. User returns to `booking-success.html` (then full receipt on `booking-details.html`), or `booking.html?paid=1` / `?canceled=1` in other flows.

If the Edge Function is missing or Stripe secrets are not set, the booking **still saves** and the page shows a message that online payment could not start.

## Resend (transactional email)

Email is sent from **Supabase Edge Functions** using the [Resend](https://resend.com/) HTTP API so your **API key never ships in the website**. This repo includes:

| Trigger | Function | What gets emailed |
|--------|----------|-------------------|
| After insert from **booking / contact** pages | `notify-salon` (invoked in `js/booking.js` + `js/inquiry-form.js`) | Salon notification (`NOTIFY_TO_EMAIL`) + **customer booking confirmation** (bookings only; **BCC** salon if different from guest email) |
| New row in `bookings` or `inquiries` (optional **Database Webhook**) | `resend-notify` | Same as above — **deduped** with `notify-salon` via `salon_email_sent_at` |
| Stripe `checkout.session.completed` | `stripe-webhook` | Customer “deposit received” (**BCC:** `NOTIFY_TO_EMAIL` so the salon gets the same confirmation), if `RESEND_*` is set |

### What you do in Resend

1. **Sign up** at [resend.com](https://resend.com/) and open the dashboard.
2. **Domain** (recommended for production): **Domains** → **Add domain** → enter your site domain (e.g. `hairbynadjae.com`). Add the **DNS records** Resend shows (often DKIM + SPF) at your DNS host (Cloudflare, GoDaddy, etc.). Wait until the domain shows **Verified**.
3. **API key**: **API Keys** → create a key with permission to send email. Copy it once and store it in a password manager.
4. **From address**: After the domain is verified, you can send from something like `Hair by Nadjae <bookings@yourdomain.com>`. That exact string is what you put in `RESEND_FROM` below.

**Sandbox / no domain yet:** Resend may allow limited testing with their onboarding sender — check their current docs for `from` restrictions and which recipient addresses work during trial.

### What you do in Supabase

1. **Secrets** — Dashboard → **Project Settings** → **Edge Functions** → **Secrets** (or CLI below). Add:

   | Name | Example / notes |
   |------|-------------------|
   | `RESEND_API_KEY` | `re_…` from Resend |
   | `RESEND_FROM` | `Hair by Nadjae <bookings@yourdomain.com>` — must be allowed by Resend |
   | `NOTIFY_TO_EMAIL` | Where salon notifications go (e.g. the owner Gmail or `hello@yourdomain.com`) |
   | `NADJAE_NOTIFY_SECRET` | Long random string (e.g. `openssl rand -hex 32`). **Anyone with this secret can trigger notifications** — keep it only in Supabase + webhook config. |
   | `PUBLIC_SITE_URL` | Optional. Your live site base URL with **no** trailing slash (e.g. `https://hairbynadjae.com`). Adds a **View your booking details** link in the customer confirmation email. `SITE_URL` is accepted as an alias. |

   CLI equivalent:

   ```bash
   npx supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="Hair by Nadjae <bookings@yourdomain.com>" NOTIFY_TO_EMAIL=you@gmail.com NADJAE_NOTIFY_SECRET="$(openssl rand -hex 32)"
   ```

2. **Run the email dedupe migration** in the SQL Editor if you have not already (adds `salon_email_sent_at` on `bookings` and `inquiries`):

   - File: `supabase/migrations/20260505120000_salon_email_sent.sql`

3. **Deploy** the email functions (after `supabase login` + `supabase link`):

   ```bash
   npx supabase functions deploy notify-salon
   npx supabase functions deploy resend-notify
   npx supabase functions deploy stripe-webhook
   ```

   The **website** always calls `notify-salon` after a successful save. **Database Webhooks** to `resend-notify` are optional (backup or if you remove the client call); the first path to “claim” the row wins, so you should not get duplicate salon emails.

4. **Database Webhooks** (optional — salon email already sends from the site via `notify-salon`):

   - Dashboard → **Database** → **Webhooks** (or **Integrations** → Database Webhooks, depending on UI version).
   - **Create** two hooks (or one hook with a filter if your plan supports it):

     **Hook A — `bookings` INSERT**

     - Table: `public.bookings`
     - Events: **Insert**
     - Type: **Supabase Edge Functions** → choose `resend-notify`, **or** HTTP POST to  
       `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/resend-notify`
     - If using HTTP POST, set header **`x-nadjae-notify-secret`** to the **same** value as `NADJAE_NOTIFY_SECRET`.

     **Hook B — `inquiries` INSERT**

     - Table: `public.inquiries`
     - Events: **Insert**
     - Same function URL and **`x-nadjae-notify-secret`** header as Hook A.

   The function expects the standard Supabase webhook JSON (`table`, `type`, `record`, …). Replies to inquiries use **`reply_to`** the visitor’s email when possible.

5. **Test**

   - Submit the **contact** form on `contact.html` — you should get one email to `NOTIFY_TO_EMAIL`.
   - Submit a **booking** — one email to `NOTIFY_TO_EMAIL`; after paying the deposit, the customer should get the deposit email from `stripe-webhook` (and Stripe’s own receipt).

If `RESEND_API_KEY` / `RESEND_FROM` are missing, `stripe-webhook` still updates the booking; it only skips the extra Resend confirmation and logs a warning.

## Blooio / Bli (SMS + iMessage fallback, alongside email)

SMS is optional: if **`BLOOIO_API_KEY`** is unset, Edge Functions keep sending **email only**. The dashboard is often labeled **Bli.io** while the API base URL is **`https://backend.blooio.com/v2/api`** ([sending messages](https://docs.blooio.com/guides/message-sending)).

### In Blooio

1. **Developers → API Keys** — create a key; use it as the Supabase secret **`BLOOIO_API_KEY`** (Bearer token).
2. **Messaging → Numbers** — activate the number used for outbound messages.
3. If you use more than one number, set **`BLOOIO_FROM_NUMBER`** (E.164 `+1…`) to choose the sender; otherwise Blooio applies its default routing.

### In Supabase

1. Run **`supabase/migrations/20260507150000_booking_sms_tracking.sql`** (or the matching `ALTER TABLE` lines in `supabase/schema.sql`) so `bookings` has `salon_sms_sent_at`, `customer_booking_confirmation_sms_sent_at`, and `day_reminder_sms_sent_at`.

2. **Edge Function secrets**:

   | Name | Notes |
   |------|--------|
   | `BLOOIO_API_KEY` | Required to send SMS |
   | `NOTIFY_TO_PHONE` | Owner phone in **E.164** (e.g. `+12035551234`) |
   | `BLOOIO_FROM_NUMBER` | Optional outbound number (E.164) |
   | `BLOOIO_API_BASE` | Optional override; default is Blooio’s `/v2/api` URL |

3. **Redeploy** every function that sends notifications (`notify-salon`, `resend-notify`, `stripe-webhook`, `notify-booking-status`, `admin-cancel-booking`, `daily-booking-emails`).

SMS mirrors the existing email triggers: **new booking** (owner + client with parsable phone), **deposit**, **cancel / reschedule**, **~24h reminder**, **owner daily digest** (digest SMS is omitted when there are zero appointments that day — avoids hourly “empty” texts from cron). Duplicate protection uses DB timestamps where needed and **`Idempotency-Key`** on Blooio requests.
