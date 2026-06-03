# Unit wallet + Plaid payouts (Styld)

Site owners accept booking payments into a **Unit** deposit account, view balance in the app (**Profile → Wallet & payouts**), and withdraw to a bank linked via **Plaid**.

Clients on the booking site pay by linking their bank (Plaid) and authorizing an ACH transfer to the stylist’s Unit account.

## 1. Supabase secrets (required — fixes “UNIT_API_TOKEN not found”)

In **[Supabase Dashboard](https://supabase.com/dashboard/project/gogpjxxsrcjpbugocvnd/settings/functions) → Edge Functions → Secrets**, add:

| Secret | Description |
|--------|-------------|
| `UNIT_API_TOKEN` | Unit API bearer token (org admin) |
| `UNIT_API_URL` | `https://api.s.unit.sh` (sandbox) or production URL from Unit |
| `PLAID_CLIENT_ID` | Plaid dashboard → Team Settings |
| `PLAID_SECRET` | Sandbox or production secret |
| `PLAID_ENV` | `sandbox`, `development`, or `production` |

Do not commit these values to git.

**CLI (after `npx supabase login`):** copy `supabase/.env.secrets.example` to `supabase/.env.secrets`, fill values, then run `npm run secrets:set`.

Until these secrets exist, **Profile → Payments → Connect payment account** and booking checkout will fail.

## 2. Database migration

Apply migrations (including `20260604120000_styld_unit_finance.sql` and `20260604130000_styld_unit_booking_pay_rpc.sql`):

```bash
supabase db push --linked
```

## 3. Deploy edge functions

```bash
supabase functions deploy unit-finance-onboard
supabase functions deploy unit-finance-summary
supabase functions deploy unit-finance-sync
supabase functions deploy unit-finance-plaid-link
supabase functions deploy unit-finance-plaid-exchange
supabase functions deploy unit-finance-payout
supabase functions deploy unit-booking-plaid-link
supabase functions deploy unit-booking-pay
supabase functions deploy unit-merchant-status
supabase functions deploy unit-webhook
```

Register the **Unit webhook** URL in the Unit dashboard:

`https://<project-ref>.supabase.co/functions/v1/unit-webhook`

## 4. Stylist setup (app)

1. **Profile → Wallet & payouts → Set up payment wallet** — complete Unit’s application form.
2. Tap **Done**, then refresh; balance appears when Unit approves the application (webhook or sync).
3. **Link bank for payouts** — Plaid Link (payout destination).
4. **Request payout** — ACH debit from Unit wallet to the linked bank.

## 5. Booking site

After the wallet is active, online deposit/full modes on **Booking payments** use bank transfer instead of Stripe. The tenant booking page checks `unit-merchant-status` before showing the payment step.

## Security note

If API keys were shared in chat or screenshots, rotate them in Unit and Plaid and update Supabase secrets.
