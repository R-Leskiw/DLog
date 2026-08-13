# BuildTrack — Supabase, GitHub, and Vercel setup

Follow these steps in order. **Never commit** `.env.local` (it is gitignored).

## 1. Supabase (free plan)

1. Create a project at [supabase.com](https://supabase.com) (Free plan).
2. **Project Settings → API** — copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Paste into `.env.local` (copy from `.env.example` if needed).
4. **SQL Editor** — run entire file: [`supabase/setup_all.sql`](supabase/setup_all.sql)
5. **Existing projects that already ran setup earlier** — also run [`supabase/migrations/0003_admin_jobs_approvals.sql`](supabase/migrations/0003_admin_jobs_approvals.sql) (admin role, signup approvals, jobs edit policies).
6. **Storage** — create bucket **`log-images`**, set **Public bucket** ON.
7. **SQL Editor** — run [`supabase/storage_policies.sql`](supabase/storage_policies.sql)
8. **Authentication → Providers** — enable Email.
9. **Authentication → URL Configuration**:

   | Setting | Value |
   |---------|--------|
   | Site URL (local) | `http://localhost:3000` |
   | Redirect URLs | `http://localhost:3000/auth/callback` |
   | | `http://localhost:3001/auth/callback` (optional) |

   After Vercel deploy, add production URLs (see section 4).

10. Enable **Confirm email** if you want the in-app verify-email flow.

11. **Promote your first admin** (one-time). After you have signed up and completed onboarding, run in SQL Editor (replace the email):

```sql
UPDATE public.profiles p
SET role = 'admin',
    approval_status = 'approved',
    reviewed_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'you@example.com';
```

Then sign out and sign back in. You should see **Admin** in the nav.

## 2. Local dev

```powershell
$env:Path = "c:\Program Files\nodejs;" + $env:Path
cd "C:\Users\proje\OneDrive\Desktop\Co-op Student\Ryan\DLog-github"
npm install
npm run dev:fresh
```

Open **http://localhost:3000** (use the port shown in the terminal).

Verify: sign up → verify email → onboarding → pending approval → (admin approves) → home feed → add log (employee) → comment. Admin: manage jobs + approvals.

## 3. GitHub

1. Create a new repo on GitHub (private recommended). Do not add README/gitignore from GitHub.
2. Push from this folder (Git must be on PATH, or use full path to `git.exe`):

```powershell
.\scripts\push-github.ps1 -RepoUrl "https://github.com/YOUR_USERNAME/YOUR_REPO.git"
```

Or manually:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

The repo is already initialized locally with an initial commit; you only need to add the remote and push.

## 4. Vercel (live app — not GitHub Pages)

This app needs a Node host (middleware, auth callback). **Use Vercel**, not GitHub Pages.

1. [vercel.com](https://vercel.com) → Import GitHub repo.
2. Add environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy and copy your URL, e.g. `https://your-app.vercel.app`.
4. In Supabase **Authentication → URL Configuration**, add:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URL: `https://your-app.vercel.app/auth/callback`
   - For preview deploys: `https://*.vercel.app/auth/callback` (wildcard if supported)

## Checklist

- [ ] Supabase project healthy
- [ ] `setup_all.sql` ran without errors
- [ ] Existing DB: `0003_admin_jobs_approvals.sql` ran
- [ ] First admin promoted via SQL (your email)
- [ ] `log-images` bucket + `storage_policies.sql`
- [ ] `.env.local` filled; local sign-up works
- [ ] Code pushed to GitHub (no `.env.local` in repo)
- [ ] Vercel deployed with same env vars
- [ ] Supabase auth URLs include production Vercel URL
