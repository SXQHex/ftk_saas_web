# Pending operational checks

## Applied database changes

StudioSaaS has both production hardening migrations applied:
- `fix_group_lesson_visibility_for_open_ended_packages`: student SELECT policy accepts group packages with `ends_on IS NULL`; see [SQL](database-migrations/20261010030941_fix_group_lesson_visibility_for_open_ended_packages.sql).
- `harden_attendance_and_credit_ledger_writes`: validates attendance lesson/member combinations in RLS, prevents attendance updates in favour of admin delete + validated re-insert, makes credit transactions append-only for authenticated clients, and rejects direct API updates to credit balances; see [SQL](database-migrations/20261010032120_harden_attendance_and_credit_ledger_writes.sql).

Existing attendance has a unique index on `(lesson_id, member_id)`, and lesson credit consumption has a unique partial index on `(subscription_id, lesson_id)` for `lesson_use`, preserving idempotency.

## DNS and deployment

- Cloudflare DNS: `uye.fethiyetango.com CNAME ftksaasweb.netlify.app`, DNS-only, TTL Auto. The apex and `www` records still point at the existing public website.
- In Netlify, verify that `ftksaasweb.netlify.app` is connected to `SXQHex/ftk_saas_web`, `main` is the production branch, required Supabase environment variables are set, and `uye.fethiyetango.com` is added as a custom domain with HTTPS ready.
- The live endpoints could not be independently fetched from the available web/network tool; manually verify both `/api/health` URLs from a browser before production use.

## Remaining owner/security settings

- The Supabase Security Advisor reports leaked-password protection disabled. Enable it in StudioSaaS Authentication > Password/Security settings before operational use. Guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Set/verify Site URL `https://uye.fethiyetango.com` and allow `https://uye.fethiyetango.com/reset-password`.
- Promote only the intended studio-owner profile to `admin` using [initial-admin-setup.md](initial-admin-setup.md). The current profile still has the `student` role, so admin access is not yet activated.

## Migration tracking

Three earlier StudioSaaS migrations predate SQL files in this repository. Do not treat the two hardening files as a complete fresh-database bootstrap until the original baseline migrations are reconstructed or the database is provisioned through a controlled export.
