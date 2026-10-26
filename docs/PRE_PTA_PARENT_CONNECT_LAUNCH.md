# DREEM Parent & PTA Connect — controlled first release

This is an incremental module in the existing root Vite DREEM application. Do not migrate the school to a new app.

## Purpose
Parents submit ordinary school-improvement concerns, questions and suggestions before a PTA/APEE meeting. Leadership reviews private submissions, writes proposals per category and copies an aggregate, anonymised pre-meeting briefing. The portal switches between English and French and is mobile-first.

## Security / readiness gates (required before sharing any URL)
1. CI `npm run check` and the viewport smoke workflow must succeed on the final commit.
2. Apply `20261026150000_public_pre_pta_parent_voice.sql` to the **authorised DREEM Supabase project**, then verify campaign reads and row restrictions with school-level users and anonymous clients. Do not assume that a committed migration has been applied.
3. Deploy `pta-public-submit` Supabase Edge Function with JWT verification disabled **for this function only**; it verifies Cloudflare Turnstile and writes with a server-only Supabase service role. Never expose a service role key in the frontend.
4. Configure secret `TURNSTILE_SECRET_KEY` on the Edge Function and `VITE_TURNSTILE_SITE_KEY` for the Cloudflare frontend build. Configure `DREEM_PUBLIC_ORIGIN` to match the actual parent portal origin (default `https://dreem-school-os.pages.dev`). Register that hostname in the Cloudflare Turnstile widget settings. The form fails closed without a configured site key or server secret.
5. Confirm that **direct anonymous RPC calls** to `dreem_pta_submit` fail, while `pta-public-submit` works with a valid, single-use CAPTCHA and refuses invalid/replayed tokens.
6. Confirm cross-school access is denied and test staff role restrictions, unpublished/expired campaigns, wrong ids, bilingual accessibility, slow phone connections and CSP for Turnstile scripts.
7. Review school privacy notices, data retention, required deletion, data export and lawful handling of contact details. Disable public links if monitored intake is unavailable.
8. **Do not use PTA intake for urgent safeguarding reports.** The public form rejects that topic and tells parents to contact the school's safeguarding official directly. Publish a verified emergency contact route separately before broader release.
9. Cloudflare/edge abuse protection and logs should be checked before broad distribution. Turnstile is a baseline control, not a guarantee against abuse.
10. Only after independent acceptance: publish a campaign from School Communications and share the generated `/pta/<campaign-id>` link via WhatsApp, school circular and QR code.

## School workflow
- Leadership creates bilingual campaign: draft by default.
- Leadership publishes campaign after launch checks.
- Parent opens public link, selects language and category, verifies anti-bot challenge and submits a concern.
- Parent receives a receipt reference only after server confirmation.
- Staff see private submissions under existing Communications permissions; staff assign review status and write solutions, responsible officers and target dates by topic.
- Copy anonymised briefing to prepare PTA agenda, then **manually check the copied text for confidentiality and accuracy before circulating it**. Individual messages, contact details and child safety cases are not copied.
- After the meeting, leadership finalises actions and communicates approved non-confidential resolutions using DREEM's existing communications functionality.

## Current scope limits
No production deployment or migration is implied by this document. There is no verified alerting path for safeguarding, automatic parent receipt lookup, or independent audit of response plans yet. These must not be represented as live services.
