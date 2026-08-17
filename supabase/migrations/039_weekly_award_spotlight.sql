-- Weekly Award of the Week spotlight (gym-wide showcase after manual awards)

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_award_spotlights (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  member_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete restrict,
  achievement_code text not null,
  title text not null,
  coach_note text,
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (week_start)
);

create index if not exists weekly_award_spotlights_member_idx
  on public.weekly_award_spotlights (member_id, week_start desc);

alter table public.weekly_award_spotlights enable row level security;

drop policy if exists "weekly_award_spotlights_select" on public.weekly_award_spotlights;
create policy "weekly_award_spotlights_select" on public.weekly_award_spotlights
  for select to authenticated
  using (true);

drop policy if exists "weekly_award_spotlights_staff_write" on public.weekly_award_spotlights;
create policy "weekly_award_spotlights_staff_write" on public.weekly_award_spotlights
  for all to authenticated
  using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

-- ---------------------------------------------------------------------------
-- Monday week key (ISO)
-- ---------------------------------------------------------------------------
create or replace function public.week_start_monday(p_day date default current_date)
returns date
language sql
immutable
as $$
  select (date_trunc('week', p_day::timestamp)::date);
$$;

-- ---------------------------------------------------------------------------
-- manual_award_achievement — unlock + upsert Award of the Week + celebration
-- ---------------------------------------------------------------------------
drop function if exists public.manual_award_achievement(uuid, text);

create or replace function public.manual_award_achievement(
  p_member uuid,
  p_code text,
  p_coach_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_result jsonb;
  v_ach public.achievements;
  v_week date;
  v_note text;
  v_celeb_id uuid;
begin
  if not public.is_coach_or_admin() then
    raise exception 'Staff only';
  end if;

  select * into v_ach
  from public.achievements
  where code = p_code and is_active = true;

  if v_ach.id is null then
    return jsonb_build_object('unlocked', false, 'reason', 'missing');
  end if;

  v_result := public.unlock_achievement(p_member, p_code);
  v_week := public.week_start_monday(current_date);
  v_note := nullif(trim(coalesce(p_coach_note, '')), '');

  insert into public.weekly_award_spotlights (
    week_start,
    member_id,
    achievement_id,
    achievement_code,
    title,
    coach_note,
    awarded_by
  )
  values (
    v_week,
    p_member,
    v_ach.id,
    v_ach.code,
    v_ach.title,
    v_note,
    auth.uid()
  )
  on conflict (week_start) do update set
    member_id = excluded.member_id,
    achievement_id = excluded.achievement_id,
    achievement_code = excluded.achievement_code,
    title = excluded.title,
    coach_note = excluded.coach_note,
    awarded_by = excluded.awarded_by,
    created_at = now();

  if coalesce((v_result->>'unlocked')::boolean, false) then
    select id into v_celeb_id
    from public.pending_celebrations
    where member_id = p_member
      and kind = 'achievement'
      and seen_at is null
      and (meta->>'code') = v_ach.code
    order by created_at desc
    limit 1;

    if v_celeb_id is not null then
      update public.pending_celebrations
      set
        title = v_ach.title,
        body = coalesce(v_note, v_ach.description),
        meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
          'weekly_award', true,
          'coach_note', v_note,
          'award_title', v_ach.title
        )
      where id = v_celeb_id;
    end if;
  else
    insert into public.pending_celebrations (member_id, kind, title, body, meta)
    values (
      p_member,
      'achievement',
      v_ach.title,
      coalesce(v_note, 'You were selected for Award of the Week.'),
      jsonb_build_object(
        'code', v_ach.code,
        'xp', 0,
        'rarity', v_ach.rarity,
        'icon_key', v_ach.icon_key,
        'weekly_award', true,
        'coach_note', v_note,
        'award_title', v_ach.title
      )
    );
  end if;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'spotlight', true,
    'week_start', v_week,
    'coach_note', v_note,
    'achievement_id', v_ach.id,
    'code', v_ach.code,
    'title', v_ach.title,
    'description', v_ach.description,
    'rarity', v_ach.rarity,
    'icon_key', v_ach.icon_key,
    'xp', v_ach.xp_reward
  );
end;
$$;

grant execute on function public.week_start_monday(date) to authenticated;
grant execute on function public.manual_award_achievement(uuid, text, text) to authenticated;
