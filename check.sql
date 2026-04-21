SELECT id, engagement_type, party_id, household_id, calendly_event_uuid, opened_at
FROM engagement
ORDER BY created_at DESC
LIMIT 5;
