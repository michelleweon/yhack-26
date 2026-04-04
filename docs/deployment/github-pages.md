# GitHub Pages Setup

This repo is configured to work on GitHub Pages as a single-page app.

## What changed

- Routing uses `HashRouter`, so routes work on static hosting.
- Vite uses a relative asset base, so the build works under a repo subpath.
- A GitHub Actions workflow deploys `dist/` to Pages from `main`.

## One-time GitHub setup

1. Push this repo to GitHub.
2. In GitHub, open `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions`.
4. In `Settings` -> `Secrets and variables` -> `Actions`, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Hosted URLs

After deploy, use:

- Host: `https://<your-user>.github.io/<repo>/#/host`
- Players: `https://<your-user>.github.io/<repo>/#/play`
- Start screen: `https://<your-user>.github.io/<repo>/#/`

## Supabase note

If your Supabase project uses email confirmation or redirect-based auth, add your GitHub Pages URL to the allowed site/redirect URLs in Supabase.
