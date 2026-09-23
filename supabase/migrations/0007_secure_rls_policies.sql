-- ==============================================================================
-- 0007_secure_rls_policies.sql
-- Replaces the permissive "using (true)" policies from 0002 and 0006 with
-- login + tenant + role based Row Level Security.
--
-- Run the whole file once in the Supabase SQL Editor.
-- Every existing confirmed Auth user is linked to the Shreeji transport as
-- 'owner'. If more than one account exists in Authentication > Users, review
-- that list before running.
-- ==============================================================================

-- 1. Helper functions -----------------------------------------------------------

create or replace function public.current_app_user()
returns public.users
language sql
security definer
stable
set search_path = public
as $$
  select * from public.users where id = auth.uid();
$$;

create or replace function public.app_transport_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select transport_id from public.users where id = auth.uid() and is_active;
$$;

create or replace function public.app_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid() and is_active;
$$;

revoke all on function public.current_app_user() from public, anon;
revoke all on function public.app_transport_id() from public, anon;
revoke all on function public.app_role() from public, anon;
grant execute on function public.current_app_user() to authenticated;
grant execute on function public.app_transport_id() to authenticated;
grant execute on function public.app_role() to authenticated;

-- 2. Link existing Auth users to the transport ----------------------------------

insert into public.users (id, transport_id, email, name, role, is_active)
select
  u.id,
  'a0000000-0000-0000-0000-000000000001',
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
  'owner',
  true
from auth.users u
where u.email is not null
  and u.email_confirmed_at is not null
  and exists (select 1 from public.transports t where t.id = 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- 3. Remove every existing policy on the protected tables -----------------------

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'transports', 'users', 'vehicles', 'drivers', 'parties', 'locations', 'pumps',
        'bank_accounts', 'trips', 'maintenance', 'fastag', 'payments', 'investments',
        'driver_summaries', 'diesel'
      )
  loop
    execute format('drop policy if exists %I on public.%I;', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 4. Business tables: logged-in users of the same transport only ----------------
--    Staff can read/create/edit; only owners (and super admin) can delete.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'vehicles', 'drivers', 'parties', 'locations', 'pumps', 'bank_accounts',
    'trips', 'maintenance', 'fastag', 'payments', 'driver_summaries', 'diesel'
  ] loop
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('revoke all on table public.%I from anon;', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated;', tbl);

    execute format($p$
      create policy "tenant_select" on public.%I
      for select to authenticated
      using (transport_id = public.app_transport_id() or public.app_role() = 'super_admin');
    $p$, tbl);

    execute format($p$
      create policy "tenant_insert" on public.%I
      for insert to authenticated
      with check (transport_id = public.app_transport_id() or public.app_role() = 'super_admin');
    $p$, tbl);

    execute format($p$
      create policy "tenant_update" on public.%I
      for update to authenticated
      using (transport_id = public.app_transport_id() or public.app_role() = 'super_admin')
      with check (transport_id = public.app_transport_id() or public.app_role() = 'super_admin');
    $p$, tbl);

    execute format($p$
      create policy "owner_delete" on public.%I
      for delete to authenticated
      using (
        (transport_id = public.app_transport_id() and public.app_role() = 'owner')
        or public.app_role() = 'super_admin'
      );
    $p$, tbl);
  end loop;
end $$;

-- 5. Investments: owner (and super admin) only ----------------------------------

alter table public.investments enable row level security;
revoke all on table public.investments from anon;
grant select, insert, update, delete on table public.investments to authenticated;

create policy "owner_all_investments" on public.investments
  for all to authenticated
  using (
    (transport_id = public.app_transport_id() and public.app_role() = 'owner')
    or public.app_role() = 'super_admin'
  )
  with check (
    (transport_id = public.app_transport_id() and public.app_role() = 'owner')
    or public.app_role() = 'super_admin'
  );

-- 6. Transports and users: read own transport, only super admin writes ----------

alter table public.transports enable row level security;
alter table public.users enable row level security;
revoke all on table public.transports from anon;
revoke all on table public.users from anon;
grant select, insert, update, delete on table public.transports to authenticated;
grant select, insert, update, delete on table public.users to authenticated;

create policy "super_admin_full_access_transports" on public.transports
  for all to authenticated
  using (public.app_role() = 'super_admin')
  with check (public.app_role() = 'super_admin');

create policy "own_transport_read_only" on public.transports
  for select to authenticated
  using (id = public.app_transport_id());

create policy "super_admin_full_access_users" on public.users
  for all to authenticated
  using (public.app_role() = 'super_admin')
  with check (public.app_role() = 'super_admin');

create policy "own_transport_users_read_only" on public.users
  for select to authenticated
  using (transport_id = public.app_transport_id());

-- 7. Trip -> diesel sync trigger must keep working for staff --------------------
--    (staff have no delete right on diesel, but the trigger removes the linked
--    diesel row when a trip's diesel is cleared)

alter function public.sync_trip_diesel_to_diesel_table() security definer;
alter function public.sync_trip_diesel_to_diesel_table() set search_path = public;
