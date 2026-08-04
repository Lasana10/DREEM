# DREEM Cloudflare + Supabase Launch

## Hosting shape

- Frontend host: Cloudflare Pages
- Backend platform: Supabase
- Current frontend root: `apps/web`
- Current Supabase project: `vpxtmgpxqlmkkyijuare`

## Cloudflare Pages setup

Connect the repo to Cloudflare Pages and use:

- Framework preset: `Vite`
- Root directory: `apps/web`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`

The repo already includes SPA routing and security files for Cloudflare Pages:

- `apps/web/public/_redirects`
- `apps/web/public/_headers`

## Cloudflare environment variables

Set these in Cloudflare Pages:

- `VITE_DEMO_MODE=false`
- `VITE_APP_URL=https://your-cloudflare-pages-domain.pages.dev`
- `VITE_SUPABASE_URL=https://vpxtmgpxqlmkkyijuare.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>`

## Supabase auth shape

Recommended launch auth:

- School-managed email + password
- Email sign-in link for passwordless access
- Later: phone auth after SMS provider setup
- Later: matricule-only login after secure resolver function is deployed

Important:

- Keep `shouldCreateUser=false` for sign-in link flow
- Do not allow public self-signup
- Do not expose the service-role key to the frontend

## Supabase project configuration

Apply this sequence in the Supabase dashboard/project:

1. Apply `supabase_schema.sql`
2. Set Site URL to the Cloudflare Pages production URL
3. Add local development URL `http://localhost:4173`
4. Configure branded auth email templates
5. Configure custom SMTP before production rollout
6. Rotate any secret that was pasted in chat before live use

## Edge Function to deploy

Function scaffold:

- `supabase/functions/provision-access-user/index.ts`

Purpose:

- leadership/support provisions real school users
- creates Supabase Auth account with service credentials
- writes `profiles`, `access_identities`, `access_invites`, and `audit_events`

Deploy it with JWT verification enabled.

Server-only environment values for function deployment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Render's role now

Render is no longer the main frontend host.

Use Render later for:

- sync workers
- report or PDF generation
- OneDrive background jobs
- heavier backend services that do not fit well in Supabase Edge Functions
