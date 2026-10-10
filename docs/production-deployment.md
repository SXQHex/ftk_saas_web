# Production deployment checklist

Target production origin: `https://uye.fethiyetango.com`.

## 1. Create an isolated Netlify site

Create a **new site** from the private GitHub repository `SXQHex/ftk_saas_web`, production branch `main`. Do not reuse or modify the existing `fethiyetango.netlify.app` site, which serves the public website.

Build settings are in `netlify.toml`:
- Build command: `npm run build`
- Node.js: 26
- Publish directory: leave unspecified so Netlify's Next.js adapter manages server-rendered routes and functions.

Add these production environment variables in the new Netlify site's environment settings:
- `NEXT_PUBLIC_SUPABASE_URL=https://ysplylnwdfwizmuxvcqg.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the StudioSaaS publishable key.

The publishable key is intended for browser apps; never configure a `service_role`/secret key in any `NEXT_PUBLIC_*` variable. Trigger a production deploy and wait for the deploy to pass.

## 2. Attach the custom domain before changing DNS

In the new Netlify site's domain settings, add `uye.fethiyetango.com`. Use the exact `.netlify.app` CNAME target that Netlify displays for this **new** site; do not guess it from the GitHub repository name.

Then in Cloudflare > `fethiyetango.com` > DNS, add:
- Type: `CNAME`
- Name: `uye`
- Target: the new Netlify site's exact `.netlify.app` hostname
- Proxy status: **DNS only** (grey cloud)
- TTL: Auto

Do not change the existing apex or `www` records; they serve the public website. Wait until Netlify validates the domain and provisions its TLS certificate. Test `https://uye.fethiyetango.com/api/health`; it should return `{"status":"ok","service":"ftk-saas-web"}`.

## 3. Supabase Auth configuration

In the **StudioSaaS** project, open Authentication > URL Configuration:
- Site URL: `https://uye.fethiyetango.com`
- Redirect URL allowlist must include `https://uye.fethiyetango.com/reset-password`.
- Add `http://localhost:3000/reset-password` only if local development is required.
- Add specific preview callback URLs temporarily for testing; do not add broad wildcard production entries.

In Authentication > Password/Security settings, enable leaked-password protection before inviting operational users. Confirm email verification and rate limits are appropriate for the chosen login policy. The application has no public registration screen; new accounts should be provisioned through the trusted owner workflow.

## 4. First administrator and smoke test

Read [initial-admin-setup.md](initial-admin-setup.md). Promote only the verified studio-owner profile to `admin` from the trusted Supabase SQL Editor; do not set the role from browser code or sign-up metadata.

After deployment:
1. Sign in as the verified owner and confirm the admin-only navigation appears.
2. Create a test member, subscription, lesson and attendance record.
3. Verify the credit ledger and remaining balance; confirm cancellation/postponement does not consume credits and duplicate attendance does not consume credits twice.
4. Test password recovery end-to-end from `uye.fethiyetango.com`.
5. Test a normal student and instructor account, including denied admin routes.
6. Remove test records through the application's supported workflow or reset the empty test dataset before daily use.

## Current deployment boundary

GitHub Actions validates the code, dependency audit, production build and HTTP health endpoint. The connected tools in this workspace do not expose Netlify site-management/deployment operations. Therefore the new Netlify site and its generated CNAME target must be obtained in Netlify before the Cloudflare `uye` record can safely be added. Do not point the hostname at the existing public site's Netlify target.
