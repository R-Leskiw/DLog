# BuildTrack

Construction daily logs and team feed — Next.js 15, Supabase (auth, database, storage), Tailwind, shadcn UI.

## Quick start

1. **Clone** and install:

   ```bash
   npm install
   cp .env.example .env.local   # Windows: copy .env.example .env.local
   ```

2. **Supabase** — full steps in [SETUP.md](SETUP.md) (free tier).

3. **Run locally:**

   ```bash
   npm run dev:fresh
   ```

   Open http://localhost:3000 (or the port printed in the terminal).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run dev:fresh` | Delete `.next` cache, then dev |
| `npm run build` | Production build |
| `npm run clean` | Remove `.next` |

## Project layout

- `src/app` — App Router pages (auth, feed, logs)
- `src/components` — UI and feature components
- `supabase/setup_all.sql` — One-shot DB + RLS for new projects
- `DATABASE_SCHEMA.sql` — Reference schema
- `PROJECT_SPEC.md` / `UX_PLAN.md` — Product docs

## Deploy

- **Source code:** GitHub (see [SETUP.md](SETUP.md))
- **Hosting:** [Vercel](https://vercel.com) (recommended for Next.js + Supabase SSR)
- **Not supported:** GitHub Pages (static only; this app uses server middleware and auth routes)

## Environment variables

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel |

Never commit secrets. `.env*` is gitignored.
