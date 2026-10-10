# FTK SaaS Web

Next.js frontend for the dance-school management app. Supabase is the authentication and data backend.

## Local development

1. Install Node.js 20.9+ and pnpm (or npm).
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and **publishable** key.
3. Run `pnpm install` then `pnpm dev`.

## Security

- Never put a Supabase `service_role`/secret key in frontend environment variables.
- Database access must be protected by Supabase RLS policies.
- Public signup must never grant the `admin` role. Role assignment belongs to trusted server-side/database logic.

## Deployment

Import this repository into Netlify, set the environment variables, and deploy with the Next.js runtime/plugin enabled.
