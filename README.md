# FTK SaaS Web

Next.js frontend for the dance-school management app. Supabase is the authentication and data backend.

## Runtime

- Next.js: `16.4.0`
- Node.js: `26.x` (pinned via `.nvmrc` and enforced by `package.json`)

## Local development

1. Install Node.js 26.x and pnpm (or npm).
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and **publishable** key.
3. Install dependencies with `pnpm install` (or `npm install`).
4. Run `pnpm dev` (or `npm run dev`).

## Security

- Never put a Supabase `service_role`/secret key in frontend environment variables.
- Database access must be protected by Supabase RLS policies.
- Public signup must never grant the `admin` role. Role assignment belongs to trusted server-side/database logic.

## Deployment

Import this repository into Netlify and configure the environment variables listed in `.env.example`. Netlify reads `.nvmrc` to select Node.js 26 for builds. Use the Next.js runtime/plugin; do not configure the app as a static-only export.
