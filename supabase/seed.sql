-- Stable demo identities. Password login is not exposed; these rows support local fixtures only.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000200', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher@demo.labbench.local', crypt('demo-disabled', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Maya Patel"}', now(), now()),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'avery@demo.labbench.local', crypt('demo-disabled', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Avery Chen"}', now(), now()),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jordan@demo.labbench.local', crypt('demo-disabled', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jordan Lee"}', now(), now()),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam@demo.labbench.local', crypt('demo-disabled', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Rivera"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, role, name) values
  ('00000000-0000-4000-8000-000000000200', 'teacher', 'Dr. Maya Patel'),
  ('00000000-0000-4000-8000-000000000201', 'student', 'Avery Chen'),
  ('00000000-0000-4000-8000-000000000202', 'student', 'Jordan Lee'),
  ('00000000-0000-4000-8000-000000000203', 'student', 'Sam Rivera')
on conflict (id) do update set role = excluded.role, name = excluded.name;

insert into public.classes (id, teacher_id, name, join_code) values
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000200', 'Chemistry 1 — Demo', 'LAB123')
on conflict (id) do update set name = excluded.name;

insert into public.class_members (class_id, student_id) values
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000202'),
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000203')
on conflict do nothing;

insert into public.sessions (id, user_id, class_id, experiment_id, experiment_version, mode, session_seed, completed_at, is_demo) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', '1.0.0', 'demo', 'demo-avery', '2026-07-16T15:00:00Z', true),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', '1.0.0', 'demo', 'demo-jordan', '2026-07-16T15:10:00Z', true),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', '1.0.0', 'demo', 'demo-sam', null, true)
on conflict (id) do update set completed_at = excluded.completed_at;

insert into public.events (session_id, client_event_id, seq, payload) values
  ('00000000-0000-4000-8000-000000000302', 'demo-jordan-0', 0, '{"type":"add_titrant","tSim":36,"observation":{"addedML":2,"totalML":24},"flags":["flow_rate_high_near_endpoint"],"evidence":[{"skillId":"endpoint_control","delta":-0.7,"reason":"flow_rate_high_near_endpoint"}]}'),
  ('00000000-0000-4000-8000-000000000302', 'demo-jordan-1', 1, '{"type":"add_titrant","tSim":40,"observation":{"addedML":2,"totalML":26},"flags":["endpoint_overshoot"],"evidence":[{"skillId":"endpoint_control","delta":-0.9,"reason":"endpoint_overshoot"}]}'),
  ('00000000-0000-4000-8000-000000000302', 'demo-jordan-2', 2, '{"type":"read_meniscus","tSim":42,"observation":{"reportedML":25.8,"trueML":26},"flags":["meniscus_misread"],"evidence":[{"skillId":"volumetric_reading","delta":-0.6,"reason":"meniscus_misread"}]}')
on conflict (session_id, client_event_id) do nothing;

insert into public.skill_estimates (session_id, user_id, class_id, experiment_id, skill_id, mastery, evidence_count, updated_at) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', 'endpoint_control', 0.82, 4, '2026-07-16T15:00:00Z'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', 'burette_conditioning', 0.78, 2, '2026-07-16T15:00:00Z'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', 'endpoint_control', 0.34, 3, '2026-07-16T15:10:00Z'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000100', 'acid_base_titration', 'burette_conditioning', 0.58, 2, '2026-07-16T15:10:00Z')
on conflict (session_id, skill_id) do update set mastery = excluded.mastery, evidence_count = excluded.evidence_count;

insert into public.reports (session_id, rubric_version, prompt_version, model, student_text, rubric) values
  ('00000000-0000-4000-8000-000000000301', 'rubric-v1', 'evaluator-v1', 'demo-fixture', '{"procedureSummary":"Conditioned and titrated dropwise near endpoint.","dataAnalysis":"Used the endpoint reading.","conceptExplanation":"Endpoint is an observable signal near equivalence.","sourcesOfError":"Parallax and overshoot."}', '{"overall_summary":"Controlled procedure with evidence-linked reasoning."}')
on conflict (session_id) do nothing;
