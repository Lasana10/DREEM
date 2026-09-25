# DREEM Notifications

## Production architecture

DREEM uses a durable notification queue rather than treating SMTP as the source of truth.

The current path is:

1. A school announcement is created and queued.
2. `dreem_notification_deliveries` records recipient/channel delivery state.
3. The `dispatch-notifications` Supabase Edge Function processes queued external deliveries.
4. Email uses Resend when configured.
5. SMS and WhatsApp use provider-neutral signed webhook adapters when configured.
6. A provider acceptance updates the delivery record; an unavailable provider remains retryable rather than being marked sent.

In-app delivery remains available independently of external providers.

## Required server configuration

Supabase Edge Function secrets for email:

```text
RESEND_API_KEY=
DREEM_FROM_EMAIL=
```

Optional provider adapters:

```text
SMS_WEBHOOK_URL=
SMS_WEBHOOK_TOKEN=
WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_TOKEN=
```

These values are server-only. Never place them in frontend environment variables.

## Render worker trigger

The Render worker endpoint `POST /jobs/email-dispatch` now delegates to the durable Supabase `dispatch-notifications` function instead of maintaining a second SMTP sender.

Request requirements:

- `X-DREEM-WORKER-SECRET` when worker job protection is configured
- JSON body containing `schoolId`
- optional `limit` (the Edge Function caps batches)

A successful HTTP trigger means the dispatcher accepted the job; inspect delivery status/evidence for actual provider acceptance.

## Production project

DREEM production project ref: `vlukkucwtfmfgpzvjyvd`.

Before deploying notification functions or secrets, confirm the connected Supabase project is this DREEM project. Do not use the TSIDKENU project for DREEM notification delivery.
