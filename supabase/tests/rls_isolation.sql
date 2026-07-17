begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher@test.local', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@test.local', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@test.local', '', now(), now(), now());

insert into public.profiles (id, role, name)
values
  ('10000000-0000-4000-8000-000000000001', 'teacher', 'Teacher'),
  ('10000000-0000-4000-8000-000000000002', 'student', 'Student'),
  ('10000000-0000-4000-8000-000000000003', 'student', 'Outsider');

insert into public.classes (id, teacher_id, name, join_code)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'RLS fixture',
  'RLS001'
);

insert into public.class_members (class_id, student_id)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.sessions (
  id,
  user_id,
  class_id,
  experiment_id,
  experiment_version,
  mode
)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'acid_base_titration', '1.0.0', 'assignment'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', null, 'acid_base_titration', '1.0.0', 'practice');

insert into public.events (session_id, client_event_id, seq, payload)
values
  ('30000000-0000-4000-8000-000000000001', 'student:0', 0, '{"type":"fill_burette","flags":[]}'::jsonb),
  ('30000000-0000-4000-8000-000000000002', 'outsider:0', 0, '{"type":"fill_burette","flags":[]}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select extensions.is((select count(*) from public.sessions), 1::bigint, 'student reads only their own session');
select extensions.is((select count(*) from public.events), 1::bigint, 'student reads only events from their own session');
select extensions.is((select count(*) from public.classes), 1::bigint, 'student reads the joined class');
select extensions.is((select count(*) from public.profiles), 1::bigint, 'student cannot enumerate profiles');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select extensions.is((select count(*) from public.classes), 0::bigint, 'outsider cannot read an unjoined class');
select extensions.is((select count(*) from public.events), 1::bigint, 'outsider sees only their own event');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.is((select count(*) from public.sessions), 1::bigint, 'teacher reads only sessions in their class');
select extensions.is((select count(*) from public.events), 1::bigint, 'teacher reads only events in their class');

select * from extensions.finish();
rollback;
