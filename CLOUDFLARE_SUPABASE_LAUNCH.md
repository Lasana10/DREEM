# DREEM Cloudflare + Supabase Launch

## Authoritative production app

DREEM production is the **root Vite application** in this repository.

- Frontend host: Cloudflare Pages / Workers
- Production frontend root: `/`
- Production source: `src/`
- Build output: `dist`
- Supabase project: `vlukkucwtfmfgpzvjyvd`

The older `apps/web` tree is retained only as legacy/reference code. **Do not configure Cloudflare production to build from `apps/web`.** New product work and production fixes belong to the root application.

## Cloudflare setup

Connect `Lasana10/DREEM` to Cloudflare and use:

- Framework preset: `Vite`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`

The root `wrangler.jsonc` provides SPA fallback and direct Worker asset configuration. The production build must come from the same root app that passes the repository quality gate.

## Cloudflare environment variables

Set these for production:

- `VITE_SUPABASE_URL=https://vlukkucwtfmfgpzvjyvd.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>`
- `VITE_DREEM_DEMO_MODE=false`

If the deployment uses an explicit public app URL, set it to the verified production domain rather than a placeholder.

## Supabase auth shape

Recommended launch auth:

- School-managed email + password
- Email sign-in link where configured
- Later: phone auth after SMS provider setup
- Later: matricule-based sign-in only after a secure resolver is deployed

Important:

- Do not allow uncontrolled public self-signup
- Do not expose the service-role key to the frontend
- Keep authorization in Supabase/RLS and server-side commands; frontend role labels are not security authority

## Supabase project configuration

Use project `vlukkucwtfmfgpzvjyvd` as DREEM's system of record. Apply repository migrations in order rather than re-creating a second database from an old schema snapshot.

Production setup should include:

1. Apply pending `supabase/migrations/*` in order.
2. Set the Supabase Site URL to the verified Cloudflare production URL.
3. Add the approved local development URL where needed.
4. Configure branded auth email templates.
5. Configure custom SMTP before broad production rollout.
6. Keep server-only secrets out of frontend environment files.

## Edge Functions

Use the functions under `supabase/functions/` for trusted server-side actions such as access provisioning and notification work. Deploy with the authentication requirements defined by each function and keep service credentials server-side only.

Server-only values include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Render's role

Render is not DREEM's frontend host. It remains a compatibility lane for background work that has not yet moved to Cloudflare/Supabase, such as sync jobs, report/PDF generation, OneDrive jobs, or heavier workers.

## Deployment rule

A merged PR is **not** proof of production deployment. For each release verify:

1. `main` contains the intended commit.
2. The DREEM quality gate passes.
3. Cloudflare builds from repository root `/`.
4. The deployed commit matches `main`.
5. Sign-in and at least one role-native workflow are smoke-tested against the production Supabase project.
