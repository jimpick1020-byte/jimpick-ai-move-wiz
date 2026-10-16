update public.estimate_drafts set payload = payload - 'toEnv' where estimate_id like 'est_intake_%' and (payload->>'ladderTo')::boolean is true and payload->>'toEnv' is not null;

update public.intake_requests set draft = draft - 'toEnv', submission = submission - 'toEnv' where (draft->>'ladderTo')::boolean is true and draft->>'toEnv' is not null;