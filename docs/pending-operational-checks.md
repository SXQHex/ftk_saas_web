# Pending operational checks

These items are intentionally documented rather than changed automatically.

## Student access to group lessons

The current student-facing `lessons_staff_all_student_own` RLS policy checks:

```sql
s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date
```

Group packages are now created with `ends_on = NULL`, so the comparison evaluates to unknown and can hide valid group lessons from student accounts. Before opening student-facing lesson views, prepare and review a migration that treats no end date as open-ended:

```sql
s.ends_on is null
or s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date
```

This is a database policy change and has **not** been applied by this repository update.

## Password security

The Supabase security advisor reports that leaked-password protection is disabled. Enable it from the StudioSaaS project's Auth password/security settings before inviting real users. See the [Supabase password security guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Deployment

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the production hosting environment. The repository's GitHub validation uses Node.js 26; a green build does not mean a hosting deployment or live Auth flow has been completed.
