# Instructions for Site / Template AI

Use this when editing `templatesite/` (Vercel `*.styldd.com` tenant sites).

## Subscription-gated domains

Styld sites are **not free hosting**. A stylist must have an **active Styld subscription** (RevenueCat entitlement `pro`, products `styld_monthly` / `styld_yearly`) to keep a live subdomain.

### Rules

1. **Publish requires subscription** — The mobile app checks RevenueCat before first publish. Server function `subscription-site-sync` verifies again on publish.
2. **Live = `published_at` is set** — Public tenant pages only load when `styld_site_subdomains.published_at` is not null for that subdomain.
3. **Cancel mid-term → site goes offline** — When subscription lapses, `subscription-site-sync` clears `published_at` (and registry `published_at`). The subdomain slug is kept; content stays in `styld_site_records`.
4. **Resubscribe → publish again** — After paying, the stylist taps Publish in the app (or mandatory paywall flow republishes) to set `published_at` and bring `https://{subdomain}.styldd.com` back.

### What tenant JS must do

- Resolve subdomain from host (`{slug}.styldd.com`) or `?subdomain=` query.
- Load `styld_site_subdomains` and require `published_at` before loading `styld_site_records`.
- If missing or unpublished, show a friendly offline message — **do not** render booking UI or accept payments.

Suggested copy:

> This site is temporarily offline. The owner needs an active Styld subscription to keep their booking site live.

### Do not

- Bypass `published_at` checks.
- Cache tenant HTML as “always live” without revalidating subdomain row.
- Store subscription state in static files — always read Supabase.

### Supabase sources of truth

| Check | Table / RPC |
|-------|-------------|
| Is subdomain live? | `styld_site_subdomains.published_at IS NOT NULL` |
| Tenant data | `styld_site_records` for resolved `user_id` |
| Bookings / payments | RPCs using `styld_resolve_published_user_id(subdomain)` |

### Edge functions (main Supabase project `gogpjxxsrcjpbugocvnd`)

- `subscription-site-sync` — `verify` (pre-publish) or `sync` (unpublish if not entitled)
- `revenuecat-subscription-status` — app subscription check
- `revenuecat-webhook` — RevenueCat `EXPIRATION` → unpublish site immediately (no app open required)

### RevenueCat webhook (instant takedown)

- URL: `https://gogpjxxsrcjpbugocvnd.supabase.co/functions/v1/revenuecat-webhook`
- Event: **`EXPIRATION` only** (not `CANCELLATION` — users keep access until period ends)
- Authorization header: must match Supabase secret `REVENUECAT_WEBHOOK_SECRET`
- `app_user_id` in webhook = Supabase `auth.users.id` (set via `Purchases.logIn(userId)` in app)

### App behavior

- No subscription + not yet published → paywall before publish.
- Was published + subscription lapsed → paywall + site offline until resubscribe and republish.
