# DREEM and TSIDKENU Supabase Boundary

## Current Decision

DREEM and TSIDKENU may temporarily share one Supabase project, but they must not share business authorization or operational tables.

They may share:

- `auth.users`
- `neutral_profiles`
- one Google OAuth provider configuration
- future neutral SMTP sender configuration
- future Turnstile configuration after public deployment

DREEM owns:

- `dreem_school_memberships`
- `dreem_*` future tables
- existing DREEM school tables such as `schools`, `profiles`, `students`, `fee_accounts`, `attendance`, `classroom_materials`, and related tables during the compatibility phase
- DREEM Cloudflare deployment
- DREEM Render worker
- DREEM R2/B2 buckets
- DREEM audit categories and workflows

TSIDKENU must own separately:

- `tsid_firm_memberships`
- `tsid_*` tables
- TSIDKENU frontend deployment
- TSIDKENU R2/B2 buckets
- TSIDKENU worker bindings
- TSIDKENU migrations, audit categories, and legal/business workflows

## Security Rule

Neither product may trust product name, organisation, school, firm, role, or permissions supplied by the frontend.

After Supabase login:

- DREEM checks `dreem_school_memberships`
- TSIDKENU should check `tsid_firm_memberships`

Google proves the person. Membership grants product access.

## Current DREEM Compatibility Model

DREEM still has the older `profiles` table because many existing tables reference it. The safe transition is:

1. Keep `profiles` working for current DREEM modules.
2. Add `neutral_profiles` for shared Supabase identity.
3. Add `dreem_school_memberships` for DREEM-specific approval.
4. Update helper functions to prefer approved DREEM membership.
5. Move future DREEM authorization decisions toward `dreem_school_memberships`.
6. Only later rename or replace legacy `profiles` after all dependencies are migrated.

## Live Status

- `neutral_profiles` exists.
- `dreem_school_memberships` exists.
- RLS is enabled on both tables.
- `authenticated` grants are limited to `SELECT`, `INSERT`, and `UPDATE`.
- `provision-access-user` Edge Function is deployed as version 2 and writes:
  - Supabase Auth user
  - `neutral_profiles`
  - legacy DREEM `profiles`
  - `dreem_school_memberships`
  - `access_identities`
  - `access_invites`
  - `audit_events`

## Google Login

Frontend Google login is wired through Supabase OAuth.

Important:

- Google OAuth must be enabled in the Supabase dashboard.
- Supabase redirect URLs must include the deployed DREEM frontend URL.
- A Google user without approved DREEM membership should not enter DREEM workspaces.

Direct links:

- [Supabase Auth Providers](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/auth/providers)
- [Supabase URL Configuration](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/auth/url-configuration)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## Turnstile

Turnstile is useful after public deployment for:

- school onboarding/application
- public admission forms
- repeated login abuse
- invitation acceptance

It is not required on every internal school operation.

## Resend or SMTP

Use email after domain acquisition for:

- staff invitations
- parent notifications
- security alerts
- admission updates
- fee reminders
- receipt delivery
- report-card publication notices

SMS, WhatsApp, or Telegram can later complement email for users with limited email access.
