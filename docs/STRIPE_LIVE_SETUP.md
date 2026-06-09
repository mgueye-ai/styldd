# Link live Stripe to Styld

Styld uses **your Stripe account as the platform** and **Stripe Connect Express** so each stylist links their own bank for payouts. Booking payments on `*.styldd.com` route through your platform key; stylists onboard in the app under **Profile → Connected accounts**.

Right now the project is on **test mode** (`pk_test_…` in `eas.json`). Follow these steps to switch to **live**.

## 1. Activate Stripe (live)

1. [Stripe Dashboard](https://dashboard.stripe.com) → turn **Test mode OFF** (live).
2. Complete business verification if Stripe asks.
3. **Connect** → **Settings** → finish your **platform profile** (required for Express accounts).

## 2. Live API keys

**Developers → API keys** (live mode):

| Where | Variable | Value |
|-------|----------|-------|
| Supabase Edge secrets | `STRIPE_SECRET_KEY` | `sk_live_…` |
| Vercel (`templatesite`) | `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `eas.json` production `env` | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same `pk_live_…` |

```bash
# 1. Copy template and paste your live keys
cp supabase/.env.stripe.example supabase/.env.stripe

# 2. Push secrets to Supabase
npm run secrets:set:stripe

# 3. Redeploy payment edge functions
npx supabase functions deploy stripe-webhook stripe-booking-pay stripe-booking-confirm stripe-connect-onboard stripe-connect-status stripe-connect-sync stripe-connect-payout booking-cancel --project-ref gogpjxxsrcjpbugocvnd
```

**Never** put `sk_live_…` in the Expo app, Vercel public vars, or git.

## 3. Live webhook

**Developers → Webhooks → Add endpoint** (live mode):

- **URL:** `https://gogpjxxsrcjpbugocvnd.supabase.co/functions/v1/stripe-webhook`
- **Events:**
  - `account.updated` — Connect onboarding status
  - `payment_intent.succeeded` — booking marked paid + balance sync

Copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` in `supabase/.env.stripe`, then run `npm run secrets:set:stripe` again.

## 4. Vercel (booking sites)

Vercel project `templatesite` → **Settings → Environment Variables**:

```
STRIPE_PUBLISHABLE_KEY=pk_live_…
```

Redeploy production so `styld-tenant-config.local.js` gets the live publishable key.

## 5. Connect return URLs

After deploy, these must load on your domain:

- `https://styldd.com/connect/return`
- `https://styldd.com/connect/refresh`

Pages live in `templatesite/connect/`.

## 6. Stylist flow in the app

1. Sign up → build site → publish (with subscription).
2. **Profile → Connected accounts → Connect bank** — Stripe Express onboarding in WebView.
3. **Payments** tab — enable deposit or full online payment (unlocks after Connect is ready).
4. Clients pay on `yourname.styldd.com` — funds go to stylist Connect balance; Styld keeps platform fee (`STYLD_PLATFORM_FEE_PERCENT`, default 1%).

## Test vs live

| | Test | Live |
|---|------|------|
| Cards | `4242 4242 4242 4242` | Real cards |
| Connect banks | Test routing numbers | Real bank accounts |
| Keys | `pk_test_` / `sk_test_` | `pk_live_` / `sk_live_` |

After going live, each stylist must **complete Connect onboarding again** (test Connect accounts do not carry over).
