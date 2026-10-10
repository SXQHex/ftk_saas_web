# Pending operational checks

## Applied database changes

StudioSaaS has both production hardening migrations applied:
- `fix_group_lesson_visibility_for_open_ended_packages`: student SELECT policy accepts group packages with `ends_on IS NULL`; see [SQL](database-migrations/20261010030941_fix_group_lesson_visibility_for_open_ended_packages.sql).
- `harden_attendance_and_credit_ledger_writes`: validates attendance lesson/member combinations in RLS, prevents attendance updates in favour of admin delete + validated re-insert, makes credit transactions append-only for authenticated clients, and rejects direct API updates to credit balances; see [SQL](database-migrations/20261010032120_harden_attendance_and_credit_ledger_writes.sql).

Existing attendance has a unique index on `(lesson_id, member_id)`, and lesson credit consumption has a unique partial index on `(subscription_id, lesson_id)` for `lesson_use`, preserving idempotency.

## Remaining owner/security settings

- The Supabase Security Advisor reports leaked-password protection disabled. Enable it in StudioSaaS Authentication > Password/Security settings before operational use. Guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Verify Site URL and the password reset redirect URL for `https://uye.fethiyetango.com`.
- Promote only the intended studio-owner profile to `admin` using the trusted procedure in [initial-admin-setup.md](initial-admin-setup.md). The current database has one profile with the `student` role, so admin access is not yet activated.

## Deployment and migration tracking

- Code-level CI runs high-severity dependency audit, Biome lint, production build and HTTP health smoke tests.
- A new Netlify site must be created from `SXQHex/ftk_saas_web`; do not repurpose `fethiyetango.netlify.app`.
- The Cloudflare `uye` CNAME must point to the new site's exact Netlify hostname and remain DNS-only. Main-domain and `www` records are unchanged.
- Three earlier StudioSaaS migrations predate SQL files in this repository. Do not treat these two hardening files as a complete fresh-database bootstrap until the original baseline migrations are reconstructed or the database is provisioned through a controlled export.
