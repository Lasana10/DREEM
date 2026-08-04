# DREEM Storage And Backup Topology

## Purpose

DREEM uses several storage lanes because school data must remain available even when one provider, network, or machine fails.

## Provider Roles

- Supabase: primary app database, realtime data, and app-native storage.
- Cloudflare R2: fast object replica for DREEM-owned buckets and deployment-adjacent assets.
- Backblaze B2: independent cold backup outside Supabase and Cloudflare.
- OneDrive: school-owned human-readable administrative copy and document recovery lane.
- Local node: future Raspberry Pi or school computer cache for offline resilience.

## Security Rule

Frontend code must never receive R2, B2, OneDrive, SMTP, or Supabase service-role secrets.

The browser may read:

- provider names
- readiness status
- bucket labels
- safe job availability

Only the Render worker or a future Cloudflare Worker may hold provider API keys.

## Render Worker Env

Required:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

OneDrive:

```env
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
ONEDRIVE_TENANT_ID=common
ONEDRIVE_REDIRECT_URI=https://your-render-service.onrender.com/oauth/onedrive/callback
```

Cloudflare R2:

```env
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_DREEM_BUCKET=dreem
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

Backblaze B2:

```env
B2_APPLICATION_KEY_ID=
B2_APPLICATION_KEY=
B2_DREEM_BUCKET_NAME=dreem-backup
B2_S3_ENDPOINT=https://s3.<region>.backblazeb2.com
```

Worker job protection:

```env
DREEM_WORKER_JOB_SECRET=replace-with-long-random-secret
```

## Worker Endpoints

- `GET /health`: complete runtime readiness.
- `GET /integrations/status`: integration readiness without secret values.
- `GET /backup/topology`: backup topology for the DREEM dashboard.
- `GET /backup/jobs?schoolId=<school-id>`: school-scoped worker-recorded backup attempts; requires `X-DREEM-WORKER-SECRET` when configured.
- `GET /jobs/onedrive-sync`: readiness preview.
- `POST /jobs/onedrive-sync`: records a blocked/ready job attempt until the OneDrive adapter is implemented.
- `GET /jobs/r2-backup`: readiness preview.
- `POST /jobs/r2-backup`: exports a school-scoped Supabase JSON snapshot and uploads it to R2 when credentials are configured.
- `GET /jobs/b2-backup`: readiness preview.
- `POST /jobs/b2-backup`: exports a school-scoped Supabase JSON snapshot and uploads it to B2 when credentials are configured.
- `GET /jobs/r2-restore-test`: readiness preview.
- `POST /jobs/r2-restore-test`: verifies an R2 snapshot object exists using a signed `HEAD` request.
- `GET /jobs/b2-restore-test`: readiness preview.
- `POST /jobs/b2-restore-test`: verifies a B2 snapshot object exists using a signed `HEAD` request.
- `GET /jobs/email-dispatch`: readiness preview.

If `DREEM_WORKER_JOB_SECRET` is configured, job `POST` requests must send:

```http
X-DREEM-WORKER-SECRET: your-secret
```

## Current Implementation State

- Worker now reports OneDrive, R2, B2, SMTP, and backup topology readiness.
- Worker now writes backup job attempts to Supabase `backup_jobs` instead of pretending transfer is complete.
- Worker now has S3-compatible snapshot upload adapters for R2 and B2.
- Worker now has restore-test endpoints for R2 and B2 using signed `HEAD` requests.
- Web app reads `VITE_WORKER_URL/backup/topology` when configured.
- Web app reads worker topology publicly; backup job history remains server-secret protected and is reserved for the authenticated operations console.
- Supabase `storage_connections` now accepts `cloudflare-r2` and `backblaze-b2`.
- Live Supabase has planned rows for R2 and B2 for the current school.
- Live Supabase has `backup_jobs` with RLS enabled and same-school read policy.

## Next Real Build

1. Add Microsoft Graph OAuth callback and refresh-token storage for OneDrive.
2. Add scheduled backups from Render Cron or Cloudflare Cron.
3. Add retention policies per school, provider, document type, and compliance level.
4. Add encrypted backup manifests and restore drills for complete snapshots.
5. Add Pi/local-node backup receiver for offline campuses.
