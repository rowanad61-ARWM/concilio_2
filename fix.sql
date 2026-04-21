UPDATE workflow_template SET trigger_meeting_type_key = 'FIFTEEN_MIN_CALL' WHERE key = 'initial_contact';
UPDATE workflow_template SET trigger_meeting_type_key = NULL WHERE key = 'engagement';
