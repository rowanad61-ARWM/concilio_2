# Calendly SMS Reminders (Task 42c)

This job sends one SMS reminder for each Calendly engagement starting in the next 24 hours.

## MessageMedia API (Sinch)

- Base URL: `https://api.messagemedia.com` (override with `MESSAGEMEDIA_ENDPOINT`)
- Endpoint: `POST /v1/messages`
- Auth: `Authorization: Basic <base64(MESSAGEMEDIA_USERNAME:MESSAGEMEDIA_PASSWORD)>`
- Request body shape:
  - `messages[0].content` (SMS text)
  - `messages[0].destination_number` (E.164 with `+`, for example `+61400111222`)
  - `messages[0].source_number` (configured sender number in `MESSAGEMEDIA_SOURCE_NUMBER`)
  - `messages[0].delivery_report` (`false`)

Setup notes:
- Use your MessageNet AU portal username and password as `MESSAGEMEDIA_USERNAME` and `MESSAGEMEDIA_PASSWORD`.
- Use your dedicated virtual sender number from Senders / My Numbers as `MESSAGEMEDIA_SOURCE_NUMBER`.

## What Runs

- Endpoint: `POST /api/cron/calendly-sms-reminders`
- Auth header: `x-cron-secret: <CRON_SHARED_SECRET>`
- Query window: `opened_at` between now and now + 24 hours
- Idempotency: reminders are skipped once `engagement.reminder_sms_sent_at` is set

Required env vars:

- `CRON_SHARED_SECRET`
- `MESSAGEMEDIA_USERNAME`
- `MESSAGEMEDIA_PASSWORD`
- `MESSAGEMEDIA_SOURCE_NUMBER`
- optional `MESSAGEMEDIA_ENDPOINT`

## GitHub Secret Setup

1. Open your GitHub repo.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Create/update secret `CRON_SHARED_SECRET`.
4. Set the same value in Vercel project env var `CRON_SHARED_SECRET`.

Workflow file: `.github/workflows/calendly-sms-cron.yml`

## Manual Testing

### Local

Run dev server, then:

```bash
curl -X POST "http://localhost:3000/api/cron/calendly-sms-reminders" \
  -H "x-cron-secret: <your-secret>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Production

```bash
curl -X POST "https://concilio-2.vercel.app/api/cron/calendly-sms-reminders" \
  -H "x-cron-secret: <your-secret>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response shape:

```json
{
  "checked": 0,
  "sent": 0,
  "skipped": 0,
  "failed": 0,
  "details": []
}
```

## Disable / Pause

Option 1: Pause/disable the GitHub Actions workflow in the Actions UI.  
Option 2: Rotate `CRON_SHARED_SECRET` in Vercel only, which will cause incoming workflow calls to fail with `401`.