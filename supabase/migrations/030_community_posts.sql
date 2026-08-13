-- REFORGE Community Phase 1: profiles extensions, posts stack, media buckets

-- ---------------------------------------------------------------------------
-- Profiles: username + community visibility
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists community_bio text,
  add column if not exists community_visible boolean not null default true;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username is null
    or (
      char_length(username) between 3 and 24
      and username ~ '^[a-zA-Z0-9_]+$'
      and lower(username) not in (
        'admin', 'reforge', 'support', 'system', 'coach', 'official', 'moderator', 'staff'
      )
    )
  );

-- Safe community-facing profile projection (no email/phone).
-- security_definer so peers can be listed without opening profiles email via RLS.
create or replace view public.community_profiles as
select
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.role,
  p.community_bio,
  p.community_visible,
  p.roster_active,
  p.created_at
from public.profiles p
where coalesce(p.roster_active, true) = true
  and p.community_visible = true;

-- Recreate as security definer function for safe single-profile fetch
create or replace function public.get_community_profile(p_user_id uuid)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text,
  community_bio text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.role::text,
    p.community_bio,
    p.created_at
  from public.profiles p
  where p.id = p_user_id
    and coalesce(p.roster_active, true) = true
    and (
      p.community_visible = true
      or p.id = auth.uid()
      or public.is_admin()
    );
$$;

grant execute on function public.get_community_profile(uuid) to authenticated;
grant select on public.community_profiles to authenticated;

-- NOTE: Do not add a broad profiles SELECT policy for peers (would leak email/phone).
-- Feed author display uses denormalized snapshot columns on community_posts.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null default '',
  author_username text,
  author_avatar_url text,
  author_role text not null default 'member'
    check (author_role in ('member', 'coach', 'admin')),
  body text not null default '',
  visibility text not null default 'community'
    check (visibility in ('community', 'private')),
  post_type text not null default 'status'
    check (post_type in ('status', 'media', 'workout', 'pr', 'achievement', 'announcement')),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Snapshot author fields on insert (avoid joining profiles for feed)
create or replace function public.community_posts_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_username text;
  v_avatar text;
  v_role text;
begin
  select full_name, username, avatar_url, role::text
    into v_name, v_username, v_avatar, v_role
  from public.profiles
  where id = new.author_id;

  new.author_name := coalesce(nullif(v_name, ''), 'REFORGE Athlete');
  new.author_username := v_username;
  new.author_avatar_url := v_avatar;
  new.author_role := coalesce(v_role, 'member');
  return new;
end;
$$;

drop trigger if exists community_posts_fill_author_trg on public.community_posts;
create trigger community_posts_fill_author_trg
  before insert on public.community_posts
  for each row execute function public.community_posts_fill_author();

create index if not exists community_posts_feed_idx
  on public.community_posts (created_at desc, id desc)
  where deleted_at is null and visibility = 'community';

create index if not exists community_posts_author_idx
  on public.community_posts (author_id, created_at desc)
  where deleted_at is null;

create table if not exists public.community_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  storage_path text not null,
  public_url text,
  media_type text not null check (media_type in ('image', 'video')),
  width integer,
  height integer,
  duration_seconds numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_post_media_post_idx
  on public.community_post_media (post_id, sort_order);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null default '',
  author_username text,
  author_avatar_url text,
  author_role text not null default 'member',
  parent_comment_id uuid references public.community_comments (id) on delete cascade,
  body text not null,
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint community_comments_body_len check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at asc)
  where deleted_at is null;

-- Only one level of nesting: parent must itself be a top-level comment
create or replace function public.community_comment_parent_depth_ok()
returns trigger
language plpgsql
as $$
begin
  if new.parent_comment_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.community_comments c
    where c.id = new.parent_comment_id
      and c.parent_comment_id is not null
  ) then
    raise exception 'Replies can only nest one level';
  end if;
  if exists (
    select 1 from public.community_comments c
    where c.id = new.parent_comment_id
      and c.post_id <> new.post_id
  ) then
    raise exception 'Reply must belong to the same post';
  end if;
  return new;
end;
$$;

drop trigger if exists community_comments_depth_trg on public.community_comments;
create trigger community_comments_depth_trg
  before insert or update on public.community_comments
  for each row execute function public.community_comment_parent_depth_ok();

create or replace function public.community_comments_fill_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_username text;
  v_avatar text;
  v_role text;
begin
  select full_name, username, avatar_url, role::text
    into v_name, v_username, v_avatar, v_role
  from public.profiles
  where id = new.author_id;
  new.author_name := coalesce(nullif(v_name, ''), 'REFORGE Athlete');
  new.author_username := v_username;
  new.author_avatar_url := v_avatar;
  new.author_role := coalesce(v_role, 'member');
  return new;
end;
$$;

drop trigger if exists community_comments_fill_author_trg on public.community_comments;
create trigger community_comments_fill_author_trg
  before insert on public.community_comments
  for each row execute function public.community_comments_fill_author();

create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.community_saved_posts (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Counter triggers (never trust client)
-- ---------------------------------------------------------------------------
create or replace function public.community_bump_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set like_count = like_count + 1, updated_at = now()
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts set like_count = greatest(like_count - 1, 0), updated_at = now()
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_post_likes_count_trg on public.community_post_likes;
create trigger community_post_likes_count_trg
  after insert or delete on public.community_post_likes
  for each row execute function public.community_bump_post_like_count();

create or replace function public.community_bump_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.community_posts set comment_count = comment_count + 1, updated_at = now()
    where id = new.post_id;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.community_posts set comment_count = greatest(comment_count - 1, 0), updated_at = now()
      where id = new.post_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.community_posts set comment_count = comment_count + 1, updated_at = now()
      where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.community_posts set comment_count = greatest(comment_count - 1, 0), updated_at = now()
    where id = old.post_id;
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_comments_count_trg on public.community_comments;
create trigger community_comments_count_trg
  after insert or update or delete on public.community_comments
  for each row execute function public.community_bump_post_comment_count();

create or replace function public.community_bump_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_comments set like_count = like_count + 1, updated_at = now()
    where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_comments set like_count = greatest(like_count - 1, 0), updated_at = now()
    where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_comment_likes_count_trg on public.community_comment_likes;
create trigger community_comment_likes_count_trg
  after insert or delete on public.community_comment_likes
  for each row execute function public.community_bump_comment_like_count();

-- ---------------------------------------------------------------------------
-- Community notifications helper
-- ---------------------------------------------------------------------------
create or replace function public.push_community_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_actor_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pref boolean;
begin
  if p_user_id is null or p_user_id = p_actor_id then
    return;
  end if;

  select community into v_pref
  from public.notification_preferences
  where user_id = p_user_id;

  -- Missing prefs row → allow (opt-out model for community social once user engages)
  if v_pref is false then
    return;
  end if;

  insert into public.notifications (user_id, title, body, type, read)
  values (p_user_id, p_title, p_body, p_type, false);
end;
$$;

grant execute on function public.push_community_notification(uuid, text, text, text, uuid) to authenticated;

create or replace function public.community_notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_name text;
begin
  select author_id into v_author from public.community_posts where id = new.post_id and deleted_at is null;
  if v_author is null then
    return new;
  end if;
  select coalesce(nullif(full_name, ''), 'Someone') into v_name from public.profiles where id = new.user_id;
  perform public.push_community_notification(
    v_author,
    'New like',
    v_name || ' liked your post.',
    'community_like',
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists community_post_like_notify_trg on public.community_post_likes;
create trigger community_post_like_notify_trg
  after insert on public.community_post_likes
  for each row execute function public.community_notify_on_like();

create or replace function public.community_notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_name text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  select author_id into v_author from public.community_posts where id = new.post_id and deleted_at is null;
  if v_author is null then
    return new;
  end if;
  select coalesce(nullif(full_name, ''), 'Someone') into v_name from public.profiles where id = new.author_id;
  perform public.push_community_notification(
    v_author,
    'New comment',
    v_name || ' commented on your post.',
    'community_comment',
    new.author_id
  );
  return new;
end;
$$;

drop trigger if exists community_comment_notify_trg on public.community_comments;
create trigger community_comment_notify_trg
  after insert on public.community_comments
  for each row execute function public.community_notify_on_comment();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.community_posts enable row level security;
alter table public.community_post_media enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_comment_likes enable row level security;
alter table public.community_saved_posts enable row level security;

drop policy if exists "community_posts_select" on public.community_posts;
create policy "community_posts_select" on public.community_posts
  for select using (
    deleted_at is null
    and (
      visibility = 'community'
      or author_id = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists "community_posts_insert" on public.community_posts;
create policy "community_posts_insert" on public.community_posts
  for insert with check (author_id = auth.uid());

drop policy if exists "community_posts_update" on public.community_posts;
create policy "community_posts_update" on public.community_posts
  for update using (author_id = auth.uid() or public.is_admin());

drop policy if exists "community_posts_delete" on public.community_posts;
create policy "community_posts_delete" on public.community_posts
  for delete using (author_id = auth.uid() or public.is_admin());

drop policy if exists "community_media_select" on public.community_post_media;
create policy "community_media_select" on public.community_post_media
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.deleted_at is null
        and (p.visibility = 'community' or p.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "community_media_insert" on public.community_post_media;
create policy "community_media_insert" on public.community_post_media
  for insert with check (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.author_id = auth.uid() and p.deleted_at is null
    )
  );

drop policy if exists "community_media_delete" on public.community_post_media;
create policy "community_media_delete" on public.community_post_media
  for delete using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id and (p.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "community_likes_select" on public.community_post_likes;
create policy "community_likes_select" on public.community_post_likes
  for select using (true);

drop policy if exists "community_likes_insert" on public.community_post_likes;
create policy "community_likes_insert" on public.community_post_likes
  for insert with check (user_id = auth.uid());

drop policy if exists "community_likes_delete" on public.community_post_likes;
create policy "community_likes_delete" on public.community_post_likes
  for delete using (user_id = auth.uid());

drop policy if exists "community_comments_select" on public.community_comments;
create policy "community_comments_select" on public.community_comments
  for select using (
    deleted_at is null
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.deleted_at is null
        and (p.visibility = 'community' or p.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "community_comments_insert" on public.community_comments;
create policy "community_comments_insert" on public.community_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.deleted_at is null and p.visibility = 'community'
    )
  );

drop policy if exists "community_comments_update" on public.community_comments;
create policy "community_comments_update" on public.community_comments
  for update using (author_id = auth.uid() or public.is_admin());

drop policy if exists "community_comment_likes_select" on public.community_comment_likes;
create policy "community_comment_likes_select" on public.community_comment_likes
  for select using (true);

drop policy if exists "community_comment_likes_insert" on public.community_comment_likes;
create policy "community_comment_likes_insert" on public.community_comment_likes
  for insert with check (user_id = auth.uid());

drop policy if exists "community_comment_likes_delete" on public.community_comment_likes;
create policy "community_comment_likes_delete" on public.community_comment_likes
  for delete using (user_id = auth.uid());

drop policy if exists "community_saves_select" on public.community_saved_posts;
create policy "community_saves_select" on public.community_saved_posts
  for select using (user_id = auth.uid());

drop policy if exists "community_saves_insert" on public.community_saved_posts;
create policy "community_saves_insert" on public.community_saved_posts
  for insert with check (user_id = auth.uid());

drop policy if exists "community_saves_delete" on public.community_saved_posts;
create policy "community_saves_delete" on public.community_saved_posts
  for delete using (user_id = auth.uid());

-- Prevent clients from forging like/comment counters
create or replace function public.community_posts_guard_counters()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
    if new.author_id <> old.author_id then
      raise exception 'Cannot change post author';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists community_posts_guard_trg on public.community_posts;
create trigger community_posts_guard_trg
  before update on public.community_posts
  for each row execute function public.community_posts_guard_counters();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'community-media',
    'community-media',
    true,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_media_storage_select" on storage.objects;
create policy "community_media_storage_select"
  on storage.objects for select
  using (bucket_id = 'community-media' and auth.role() = 'authenticated');

drop policy if exists "community_media_storage_insert" on storage.objects;
create policy "community_media_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'community-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "community_media_storage_update" on storage.objects;
create policy "community_media_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'community-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "community_media_storage_delete" on storage.objects;
create policy "community_media_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'community-media'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

drop policy if exists "avatars_storage_select" on storage.objects;
create policy "avatars_storage_select"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_storage_insert" on storage.objects;
create policy "avatars_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_storage_update" on storage.objects;
create policy "avatars_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_storage_delete" on storage.objects;
create policy "avatars_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
