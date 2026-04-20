# Calendly Webhook Setup

## Callback URL
- `https://concilio-2.vercel.app/api/webhooks/calendly`

## 1) Create webhook subscription (org scope)

```powershell
$headers = @{
  Authorization = "Bearer $env:CALENDLY_PAT"
  "Content-Type" = "application/json"
}

$body = @{
  url = "https://concilio-2.vercel.app/api/webhooks/calendly"
  organization = $env:CALENDLY_ORG_URI
  events = @(
    "invitee.created",
    "invitee.canceled",
    "routing_form_submission.created"
  )
  scope = "organization"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.calendly.com/webhook_subscriptions" `
  -Headers $headers `
  -Body $body
```

Important: Calendly returns the webhook signing key once at creation. Record it immediately in RoboForm and set `CALENDLY_WEBHOOK_SIGNING_KEY`.

## 2) List org event types (for map row URI population)

```powershell
$headers = @{
  Authorization = "Bearer $env:CALENDLY_PAT"
}

$encodedOrg = [System.Web.HttpUtility]::UrlEncode($env:CALENDLY_ORG_URI)
$url = "https://api.calendly.com/event_types?organization=$encodedOrg&count=100"

Invoke-RestMethod -Method Get -Uri $url -Headers $headers
```

Populate `calendly_event_type_map.calendly_event_type_uri` for:
- `INITIAL_MEETING`
- `FIFTEEN_MIN_CALL`
- `GENERAL_MEETING`
- `ANNUAL_REVIEW`
- `NINETY_DAY_RECAP`

## 3) List current webhook subscriptions

```powershell
$headers = @{
  Authorization = "Bearer $env:CALENDLY_PAT"
}

$encodedOrg = [System.Web.HttpUtility]::UrlEncode($env:CALENDLY_ORG_URI)
$url = "https://api.calendly.com/webhook_subscriptions?organization=$encodedOrg&count=100"

Invoke-RestMethod -Method Get -Uri $url -Headers $headers
```

## 4) Delete a webhook subscription

```powershell
param(
  [Parameter(Mandatory = $true)]
  [string]$WebhookSubscriptionUri
)

$headers = @{
  Authorization = "Bearer $env:CALENDLY_PAT"
}

Invoke-RestMethod -Method Delete -Uri $WebhookSubscriptionUri -Headers $headers
```
