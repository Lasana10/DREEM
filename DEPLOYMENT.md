# DREEM Deployment

DREEM must be deployed as its own Cloudflare application, separate from AFAT/AsTeck.

## Cloudflare Pages

Create a dedicated Cloudflare Pages project:

- Project name: `dreem-school-os`
- Git repository: `Lasana10/DREEM`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`

Required environment variables:

```text
VITE_SUPABASE_URL=https://vlukkucwtfmfgpzvjyvd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<rotated-supabase-publishable-key>
VITE_DREEM_DEMO_MODE=false
```

Use this repository's root `wrangler.jsonc`. It publishes only DREEM under
the `dreem-school-os` identity. Never reconnect this project to
`Lasana10/asteck-bot`; that repository remains the AFAT production surface.

## Supabase Edge Functions

Deploy `provision-access-user` and `update-access-status` from `supabase/functions`. Both require JWT verification. Supabase provides the project URL and built-in server keys inside the function runtime; add only:

```text
DREEM_APP_URL=<deployed DREEM application URL>
```

Never copy `SUPABASE_SERVICE_ROLE_KEY` into the Vite or Cloudflare frontend environment.

## Direct Wrangler Deploy

From the repository root:

```powershell
cd DREEM
npm ci
npm run build
npx wrangler deploy
```

This uses `wrangler.jsonc`, whose Cloudflare worker/static-assets name is `dreem-school-os`.

## Render

Render is not the primary DREEM frontend host. Keep Render for backend compatibility services only when needed. The DREEM web app should live on Cloudflare under its own project identity.
