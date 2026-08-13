-- Ensure post authors can soft-delete their own posts reliably.
-- Soft-delete is an UPDATE of deleted_at; guard trigger called is_admin() which
-- could recurse. Also expose a security-definer RPC for author/admin delete.

create or replace function public.community_posts_guard_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
    if new.author_id <> old.author_id then
      raise exception 'Cannot change post author';
    end if;
    -- Non-admins may soft-delete / edit own body/visibility only via RLS;
    -- never allow forging pin unless admin
    if new.is_pinned is distinct from old.is_pinned then
      raise exception 'Only admins can pin posts';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.soft_delete_community_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
begin
  perform set_config('row_security', 'off', true);

  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select author_id into v_author
  from public.community_posts
  where id = p_post_id and deleted_at is null;

  if v_author is null then
    raise exception 'Post not found';
  end if;

  if v_author <> v_uid and not public.is_admin() then
    raise exception 'Only the author or an admin can delete this post';
  end if;

  update public.community_posts
  set deleted_at = now(), updated_at = now()
  where id = p_post_id;
end;
$$;

grant execute on function public.soft_delete_community_post(uuid) to authenticated;
