# DREEM requirements ledger

This ledger distinguishes product implementation from connection, verification and production proof. A capability is never marked production-proven merely because code or schema exists.

| ID | Capability | DREEM implementation state | Remaining production evidence |
|---|---|---|---|
| DREEM-FINANCE-001 | Verified Money Trail | Payment identity, protected recording, allocation, receipt, confirmation token, cashier custody, independent review, deposit and settlement screens/commands implemented | Apply/verify migrations on DREEM production; complete bursar → accountant → family E2E with real school evidence |
| DREEM-FINANCE-002 | Provider-neutral payment rails | Rail catalogue, authority-controlled school configuration UI/RPC, merchant-reference validation and provider-neutral collection model implemented | Configure real school merchant accounts; implement/verify each official provider's signed callback contract with sandbox/live credentials |
| DREEM-FINANCE-003 | Cash chain of custody | Cash collection, till closure, independent review, approved-cash selection, deposit batch and independent settlement confirmation have operational screens and database commands | Real two-person cash-office proof on production data |
| DREEM-FINANCE-004 | Parent payment witness | Expiring one-time acknowledgement RPC, public no-login confirm/dispute page, durable SMS acknowledgement-link dispatch and provider retry state implemented | Configure DREEM_APP_URL and SMS provider; prove sent → confirm/dispute → finance evidence end to end |
| DREEM-ACCESS-001 | Institution and role isolation | Institutional positions/scopes, legacy migration bridge, explicit-zero authority preservation, family self-service separation and position access preview implemented | Apply/verify migrations; run cross-school and every-role RLS matrix on the DREEM production project |
| DREEM-OFFLINE-001 | Offline-resilient operations | IndexedDB outbox, scoped replay, payload digests, retry/backoff, idempotency dedupe and conflicting-evidence rejection implemented for supported offline commands | Device disconnect/reconnect tests, duplicate replay test and conflict-resolution browser proof. Final money settlement remains server-authoritative rather than silently finalizing offline |
| DREEM-ACADEMICS-001 | Verified academic delivery | Teaching ownership, timetable controls, lesson plans, assessment moderation, report snapshots and role-native academic workspaces implemented; automated quality gate covered | Two-person author/reviewer browser proof plus family report access on production |
| DREEM-TRANSPORT-001 | Consent-controlled school transport | Guardian consent, routes/stops, vehicles/drivers, assignments, dispatch, Driver workspace, journey events, pickup-circle authorization and Gate verification implemented | Transport-manager/driver/family/gate role matrix and a live journey proof |
| DREEM-NOTIFY-001 | Durable communications | Announcement delivery queue, Resend email adapter, provider-neutral SMS/WhatsApp webhooks, authority-aware dispatcher and worker trigger implemented | Provider credentials and real delivery receipts on DREEM production |
| DREEM-BACKUP-001 | Multi-lane school backup | R2/B2 signed S3 snapshot + restore checks and real OneDrive Microsoft Graph snapshot transfer implemented; job evidence stored in backup_jobs | Configure DREEM worker credentials, R2/B2/OneDrive destination credentials and execute/restore-test real school snapshots |
| DREEM-PROD-001 | Isolated production foundation | Repository and deployment configuration point to DREEM Supabase project `vlukkucwtfmfgpzvjyvd`; TSIDEK references removed from production runbooks/configuration touched by deployment | Connect that DREEM project to the available Supabase tooling, run migrations/advisors, deploy Edge Functions and complete production browser verification |
| DREEM-WORKER-001 | Integration worker | Current worker code includes backup adapters and notification dispatcher delegation | Render production is behind repository history and must be redeployed from current `main`, then health/integration endpoints verified |

## Release vocabulary

- **Vision** — agreed outcome only.
- **Implemented** — code/schema exists and passes repository quality gates.
- **Connected** — required live infrastructure and credentials are configured.
- **Verified** — automated and role-based end-to-end checks pass against the intended environment.
- **Production-proven** — the live deployment completed the workflow with controlled real-world evidence.

## Release rule

A workflow is not finished merely because CI is green. DREEM production certification requires an identifiable owner, state transition, handoff, timestamp/audit evidence, positive authorization test, negative authorization test and—where an external provider is involved—provider evidence.
