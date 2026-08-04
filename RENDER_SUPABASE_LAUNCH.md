# DREEM Render Backend Lane

## Purpose

Render is no longer the primary public frontend host for DREEM.

Use Render for backend-style services such as:

- sync workers
- long-running reporting jobs
- OneDrive and external storage sync
- document or PDF generation
- heavier orchestration that does not belong in Supabase Edge Functions

## Relationship to the main stack

Primary deployment path:

- Cloudflare Pages for the web app
- Supabase for auth, database, storage, realtime, and Edge Functions

Render stays optional and complementary.

## Current Render-ready service

The repo now contains a Render Blueprint:

- [render.yaml](C:/Users/MEDION/Documents/Codex/2026-05-13/i-have-checked-well-and-i/render.yaml)

It deploys:

- service name: `dreem-worker`
- root directory: `apps/worker`
- health endpoint: `/health`
- integration status endpoint: `/integrations/status`
- OneDrive job readiness endpoint: `/jobs/onedrive-sync`
- email job readiness endpoint: `/jobs/email-dispatch`

Direct Render links:

- [Render dashboard](https://dashboard.render.com/)
- [Render environment variable docs](https://render.com/docs/configure-environment-variables)
- [Render Blueprint docs](https://render.com/docs/blueprint-spec)

## Likely Render environment values later

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_DREEM_BUCKET`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_REGION`
- `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_DREEM_BUCKET_NAME`, `B2_S3_ENDPOINT`, `B2_REGION`
- `DREEM_WORKER_JOB_SECRET`
- `DREEM_WEB_ORIGIN`

These belong only in server-side services, never in the frontend app.

After Render deploys, verify `GET /health` is HTTP 200, then trigger the school-scoped R2 and B2 backup endpoints with the job secret. Use the returned `objectKey` for the corresponding restore-test endpoint. A green topology card alone is not proof of a successful backup.

## Environment values to set in Render now

Required:

```text
SUPABASE_URL=https://vpxtmgpxqlmkkyijuare.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_ROTATED_SERVER_ONLY_KEY
```

Optional until integrations are ready:

```text
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
ONEDRIVE_TENANT_ID=common
ONEDRIVE_REDIRECT_URI=https://YOUR_RENDER_SERVICE.onrender.com/oauth/onedrive/callback
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=DREEM <noreply@your-domain.com>
```

Do not put these server secrets into `apps/web/.env.local`.

## Current Supabase function scaffold

The current provisioning function belongs on Supabase first:

- `supabase/functions/provision-access-user/index.ts`

Purpose:

- leadership/support provisions real school users
- creates Supabase Auth accounts with service credentials
- writes `profiles`, `access_identities`, `access_invites`, and `audit_events`

## Security note

The service-role style secret that was pasted in chat should be treated as compromised. Rotate it before production use and place the rotated value only in server-side environments.
