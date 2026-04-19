# Monday Webhook Setup

## Endpoint
- Webhook URL: `https://concilio-2.vercel.app/api/webhooks/monday`
- Board ID: `5026457972`

## Subscribe To These Events
- `change_column_value`
- `create_update`
- `delete_pulse`

Do not subscribe to `archive_pulse`.

## GraphQL Mutations (one per event type)

```graphql
mutation {
  create_webhook(
    board_id: 5026457972
    url: "https://concilio-2.vercel.app/api/webhooks/monday"
    event: change_column_value
  ) {
    id
    board_id
  }
}
```

```graphql
mutation {
  create_webhook(
    board_id: 5026457972
    url: "https://concilio-2.vercel.app/api/webhooks/monday"
    event: create_update
  ) {
    id
    board_id
  }
}
```

```graphql
mutation {
  create_webhook(
    board_id: 5026457972
    url: "https://concilio-2.vercel.app/api/webhooks/monday"
    event: delete_pulse
  ) {
    id
    board_id
  }
}
```
