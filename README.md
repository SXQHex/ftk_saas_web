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
5. Run `npm run lint` to check JavaScript and TypeScript with Biome.

## Admin setup

See [docs/initial-admin-setup.md](docs/initial-admin-setup.md) to securely promote the intended owner profile through the Supabase SQL Editor. Public sign-up remains `student` by default.

## Application modules

- Dashboard overview
- Member list, edit and active/inactive status (admin)
- Lesson planning and status controls (admin); read-only calendar for instructors
- Attendance entry (admin/instructor); credit consumption runs through database triggers
- Subscriptions and payment status (admin)
- Credit transaction ledger and audited manual adjustments (admin)

## Security

- Never put a Supabase `service_role`/secret key in frontend environment variables.
- Database access must be protected by Supabase RLS policies.
- Public signup must never grant the `admin` role. Role assignment belongs to trusted server-side/database logic.

## Deployment

Import this repository into Netlify and configure the environment variables listed in `.env.example`. Netlify reads `.nvmrc` to select Node.js 26 for builds. Use the Next.js runtime/plugin; do not configure the app as a static-only export.
