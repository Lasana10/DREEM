# DREEM World-Class Build Plan

## Product Position

DREEM should become a configurable education operations kernel, starting with bilingual private K-12 schools in Cameroon.

The goal is not to be a generic school dashboard. The goal is to run the operational life of a school:

- identity and access
- enrollment and learner registry
- academic continuity
- teacher daily work
- parent communication
- bursar-grade finance
- transport visibility
- audit and reversals
- offline resilience
- school-owned storage and deployment options

## What Is Strong Now

- React/Vite app builds successfully.
- Supabase is the main auth/database/function backend.
- Render worker lane exists for backend jobs.
- DREEM and TSIDKENU separation is documented.
- Google login is wired at frontend level.
- Authenticated Google users without DREEM membership now see a pending approval state.
- DREEM-specific membership foundation exists through `dreem_school_memberships`.
- Existing DREEM modules include academics, finance, operations, reporting, transport, and communications.
- Assignments can be published, submitted, and reviewed.
- Access provisioning Edge Function is deployed and writes both neutral identity and DREEM membership records.
- Access suspension/reactivation Edge Function is deployed and updates identities, DREEM memberships, and audit logs.
- R2 and B2 are now first-class storage providers in the app/database model.
- Render worker now exposes backup topology readiness for Supabase, R2, B2, OneDrive, and local-node planning.
- Render worker now logs backup attempts to Supabase `backup_jobs`, uploads school-scoped JSON snapshots to R2/B2 when credentials exist, and supports restore-test HEAD checks.
- Operations now has a school launch engine with readiness score.
- Operations now has a Cameroon bilingual private K-12 starter blueprint.

## What Is Still Not World-Class

- School onboarding is not yet a complete wizard with saved stages and approval history.
- Membership approval is structurally modeled but not yet a full admin approval queue for self-signed Google users.
- Access status control exists, but it still needs live end-to-end testing with real leadership/support users.
- Finance is useful but not yet accounting-grade double-entry.
- Offline sync exists as a concept/outbox, not a hardened IndexedDB sync engine.
- OneDrive is planned but not connected through Microsoft Graph OAuth yet.
- R2 and B2 are modeled, job-logged, and have worker-side snapshot/restore-test adapters, but still need live credential testing after deploy.
- Render worker checks integration readiness but does not yet run real sync/reporting/email jobs.
- Notifications are not implemented as a durable queue.
- Parent/student mobile app experience is still a PWA surface, not a dedicated React Native app.
- Cameroon reporting templates still need exact official formats.
- No production monitoring, backups, incident process, or support dashboard yet.

## Essential Build Order From Here

1. Complete DREEM membership approval queue.
2. Build full school onboarding wizard.
3. Convert fee workflows into invoice and receipt ledger.
4. Add durable notification queue.
5. Add indexed offline mutation engine.
6. Add report-card and result publication approval.
7. Add OneDrive/Microsoft Graph connection from Render worker.
8. Add transport trip/stops/guardian alert flow.
9. Add Cloudflare production deployment and Turnstile on public forms.
10. Add analytics only after operational data is reliable.

## Billion-Dollar Moat

DREEM becomes valuable if it owns the hard operational layer:

- schools can onboard without custom code
- finance is trusted
- staff daily work is easier
- parents actually receive useful updates
- offline work does not corrupt records
- schools keep data ownership
- each country can add a country pack
- partners can implement DREEM without forking code

The real moat is not "many modules." It is correctness, trust, configurability, offline resilience, and local-market fit.

## Current Technical Rule

DREEM and TSIDKENU may share Supabase Auth and `neutral_profiles`, but DREEM business access must flow through `dreem_school_memberships`.

Do not mix DREEM roles with TSIDKENU roles.
