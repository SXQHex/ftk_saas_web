-- DRAFT / NOT APPLIED — multi-studio (tenant) support for StudioSaaS.
--
-- Status: written against the schema snapshot in ../schema/00_baseline_snapshot.sql and NOT run
-- against any database. It lives in `proposed/` (not `migrations/`) so the Supabase CLI never
-- applies it by accident. Before using it:
--   1. Decide whether more than one studio will ever share this database. If not, skip it.
--   2. Test it on a Supabase branch (or a restored copy), then run the security advisors.
--   3. Move it to ../migrations with a real timestamp and apply it.
--   4. Update the app: show/switch the studio, and add `studio_id` to generated types.
--
-- Design: every row belongs to exactly one studio. A user belongs to one studio through
-- profiles.studio_id. RLS keeps every policy as it is today and ANDs a studio check onto it.
-- Child rows (subscriptions, attendance, credit_transactions) inherit studio_id from their member
-- by a BEFORE INSERT trigger, so the existing SECURITY DEFINER credit functions keep working
-- unchanged.

begin;

-- 1. Studios ----------------------------------------------------------------
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
alter table public.studios enable row level security;

-- All existing data belongs to the one studio that exists today.
insert into public.studios (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'FTK Studio', 'ftk');

-- 2. studio_id columns (nullable -> backfill -> not null) --------------------
alter table public.profiles add column studio_id uuid references public.studios (id) on delete restrict;
alter table public.members add column studio_id uuid references public.studios (id) on delete restrict;
alter table public.lessons add column studio_id uuid references public.studios (id) on delete restrict;
alter table public.subscriptions add column studio_id uuid references public.studios (id) on delete restrict;
alter table public.attendance add column studio_id uuid references public.studios (id) on delete restrict;
alter table public.credit_transactions add column studio_id uuid references public.studios (id) on delete restrict;

update public.profiles set studio_id = '00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.members set studio_id = '00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.lessons set studio_id = '00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.subscriptions set studio_id = '00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.attendance set studio_id = '00000000-0000-0000-0000-000000000001' where studio_id is null;
update public.credit_transactions set studio_id = '00000000-0000-0000-0000-000000000001' where studio_id is null;

alter table public.profiles alter column studio_id set not null;
alter table public.members alter column studio_id set not null;
alter table public.lessons alter column studio_id set not null;
alter table public.subscriptions alter column studio_id set not null;
alter table public.attendance alter column studio_id set not null;
alter table public.credit_transactions alter column studio_id set not null;

create index profiles_studio_idx on public.profiles (studio_id);
create index members_studio_idx on public.members (studio_id);
create index lessons_studio_idx on public.lessons (studio_id, starts_at);
create index subscriptions_studio_idx on public.subscriptions (studio_id);
create index attendance_studio_idx on public.attendance (studio_id);
create index credit_transactions_studio_idx on public.credit_transactions (studio_id);

-- 3. Helpers ------------------------------------------------------------------
create or replace function app_private.current_studio_id()
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select p.studio_id from public.profiles p where p.id = (select auth.uid())
$function$;

-- Child rows take their studio from the member they belong to.
create or replace function app_private.inherit_studio_from_member()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  select m.studio_id into new.studio_id from public.members m where m.id = new.member_id;
  if new.studio_id is null then
    raise exception 'Üye bulunamadı.';
  end if;
  return new;
end;
$function$;

create trigger subscriptions_inherit_studio before insert on public.subscriptions
  for each row execute function app_private.inherit_studio_from_member();
create trigger attendance_inherit_studio before insert on public.attendance
  for each row execute function app_private.inherit_studio_from_member();
create trigger credit_transactions_inherit_studio before insert on public.credit_transactions
  for each row execute function app_private.inherit_studio_from_member();

-- Members and group lessons have no parent row, so they default to the caller's studio.
alter table public.members alter column studio_id set default app_private.current_studio_id();
alter table public.lessons alter column studio_id set default app_private.current_studio_id();

-- New sign-ups land in a studio chosen by the server (invite flow); until one exists they use the
-- default studio. Replace this once a real onboarding flow exists.
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, full_name, role, studio_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student',
    '00000000-0000-0000-0000-000000000001'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- 4. Policies: same rules as today, scoped to the caller's studio -----------------
-- (studio_id on INSERT/UPDATE must equal the caller's studio, so rows cannot be moved across studios.)

create policy studios_read_own on public.studios
  for select to authenticated
  using (id = (select app_private.current_studio_id()));

-- profiles
drop policy if exists profiles_admin_manage on public.profiles;
drop policy if exists profiles_read_self_or_staff on public.profiles;
create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()))
  with check ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()));
create policy profiles_read_self_or_staff on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (
      (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
      and studio_id = (select app_private.current_studio_id())
    )
  );

-- members
drop policy if exists members_admin_manage on public.members;
drop policy if exists members_staff_all_student_own on public.members;
create policy members_admin_manage on public.members
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()))
  with check ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()));
create policy members_staff_all_student_own on public.members
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (
      (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
      and studio_id = (select app_private.current_studio_id())
    )
  );

-- subscriptions
drop policy if exists subscriptions_admin_manage on public.subscriptions;
drop policy if exists subscriptions_staff_all_student_own on public.subscriptions;
create policy subscriptions_admin_manage on public.subscriptions
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()))
  with check ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()));
create policy subscriptions_staff_all_student_own on public.subscriptions
  for select to authenticated
  using (
    member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
    or (
      (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
      and studio_id = (select app_private.current_studio_id())
    )
  );

-- lessons
drop policy if exists lessons_admin_manage on public.lessons;
drop policy if exists lessons_staff_all_student_own on public.lessons;
create policy lessons_admin_manage on public.lessons
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()))
  with check ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()));
create policy lessons_staff_all_student_own on public.lessons
  for select to authenticated
  using (
    studio_id = (select app_private.current_studio_id())
    and (
      (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
      or private_member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
      or (
        type = 'group'::lesson_type
        and exists (
          select 1
          from public.subscriptions as s
          join public.members as m on m.id = s.member_id
          where m.profile_id = (select auth.uid())
            and s.type = 'group_4_weeks'::subscription_type
            and s.status = 'active'::subscription_status
            and s.starts_on <= (lessons.starts_at at time zone 'Europe/Istanbul')::date
            and (s.ends_on is null or s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date)
        )
      )
    )
  );

-- attendance
drop policy if exists attendance_staff_read on public.attendance;
drop policy if exists attendance_staff_insert on public.attendance;
drop policy if exists attendance_admin_delete on public.attendance;
create policy attendance_staff_read on public.attendance
  for select to authenticated
  using (
    member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
    or (
      (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
      and studio_id = (select app_private.current_studio_id())
    )
  );
create policy attendance_staff_insert on public.attendance
  for insert to authenticated
  with check (
    (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
    and exists (
      select 1
      from public.lessons as l
      where l.id = attendance.lesson_id
        and l.studio_id = (select app_private.current_studio_id())
        and l.status not in ('cancelled'::lesson_status, 'postponed'::lesson_status)
        and (
          l.type = 'group'::lesson_type
          or (l.type = 'private'::lesson_type and l.private_member_id = attendance.member_id)
        )
    )
  );
create policy attendance_admin_delete on public.attendance
  for delete to authenticated
  using ((select app_private."current_role"()) = 'admin'::app_role and studio_id = (select app_private.current_studio_id()));

-- credit_transactions
drop policy if exists credit_transactions_staff_read_student_own on public.credit_transactions;
drop policy if exists credit_transactions_admin_insert on public.credit_transactions;
create policy credit_transactions_staff_read_student_own on public.credit_transactions
  for select to authenticated
  using (
    member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
    or (
      (select app_private."current_role"()) = any (array['admin'::app_role, 'instructor'::app_role])
      and studio_id = (select app_private.current_studio_id())
    )
  );
create policy credit_transactions_admin_insert on public.credit_transactions
  for insert to authenticated
  with check (
    (select app_private."current_role"()) = 'admin'::app_role
    and reason in ('admin_adjustment', 'refund')
    and exists (
      select 1
      from public.subscriptions as s
      where s.id = credit_transactions.subscription_id
        and s.member_id = credit_transactions.member_id
        and s.studio_id = (select app_private.current_studio_id())
    )
  );

commit;

-- Known follow-ups (not handled above):
--  * consume_lesson_credit() loops over ALL group subscriptions. With several studios it must filter
--    on `studio_id = v_lesson.studio_id`, otherwise a lesson in studio A would charge studio B's members.
--  * profiles.studio_id must never be editable by the profile owner (there is no student UPDATE
--    policy today; keep it that way).
--  * Unique constraints that should be per studio (e.g. a future member number) need studio_id in the key.
