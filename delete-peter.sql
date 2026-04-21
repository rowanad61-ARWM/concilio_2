DELETE FROM workflow_spawned_task WHERE workflow_instance_id IN (SELECT id FROM workflow_instance WHERE party_id = 'c0d48991-e185-47ce-b139-bef9b56826e4');
DELETE FROM workflow_instance WHERE party_id = 'c0d48991-e185-47ce-b139-bef9b56826e4';
DELETE FROM engagement WHERE party_id = 'c0d48991-e185-47ce-b139-bef9b56826e4';
DELETE FROM contact_method WHERE party_id = 'c0d48991-e185-47ce-b139-bef9b56826e4';
DELETE FROM client_classification WHERE party_id = 'c0d48991-e185-47ce-b139-bef9b56826e4';
DELETE FROM household_member WHERE party_id = 'c0d48991-e185-47ce-b139-bef9b56826e4';
DELETE FROM "Task" WHERE "clientId" = 'c0d48991-e185-47ce-b139-bef9b56826e4';
DELETE FROM party WHERE id = 'c0d48991-e185-47ce-b139-bef9b56826e4';
