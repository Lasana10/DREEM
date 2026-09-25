# DREEM Supabase CLI Runbook

This repository targets DREEM's isolated production Supabase project.

## Production project

- Project ref: `vlukkucwtfmfgpzvjyvd`
- Frontend URL: `https://vlukkucwtfmfgpzvjyvd.supabase.co`
- DREEM and TSIDKENU must not share production business data, role tables, service-role credentials, or deployment configuration.
- Repository migrations live under `supabase/migrations/`.
- Edge Functions live under `supabase/functions/`.

The connected Supabase account/tooling must show project `vlukkucwtfmfgpzvjyvd` before any production schema, function, advisor, or secret operation is executed. If it is not visible, stop rather than applying DREEM changes to another project.

## Safe deployment flow

From the repository root:

```powershell
supabase login
supabase link --project-ref vlukkucwtfmfgpzvjyvd
supabase migration list
supabase db push
supabase functions deploy provision-access-user
supabase functions deploy update-access-status
supabase functions deploy dispatch-notifications
```

Discover the current CLI commands with `supabase --help` and the relevant subcommand `--help` before changing this flow.

## Verification after schema/function changes

1. Confirm the linked project ref is `vlukkucwtfmfgpzvjyvd`.
2. Run migration status and confirm local/remote history align.
3. Run Supabase security and performance advisors.
4. Verify RLS remains enabled on exposed public tables.
5. Verify public views that should respect underlying RLS use security-invoker semantics.
6. Test one approved user and one denied/cross-school user for each changed authorization path.
7. Verify Edge Functions with real authenticated requests; a successful deployment alone is not functional proof.

## Server-only secrets

Server secrets belong only in Supabase Edge Function or worker environments:

```powershell
supabase secrets set SUPABASE_URL=https://vlukkucwtfmfgpzvjyvd.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_ROTATED_SERVER_ONLY_KEY
```

Notification dispatch additionally uses provider secrets such as:

```text
RESEND_API_KEY=
DREEM_FROM_EMAIL=
SMS_WEBHOOK_URL=
SMS_WEBHOOK_TOKEN=
WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_TOKEN=
```

Only configure the channels the school actually enables.

## Production rules

- Never put `SUPABASE_SERVICE_ROLE_KEY` in Vite/frontend environment variables.
- Rotate any server credential that has been pasted into chat, source control, logs, or a client build.
- Do not use TSIDKENU project `vpxtmgpxqlmkkyijuare` for DREEM deployment.
- Do not reset or delete remote objects to resolve migration drift without first identifying which migration owns them.
- Treat CI success, database migration success, and production browser proof as separate release gates.
