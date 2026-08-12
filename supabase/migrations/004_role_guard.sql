-- Enforce: app signups are always members; only admins (or service role) can change roles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'member'
  );
  return new;
end;
$$;

create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Service role / SQL editor (no JWT) may set roles (seed scripts, dashboard).
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only admins can change user roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row
  execute function public.profiles_guard_role();

-- Belt-and-suspenders: members cannot self-escalate via profile updates.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and role = (select p.role from public.profiles p where p.id = auth.uid())
    )
  );
