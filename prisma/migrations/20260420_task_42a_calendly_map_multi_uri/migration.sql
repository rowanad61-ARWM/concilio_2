-- Defensive drop: remove any unique constraint on meeting_type_key, whatever it's named
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'calendly_event_type_map'::regclass
      AND contype = 'u'
      AND conkey = (
        SELECT array_agg(attnum)
        FROM pg_attribute
        WHERE attrelid = 'calendly_event_type_map'::regclass
          AND attname = 'meeting_type_key'
      )
  LOOP
    EXECUTE 'ALTER TABLE "calendly_event_type_map" DROP CONSTRAINT "' || c_name || '"';
  END LOOP;
END $$;

-- Drop any lingering index on meeting_type_key (Prisma creates an index when @unique is set)
DROP INDEX IF EXISTS "calendly_event_type_map_meeting_type_key_key";

-- Clear old seed rows (all had null URIs, no engagements depend on them)
DELETE FROM "calendly_event_type_map";

-- Re-seed with real Calendly URIs, one row per URI
INSERT INTO "calendly_event_type_map"
  (id, meeting_type_key, display_name, calendly_event_type_uri, auto_create_prospect, unresolved_log_level, active, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'NINETY_DAY_RECAP',  '90-Day Recap Meeting',                        'https://api.calendly.com/event_types/73def2d2-bbf1-4c4c-995c-8778ce7b88a5', false, 'warn', true, NOW(), NOW()),

  (gen_random_uuid()::text, 'ANNUAL_REVIEW',     'Annual Review (Andrew, secret 120m)',         'https://api.calendly.com/event_types/DGNGK7ED2VWUDEJU',                    false, 'warn', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ANNUAL_REVIEW',     'Annual Review (Andrew, 90m)',                  'https://api.calendly.com/event_types/c8c48b5d-2504-4e4f-80da-339c4a23d9fc', false, 'warn', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ANNUAL_REVIEW',     'Annual Review (Alex, 30m)',                    'https://api.calendly.com/event_types/d2d1110a-0e62-4777-ad9e-2e64c20e846e', false, 'warn', true, NOW(), NOW()),

  (gen_random_uuid()::text, 'INITIAL_MEETING',   'Initial Meeting (Andrew)',                     'https://api.calendly.com/event_types/AEC22H2BSM34XWNC',                    true,  'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'INITIAL_MEETING',   'Initial Meeting (Andrew, admin-managed)',      'https://api.calendly.com/event_types/f6227d26-9b2f-4e6e-b968-318d85f5f9e4', true,  'info', true, NOW(), NOW()),

  (gen_random_uuid()::text, 'GENERAL_MEETING',   'Advice Meeting (Andrew)',                      'https://api.calendly.com/event_types/FEPEQDJMUHFRF5SI',                    false, 'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENERAL_MEETING',   'Initial Meeting Follow-up / Discovery',        'https://api.calendly.com/event_types/HEPFN6NE2AOD46OO',                    false, 'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENERAL_MEETING',   'Phone Call (Andrew, 30m)',                     'https://api.calendly.com/event_types/8276aac6-72cb-4b93-86a0-4ec8fdd76764', false, 'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENERAL_MEETING',   'General Meeting (Andrew, secret)',             'https://api.calendly.com/event_types/CCEZ5F4FQHZSZCQL',                    false, 'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENERAL_MEETING',   'General Meeting (Andrew, admin-managed)',      'https://api.calendly.com/event_types/21da2be8-f483-48ba-8a36-8ca49a619a6c', false, 'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENERAL_MEETING',   'Existing Client General Meeting (Alex, 60m)',  'https://api.calendly.com/event_types/1c8eea9a-637a-4da6-8cf8-d748afea1a4c', false, 'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'GENERAL_MEETING',   'Existing Client 30 Minute (Alex)',             'https://api.calendly.com/event_types/f7c881ac-5b38-45f3-a439-4ea1a3a68c23', false, 'info', true, NOW(), NOW()),

  (gen_random_uuid()::text, 'FIFTEEN_MIN_CALL',  'Phone Consultation (Andrew)',                  'https://api.calendly.com/event_types/c8d56850-6ba6-4f37-9051-8aaa4f0d954e', true,  'info', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'FIFTEEN_MIN_CALL',  'Phone Consultation With Andrew (team pool)',   'https://api.calendly.com/event_types/5cd91fa4-329d-4529-ba7a-1b9e5b456ed2', true,  'info', true, NOW(), NOW());