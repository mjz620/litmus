alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.skill_estimates enable row level security;
alter table public.coach_interventions enable row level security;
alter table public.reports enable row level security;

create or replace function public.is_class_teacher(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classes
    where id = target_class_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_class_member(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_members
    where class_id = target_class_id and student_id = auth.uid()
  );
$$;

create or replace function public.owns_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions
    where id = target_session_id and user_id = auth.uid()
  );
$$;

create or replace function public.teaches_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions session_row
    join public.classes class_row on class_row.id = session_row.class_id
    where session_row.id = target_session_id and class_row.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'teacher'
  );
$$;

create or replace function public.teacher_can_read_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members member
    join public.classes class_row on class_row.id = member.class_id
    where member.student_id = target_profile_id and class_row.teacher_id = auth.uid()
  );
$$;

revoke all on function public.is_class_teacher(uuid) from public;
revoke all on function public.is_class_member(uuid) from public;
revoke all on function public.owns_session(uuid) from public;
revoke all on function public.teaches_session(uuid) from public;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.owns_session(uuid) to authenticated;
grant execute on function public.teaches_session(uuid) to authenticated;
revoke all on function public.is_teacher() from public;
revoke all on function public.teacher_can_read_profile(uuid) from public;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.teacher_can_read_profile(uuid) to authenticated;

create policy "profiles read self" on public.profiles
  for select using (id = auth.uid());
create policy "teachers read joined student profiles" on public.profiles
  for select using (public.teacher_can_read_profile(id));
create policy "profiles insert self" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "teachers manage owned classes" on public.classes
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and public.is_teacher());
create policy "students read joined classes" on public.classes
  for select using (public.is_class_member(id));

create policy "students read own memberships" on public.class_members
  for select using (student_id = auth.uid());
create policy "teachers manage class memberships" on public.class_members
  for all using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

create policy "teachers manage owned assignments" on public.assignments
  for all using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));
create policy "students read class assignments" on public.assignments
  for select using (public.is_class_member(class_id));

create policy "students manage own sessions" on public.sessions
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (class_id is null or public.is_class_member(class_id))
  );
create policy "teachers read owned class sessions" on public.sessions
  for select using (public.is_class_teacher(class_id));

create policy "students manage own events" on public.events
  for all using (public.owns_session(session_id))
  with check (public.owns_session(session_id));
create policy "teachers read owned class events" on public.events
  for select using (public.teaches_session(session_id));

create policy "students manage own skill estimates" on public.skill_estimates
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (class_id is null or public.is_class_member(class_id))
  );
create policy "teachers read owned class skill estimates" on public.skill_estimates
  for select using (public.is_class_teacher(class_id));

create policy "students manage own coach interventions" on public.coach_interventions
  for all using (public.owns_session(session_id))
  with check (public.owns_session(session_id));
create policy "teachers read owned class coach interventions" on public.coach_interventions
  for select using (public.teaches_session(session_id));

create policy "students manage own reports" on public.reports
  for all using (public.owns_session(session_id))
  with check (public.owns_session(session_id));
create policy "teachers read owned class reports" on public.reports
  for select using (public.teaches_session(session_id));

-- Anonymous demo/practice writes intentionally have no direct table policy.
-- They pass through validated server routes using the service role.

create or replace function public.join_class_by_code(requested_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Only student profiles may join a class';
  end if;

  select id into target_class_id
  from public.classes
  where join_code = upper(trim(requested_code));

  if target_class_id is null then
    raise exception 'Class code not found';
  end if;

  insert into public.class_members (class_id, student_id)
  values (target_class_id, auth.uid())
  on conflict do nothing;
  return target_class_id;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;
