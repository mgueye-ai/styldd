# Deploy Styld tenant sites to Vercel

- **`styldd.com` / `www.styldd.com`** → Styld marketing landing page (`marketing/`, synced from [github.com/mgueye-ai/styld](https://github.com/mgueye-ai/styld))
- **`yourname.styldd.com`** → tenant sites loaded from Supabase via middleware

Both are served by the **templatesite** Vercel project (`stylddsite`).

## One-time setup

1. **Vercel project env vars** (Project → Settings → Environment Variables):

   - `STYLD_SUPABASE_URL` = your Styld Supabase URL (`https://gogpjxxsrcjpbugocvnd.supabase.co`)
   - `STYLD_SUPABASE_ANON_KEY` = Styld anon/publishable key
   - `STYLD_ROOT_DOMAIN` = `styldd.com`

2. **Supabase Edge Function secrets** (for auto-redeploy when users tap Publish in the app):

   ```bash
   npx supabase secrets set \
     VERCEL_ACCESS_TOKEN=your_token \
     VERCEL_PROJECT_ID=prj_xxx \
     VERCEL_TEAM_ID=team_xxx \
     --project-ref gogpjxxsrcjpbugocvnd
   ```

   Or set `VERCEL_DEPLOY_HOOK_URL` instead (from Vercel → Project → Settings → Git → Deploy Hooks).

3. **Deploy** from this folder:

   ```bash
   cd templatesite
   npx vercel login
   npx vercel link   # link to project stylddsite-9795 if prompted
   npx vercel deploy --prod
   ```

4. **Domains** (Vercel → Project → Settings → Domains):

   - Add `styldd.com`
   - Add `*.styldd.com` (wildcard)

   DNS for `styldd.com` must point to Vercel (nameservers or CNAME).

5. **Supabase migrations** — run if you have not already:

   ```bash
   npx supabase db push --linked
   ```

## How it works

- App **Publish** saves subdomain + site data in Supabase, then triggers a **Vercel production redeploy** via the `vercel-redeploy` Edge Function.
- Visiting `slug.styldd.com` hits Vercel middleware → `/tenant/index.html` → loads site records for that slug.

If you see **DEPLOYMENT_NOT_FOUND**, the wildcard domain is not linked to a production deployment yet — complete steps 2–3 above.
