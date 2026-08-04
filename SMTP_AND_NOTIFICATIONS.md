# SMTP and Notifications

## Recommendation

Do not let SMTP block the product. DREEM can start with Supabase Auth email/OTP and later add transactional email for:

- school invitations
- payment receipts
- parent reminders
- transport delay alerts
- weekly academic summaries

## Best simple path

Use a transactional email provider first, not a random mailbox SMTP password.

Good options:

- [Resend](https://resend.com/)
- [Brevo SMTP](https://www.brevo.com/products/transactional-email/)
- [SendGrid](https://sendgrid.com/)

If using normal SMTP, DREEM needs:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=DREEM <noreply@your-domain.com>
```

Put these only in Render or Supabase Edge Function secrets, never in frontend env.

## Current implementation state

The Render worker now exposes:

- `/health`
- `/integrations/status`
- `/jobs/email-dispatch`

For now `/jobs/email-dispatch` checks whether SMTP is configured. The real queue sender should come after we define the notification table and templates.

## Direct setup links

- [Render environment variables](https://render.com/docs/configure-environment-variables)
- [Supabase Auth SMTP settings](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/auth/providers)
- [Supabase Edge Function secrets](https://supabase.com/dashboard/project/vpxtmgpxqlmkkyijuare/functions/secrets)
