# Supabase CLI Runbook

This repo is now prepared for a CLI-driven schema flow.

## Current project

- Project ref: `vpxtmgpxqlmkkyijuare`
- Supabase dashboard: [TSIDEK project](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare)
- Edge Functions dashboard: [Functions](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/functions)
- Auth users dashboard: [Auth users](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/auth/users)
- SQL editor: [SQL editor](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/sql)
- Main migration: [supabase/migrations/20260712130000_initial_schema.sql](C:/Users/MEDION/Documents/Codex/2026-05-13/i-have-checked-well-and-i/supabase/migrations/20260712130000_initial_schema.sql)
- Assignment submissions migration: [supabase/migrations/20260724103000_assignment_submissions.sql](C:/Users/MEDION/Documents/Codex/2026-05-13/i-have-checked-well-and-i/supabase/migrations/20260724103000_assignment_submissions.sql)
- DREEM membership boundary migration: [supabase/migrations/20260728110000_neutral_profiles_and_dreem_memberships.sql](C:/Users/MEDION/Documents/Codex/2026-05-13/i-have-checked-well-and-i/supabase/migrations/20260728110000_neutral_profiles_and_dreem_memberships.sql)
- Edge Function: [supabase/functions/provision-access-user/index.ts](C:/Users/MEDION/Documents/Codex/2026-05-13/i-have-checked-well-and-i/supabase/functions/provision-access-user/index.ts)

## Current live status

- Database migrations for workflow corrections, richer school configuration, student controls, and operational grants are applied on the live project.
- Assignment submissions table is applied live with RLS and limited authenticated grants.
- Shared-project boundary tables are applied live:
  - `neutral_profiles`
  - `dreem_school_memberships`
- `provision-access-user` is deployed as version `2` and writes DREEM membership rows.

## DREEM vs TSIDKENU separation

DREEM and TSIDKENU can temporarily share Supabase Auth, but they must not share business authorization.

DREEM checks `dreem_school_memberships`.

TSIDKENU should later check `tsid_firm_memberships`.

Do not create generic product-role tables that mix school and firm permissions.
- Edge Function `provision-access-user` is deployed and `ACTIVE`.
- `provision-access-user` has Supabase platform JWT verification enabled.
- The frontend live access-provisioning flow calls this Edge Function.

## Recommended flow

Run these commands from the repo root:

```powershell
supabase login
supabase link --project-ref vpxtmgpxqlmkkyijuare
supabase db push
supabase functions deploy provision-access-user
```

Use this when redeploying from the CLI. The current function was deployed through Supabase MCP because local CLI auth was not available.

## If the project is not initialized locally

If `supabase link` complains about local project setup, run:

```powershell
supabase init
```

Then rerun:

```powershell
supabase link --project-ref vpxtmgpxqlmkkyijuare
supabase db push
supabase functions deploy provision-access-user
```

## Function secrets

Before deploying or testing the Edge Function, verify server-side secrets:

```powershell
supabase secrets set SUPABASE_URL=https://vpxtmgpxqlmkkyijuare.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Supabase commonly provides some runtime variables automatically, but for production we should explicitly verify this function can read the service role secret before using it to onboard real users.

## Important

- Do not put `SUPABASE_SERVICE_ROLE_KEY` in frontend env vars.
- Rotate any secret that was previously pasted into chat before production use.
- If `db push` fails because the remote database already has partial objects from manual SQL runs, reset only the conflicting objects first, then rerun `supabase db push`.
