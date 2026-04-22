# Engagement Journey API Contract (43b)

These endpoints are server-side authenticated and require a valid Concilio session cookie.

## Auth Requirement

- All three endpoints return `401` with `{ "error": "unauthorized" }` when no session is present.
- In browser DevTools, open Network on any authenticated Concilio request and copy the `Cookie` header.
- Session cookie is typically one of:
  - `authjs.session-token=...` (local/non-secure)
  - `__Secure-authjs.session-token=...` (secure/prod)

---

## POST `/api/engagements/[id]/advance`

Advance an engagement journey to the next phase, or jump to a later chain phase.

### Request

- Method: `POST`
- Body (optional):

```json
{
  "targetPhaseKey": "implementation"
}
```

If omitted/empty, route advances from current phase to the next sequential phase.

### Success Response (200)

```json
{
  "closedInstance": {
    "id": "f3f8ad13-3db6-49fb-b68f-6fca9866ae25",
    "status": "completed",
    "completed_at": "2026-04-22T11:42:13.094Z",
    "workflow_template_id": "1d253050-de44-442e-bb25-b6963480117b"
  },
  "newInstance": {
    "id": "ef0f15cd-f500-44f8-b826-bfb9f5f4f5cc",
    "status": "active",
    "current_stage": "active",
    "started_at": "2026-04-22T11:42:13.094Z",
    "completed_at": null,
    "created_at": "2026-04-22T11:42:13.094Z",
    "updated_at": "2026-04-22T11:42:13.094Z",
    "workflow_template_id": "21244701-3f58-45fb-8060-c44055715d4b",
    "engagement_id": "6f0f31d2-86a7-4e92-b32d-b52ea734cd8f",
    "trigger_date": "2026-04-29T03:00:00.000Z"
  },
  "lifecycleStage": "implementation",
  "atEndOfChain": false
}
```

### Error Responses

- `400` invalid JSON body:

```json
{ "error": "invalid json body", "code": "INVALID_JSON" }
```

- `400` no current phase and no target:

```json
{
  "error": "No current phase instance exists; specify a target phase to start the journey.",
  "code": "NoCurrentPhaseError"
}
```

- `400` invalid target phase:

```json
{
  "error": "Target phase \"foo\" is not a valid chain phase.",
  "code": "InvalidTargetPhaseError"
}
```

- `404` engagement not found:

```json
{ "error": "Engagement not found.", "code": "WorkflowEngagementNotFoundError" }
```

- `500` internal:

```json
{ "error": "failed to advance engagement journey", "code": "INTERNAL_ERROR" }
```

### PowerShell-friendly curl example

```powershell
curl.exe -X POST "https://concilio-2.vercel.app/api/engagements/6f0f31d2-86a7-4e92-b32d-b52ea734cd8f/advance" `
  -H "Content-Type: application/json" `
  -H "Cookie: __Secure-authjs.session-token=<paste-session-cookie>" `
  -d "{""targetPhaseKey"":""implementation""}"
```

---

## POST `/api/engagements/[id]/stop`

Stops the active journey and spawns the `closing` workflow. Marks lifecycle as `lost` or `ceased` based on pre-stop stage.

### Request

- Method: `POST`
- Body: none

### Success Response (200)

```json
{
  "closedInstance": {
    "id": "ef0f15cd-f500-44f8-b826-bfb9f5f4f5cc",
    "status": "cancelled",
    "completed_at": "2026-04-22T11:55:00.000Z",
    "workflow_template_id": "21244701-3f58-45fb-8060-c44055715d4b"
  },
  "closingInstance": {
    "id": "73eb7ac7-f3f1-4f3b-9f27-016eb17e8d4f",
    "status": "active",
    "current_stage": "active",
    "started_at": "2026-04-22T11:55:00.000Z",
    "completed_at": null,
    "created_at": "2026-04-22T11:55:00.000Z",
    "updated_at": "2026-04-22T11:55:00.000Z",
    "workflow_template_id": "f1503549-9186-4fd1-a262-c2bcf79295f7",
    "engagement_id": "6f0f31d2-86a7-4e92-b32d-b52ea734cd8f",
    "trigger_date": "2026-04-22T11:55:00.000Z"
  },
  "terminalStage": "lost"
}
```

### Error Responses

- `400` already stopped:

```json
{
  "error": "Client journey is already terminal (lost or ceased).",
  "code": "AlreadyStoppedError"
}
```

- `404` engagement not found:

```json
{ "error": "Engagement not found.", "code": "WorkflowEngagementNotFoundError" }
```

- `500` internal:

```json
{ "error": "failed to stop engagement journey", "code": "INTERNAL_ERROR" }
```

### PowerShell-friendly curl example

```powershell
curl.exe -X POST "https://concilio-2.vercel.app/api/engagements/6f0f31d2-86a7-4e92-b32d-b52ea734cd8f/stop" `
  -H "Cookie: __Secure-authjs.session-token=<paste-session-cookie>"
```

---

## GET `/api/engagements/[id]/journey`

Returns computed journey state for one engagement.

### Request

- Method: `GET`
- Body: none

### Success Response (200)

```json
{
  "current": {
    "instance": {
      "id": "ef0f15cd-f500-44f8-b826-bfb9f5f4f5cc",
      "workflow_template_id": "21244701-3f58-45fb-8060-c44055715d4b",
      "engagement_id": "6f0f31d2-86a7-4e92-b32d-b52ea734cd8f",
      "status": "active",
      "trigger_date": "2026-04-29T03:00:00.000Z",
      "created_at": "2026-04-22T11:42:13.094Z"
    },
    "template": {
      "id": "21244701-3f58-45fb-8060-c44055715d4b",
      "key": "implementation",
      "name": "Implementation",
      "phase_order": 4
    }
  },
  "completed": [
    {
      "instance": {
        "id": "f3f8ad13-3db6-49fb-b68f-6fca9866ae25",
        "status": "completed"
      },
      "template": {
        "key": "advice",
        "name": "Advice",
        "phase_order": 3
      }
    }
  ],
  "triggerInstances": [
    {
      "instance": {
        "id": "1a630a57-2663-4e86-98ca-f3a7b063b4d3",
        "status": "active"
      },
      "template": {
        "key": "fifteen_min_call",
        "name": "15 Minute Call"
      }
    }
  ],
  "nextPhaseTemplate": null,
  "availableSkipTargets": [],
  "lifecycleStage": "implementation"
}
```

### Error Responses

- `404` engagement not found:

```json
{ "error": "Engagement not found.", "code": "WorkflowEngagementNotFoundError" }
```

- `500` internal:

```json
{ "error": "failed to load engagement journey", "code": "INTERNAL_ERROR" }
```

### PowerShell-friendly curl example

```powershell
curl.exe -X GET "https://concilio-2.vercel.app/api/engagements/6f0f31d2-86a7-4e92-b32d-b52ea734cd8f/journey" `
  -H "Cookie: __Secure-authjs.session-token=<paste-session-cookie>"
```

---

## Example IDs Used

- Forest Gump party id (from test data): `3cf0afd7-ecec-4b7b-8922-107fe115b09c`
- Example engagement id in this document: `6f0f31d2-86a7-4e92-b32d-b52ea734cd8f`

The curls above are documentation examples only and are not executed by this doc.
