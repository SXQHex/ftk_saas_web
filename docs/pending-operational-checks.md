# Pending operational checks

## Applied RLS fix

The StudioSaaS migration `fix_group_lesson_visibility_for_open_ended_packages` is applied. It updates the student lesson SELECT policy to treat `ends_on IS NULL` as open-ended, matching the group subscription rule where four credits expire by usage, not by a fixed calendar window. The SQL used is stored at [database-migrations/20261010030941_fix_group_lesson_visibility_for_open_ended_packages.sql](database-migrations/20261010030941_fix_group_lesson_visibility_for_open_ended_packages.sql). No user roles or production records were changed.

Note: the original three StudioSaaS migrations predate SQL migration files in this repository. Do not run a fresh database provisioning from repository files alone until those baseline migrations are reconstructed/checked into version control.

## Remaining owner/security settings

- The Supabase Security Advisor reported that leaked-password protection is disabled. Enable it in StudioSaaS Authentication > Password/Security settings before operational use. Guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Verify Site URL and the password reset redirect URL for `https://uye.fethiyetango.com`.
- Promote only the intended studio-owner profile to `admin` using the trusted procedure in [initial-admin-setup.md](initial-admin-setup.md). The current database has one profile with the `student` role, so admin access is not yet activated.

## Deployment status

- Code-level CI runs high-severity dependency audit, Biome lint, production build and HTTP health smoke tests.
- A new Netlify site must be created from `SXQHex/ftk_saas_web`; do not repurpose `fethiyetango.netlify.app`.
- The Cloudflare `uye` CNAME must point to the new site's exact Netlify hostname and remain DNS-only. The main domain and `www` records have not been changed.
