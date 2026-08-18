-- Achievements, Weekly Challenges, XP, leaderboards (Phase 1)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coach', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Extend achievements catalog
-- ---------------------------------------------------------------------------
alter table public.achievements
  add column if not exists rarity text not null default 'common',
  add column if not exists xp_reward integer not null default 50,
  add column if not exists icon_key text not null default 'trophy',
  add column if not exists is_active boolean not null default true,
  add column if not exists award_mode text not null default 'automatic';

alter table public.achievements drop constraint if exists achievements_rarity_check;
alter table public.achievements
  add constraint achievements_rarity_check
  check (rarity in ('common', 'rare', 'epic', 'legendary'));

alter table public.achievements drop constraint if exists achievements_award_mode_check;
alter table public.achievements
  add constraint achievements_award_mode_check
  check (award_mode in ('automatic', 'manual'));

-- Soft-block direct client inserts of unlocks (RPC path uses security definer)
drop policy if exists "member_achievements_insert_own" on public.member_achievements;
create policy "member_achievements_insert_staff" on public.member_achievements
  for insert with check (public.is_coach_or_admin());

-- Staff can manage catalog
drop policy if exists "achievements_manage_staff" on public.achievements;
create policy "achievements_manage_staff" on public.achievements
  for all using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

-- Privacy flag for achievement moments
alter table public.profiles
  add column if not exists share_achievements boolean not null default true;

-- ---------------------------------------------------------------------------
-- XP
-- ---------------------------------------------------------------------------
create table if not exists public.athlete_xp (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists athlete_xp_ledger_member_idx
  on public.athlete_xp_ledger (member_id, created_at desc);

alter table public.athlete_xp enable row level security;
alter table public.athlete_xp_ledger enable row level security;

drop policy if exists "athlete_xp_select" on public.athlete_xp;
create policy "athlete_xp_select" on public.athlete_xp
  for select using (
    member_id = auth.uid()
    or public.is_coach_or_admin()
    or exists (
      select 1 from public.coach_clients cc
      where cc.member_id = athlete_xp.member_id and cc.coach_id = auth.uid()
    )
  );

drop policy if exists "athlete_xp_ledger_select" on public.athlete_xp_ledger;
create policy "athlete_xp_ledger_select" on public.athlete_xp_ledger
  for select using (
    member_id = auth.uid()
    or public.is_coach_or_admin()
  );

-- ---------------------------------------------------------------------------
-- Pending celebrations (winner / unlock flash on next open)
-- ---------------------------------------------------------------------------
create table if not exists public.pending_celebrations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('achievement', 'weekly_champion', 'weekly_runner_up', 'weekly_bronze', 'level_up')),
  title text not null,
  body text,
  meta jsonb not null default '{}'::jsonb,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pending_celebrations_member_idx
  on public.pending_celebrations (member_id, created_at desc)
  where seen_at is null;

alter table public.pending_celebrations enable row level security;

drop policy if exists "pending_celebrations_own" on public.pending_celebrations;
create policy "pending_celebrations_own" on public.pending_celebrations
  for select using (member_id = auth.uid() or public.is_coach_or_admin());

drop policy if exists "pending_celebrations_update_own" on public.pending_celebrations;
create policy "pending_celebrations_update_own" on public.pending_celebrations
  for update using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Weekly challenges
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  instructions text,
  movements jsonb not null default '[]'::jsonb,
  score_type text not null default 'lowest_time'
    check (score_type in ('lowest_time', 'highest_reps', 'highest_weight', 'highest_points', 'coach_score')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'live', 'closed', 'archived')),
  xp_participate integer not null default 75,
  created_by uuid not null references public.profiles (id) on delete cascade,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists weekly_challenges_status_idx
  on public.weekly_challenges (status, ends_at desc);

create table if not exists public.challenge_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.weekly_challenges (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  score_value numeric not null,
  score_display text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  is_pr boolean not null default false,
  previous_score_value numeric,
  previous_score_display text,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, member_id)
);

create index if not exists challenge_results_challenge_status_idx
  on public.challenge_results (challenge_id, status, score_value);

create table if not exists public.challenge_podium (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.weekly_challenges (id) on delete cascade,
  place integer not null check (place between 1 and 3),
  member_id uuid not null references public.profiles (id) on delete cascade,
  result_id uuid not null references public.challenge_results (id) on delete cascade,
  score_display text not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, place),
  unique (challenge_id, member_id)
);

alter table public.weekly_challenges enable row level security;
alter table public.challenge_results enable row level security;
alter table public.challenge_podium enable row level security;

drop policy if exists "weekly_challenges_select" on public.weekly_challenges;
create policy "weekly_challenges_select" on public.weekly_challenges
  for select using (
    public.is_coach_or_admin()
    or status in ('live', 'closed', 'scheduled')
  );

drop policy if exists "weekly_challenges_manage" on public.weekly_challenges;
create policy "weekly_challenges_manage" on public.weekly_challenges
  for all using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

drop policy if exists "challenge_results_select" on public.challenge_results;
create policy "challenge_results_select" on public.challenge_results
  for select using (
    public.is_coach_or_admin()
    or member_id = auth.uid()
    or status = 'verified'
  );

drop policy if exists "challenge_results_insert_own" on public.challenge_results;
create policy "challenge_results_insert_own" on public.challenge_results
  for insert with check (member_id = auth.uid() or public.is_coach_or_admin());

drop policy if exists "challenge_results_update_staff" on public.challenge_results;
create policy "challenge_results_update_staff" on public.challenge_results
  for update using (public.is_coach_or_admin() or member_id = auth.uid())
  with check (public.is_coach_or_admin() or member_id = auth.uid());

drop policy if exists "challenge_podium_select" on public.challenge_podium;
create policy "challenge_podium_select" on public.challenge_podium
  for select using (true);

drop policy if exists "challenge_podium_manage" on public.challenge_podium;
create policy "challenge_podium_manage" on public.challenge_podium
  for all using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

-- Enable realtime for leaderboard
do $$
begin
  begin
    alter publication supabase_realtime add table public.challenge_results;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Level helper
-- ---------------------------------------------------------------------------
create or replace function public.xp_level_for(p_total integer)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(sqrt(greatest(p_total, 0)::numeric / 50.0))::integer + 1);
$$;

create or replace function public.xp_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select greatest(0, ((greatest(p_level, 1) - 1) ^ 2) * 50)::integer;
$$;

create or replace function public.athlete_level_title(p_level integer)
returns text
language sql
immutable
as $$
  select case
    when p_level >= 50 then 'Reforge Legend'
    when p_level >= 40 then 'Champion'
    when p_level >= 30 then 'Warrior'
    when p_level >= 20 then 'Elite'
    when p_level >= 10 then 'Competitor'
    when p_level >= 5 then 'Athlete'
    else 'Rookie'
  end;
$$;

-- ---------------------------------------------------------------------------
-- award_xp
-- ---------------------------------------------------------------------------
create or replace function public.award_xp(
  p_member uuid,
  p_amount integer,
  p_reason text,
  p_ref_type text default null,
  p_ref_id uuid default null
)
returns public.athlete_xp
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.athlete_xp;
  v_prev_level integer;
  v_new_level integer;
begin
  if p_member is null or coalesce(p_amount, 0) = 0 then
    raise exception 'Invalid XP award';
  end if;

  insert into public.athlete_xp (member_id, total_xp, level, updated_at)
  values (p_member, 0, 1, now())
  on conflict (member_id) do nothing;

  select * into v_row from public.athlete_xp where member_id = p_member for update;
  v_prev_level := v_row.level;

  insert into public.athlete_xp_ledger (member_id, amount, reason, ref_type, ref_id)
  values (p_member, p_amount, p_reason, p_ref_type, p_ref_id);

  v_new_level := public.xp_level_for(v_row.total_xp + p_amount);

  update public.athlete_xp
  set total_xp = total_xp + p_amount,
      level = v_new_level,
      updated_at = now()
  where member_id = p_member
  returning * into v_row;

  if v_new_level > v_prev_level then
    insert into public.pending_celebrations (member_id, kind, title, body, meta)
    values (
      p_member,
      'level_up',
      'LEVEL ' || v_new_level,
      public.athlete_level_title(v_new_level),
      jsonb_build_object('level', v_new_level, 'total_xp', v_row.total_xp)
    );
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- unlock_achievement (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.unlock_achievement(
  p_member uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ach public.achievements;
  v_existing uuid;
  v_ma_id uuid;
begin
  select * into v_ach from public.achievements where code = p_code and is_active = true;
  if v_ach.id is null then
    return jsonb_build_object('unlocked', false, 'reason', 'missing');
  end if;

  select id into v_existing
  from public.member_achievements
  where member_id = p_member and achievement_id = v_ach.id;

  if v_existing is not null then
    return jsonb_build_object('unlocked', false, 'reason', 'already', 'achievement_id', v_ach.id);
  end if;

  insert into public.member_achievements (member_id, achievement_id)
  values (p_member, v_ach.id)
  returning id into v_ma_id;

  if coalesce(v_ach.xp_reward, 0) > 0 then
    perform public.award_xp(p_member, v_ach.xp_reward, 'achievement:' || v_ach.code, 'achievement', v_ach.id);
  end if;

  insert into public.pending_celebrations (member_id, kind, title, body, meta)
  values (
    p_member,
    'achievement',
    v_ach.title,
    v_ach.description,
    jsonb_build_object(
      'code', v_ach.code,
      'xp', v_ach.xp_reward,
      'rarity', v_ach.rarity,
      'icon_key', v_ach.icon_key
    )
  );

  return jsonb_build_object(
    'unlocked', true,
    'achievement_id', v_ach.id,
    'code', v_ach.code,
    'title', v_ach.title,
    'xp', v_ach.xp_reward,
    'rarity', v_ach.rarity,
    'description', v_ach.description,
    'icon_key', v_ach.icon_key
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- evaluate_session_achievements
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_session_achievements(p_member uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_sessions integer;
  v_prs integer;
  v_unlocked jsonb := '[]'::jsonb;
  v_item jsonb;
  v_day date;
  v_streak integer := 0;
  v_cursor date;
  v_latest_completed_session uuid;
begin
  if p_member is null or p_member <> auth.uid() then
    if not public.is_coach_or_admin() then
      raise exception 'Not allowed';
    end if;
  end if;

  select count(*)::integer into v_sessions
  from public.workout_sessions
  where member_id = p_member and status = 'completed';

  select count(*)::integer into v_prs
  from public.personal_records
  where member_id = p_member;

  -- streak: consecutive calendar days with a completed session ending today or yesterday
  select max(completed_at::date) into v_day
  from public.workout_sessions
  where member_id = p_member and status = 'completed' and completed_at is not null;

  if v_day is not null and v_day >= (current_date - 1) then
    v_cursor := v_day;
    loop
      if exists (
        select 1 from public.workout_sessions
        where member_id = p_member and status = 'completed'
          and completed_at::date = v_cursor
      ) then
        v_streak := v_streak + 1;
        v_cursor := v_cursor - 1;
      else
        exit;
      end if;
    end loop;
  end if;

  -- Workout completion XP — once per completed session (deduped by session id)
  select ws.id
    into v_latest_completed_session
  from public.workout_sessions ws
  where ws.member_id = p_member
    and ws.status = 'completed'
  order by coalesce(ws.finished_at, ws.started_at) desc
  limit 1;

  if v_latest_completed_session is not null and not exists (
    select 1 from public.athlete_xp_ledger
    where member_id = p_member
      and reason = 'workout_complete'
      and ref_id = v_latest_completed_session
  ) then
    perform public.award_xp(p_member, 50, 'workout_complete', 'session', v_latest_completed_session);
  end if;

  if v_sessions >= 1 then
    v_item := public.unlock_achievement(p_member, 'first_session');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_sessions >= 10 then
    v_item := public.unlock_achievement(p_member, 'sessions_10');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_sessions >= 50 then
    v_item := public.unlock_achievement(p_member, 'sessions_50');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_sessions >= 100 then
    v_item := public.unlock_achievement(p_member, 'sessions_100');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_sessions >= 250 then
    v_item := public.unlock_achievement(p_member, 'sessions_250');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;

  if v_prs >= 1 then
    v_item := public.unlock_achievement(p_member, 'new_pr');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_prs >= 5 then
    v_item := public.unlock_achievement(p_member, 'prs_5');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_prs >= 10 then
    v_item := public.unlock_achievement(p_member, 'prs_10');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;

  if v_streak >= 5 then
    v_item := public.unlock_achievement(p_member, 'streak_5');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_streak >= 10 then
    v_item := public.unlock_achievement(p_member, 'streak_10');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;
  if v_streak >= 30 then
    v_item := public.unlock_achievement(p_member, 'streak_30');
    if (v_item->>'unlocked')::boolean then v_unlocked := v_unlocked || v_item; end if;
  end if;

  return jsonb_build_object(
    'sessions', v_sessions,
    'prs', v_prs,
    'streak', v_streak,
    'unlocked', v_unlocked
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Challenge result submit / verify / close
-- ---------------------------------------------------------------------------
create or replace function public.submit_challenge_result(
  p_challenge_id uuid,
  p_score_value numeric,
  p_score_display text
)
returns public.challenge_results
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_chal public.weekly_challenges;
  v_prev public.challenge_results;
  v_row public.challenge_results;
  v_is_pr boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_chal from public.weekly_challenges where id = p_challenge_id;
  if v_chal.id is null then raise exception 'Challenge not found'; end if;
  if v_chal.status <> 'live' then raise exception 'Challenge is not live'; end if;
  if now() < v_chal.starts_at or now() > v_chal.ends_at then
    raise exception 'Challenge window is closed';
  end if;
  if p_score_value is null or coalesce(trim(p_score_display), '') = '' then
    raise exception 'Score required';
  end if;

  select * into v_prev
  from public.challenge_results
  where challenge_id = p_challenge_id and member_id = v_uid;

  if v_prev.id is not null and v_prev.status = 'verified' then
    -- allow improvement resubmit → back to pending
    if v_chal.score_type = 'lowest_time' then
      v_is_pr := p_score_value < v_prev.score_value;
    else
      v_is_pr := p_score_value > v_prev.score_value;
    end if;
  elsif v_prev.id is not null then
    v_is_pr := false;
  end if;

  insert into public.challenge_results as cr (
    challenge_id, member_id, score_value, score_display, status, is_pr,
    previous_score_value, previous_score_display, updated_at
  )
  values (
    p_challenge_id, v_uid, p_score_value, trim(p_score_display), 'pending', v_is_pr,
    v_prev.score_value, v_prev.score_display, now()
  )
  on conflict (challenge_id, member_id) do update
    set score_value = excluded.score_value,
        score_display = excluded.score_display,
        status = 'pending',
        is_pr = excluded.is_pr,
        previous_score_value = coalesce(cr.score_value, excluded.previous_score_value),
        previous_score_display = coalesce(cr.score_display, excluded.previous_score_display),
        verified_by = null,
        verified_at = null,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.verify_challenge_result(
  p_result_id uuid,
  p_status text,
  p_score_value numeric default null,
  p_score_display text default null,
  p_notes text default null
)
returns public.challenge_results
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.challenge_results;
  v_chal public.weekly_challenges;
  v_had_verified boolean;
begin
  if not public.is_coach_or_admin() then raise exception 'Staff only'; end if;
  if p_status not in ('verified', 'rejected', 'pending') then
    raise exception 'Invalid status';
  end if;

  select * into v_row from public.challenge_results where id = p_result_id for update;
  if v_row.id is null then raise exception 'Result not found'; end if;
  v_had_verified := v_row.status = 'verified';

  select * into v_chal from public.weekly_challenges where id = v_row.challenge_id;

  update public.challenge_results
  set status = p_status,
      score_value = coalesce(p_score_value, score_value),
      score_display = coalesce(nullif(trim(p_score_display), ''), score_display),
      notes = coalesce(p_notes, notes),
      verified_by = case when p_status in ('verified', 'rejected') then auth.uid() else verified_by end,
      verified_at = case when p_status in ('verified', 'rejected') then now() else verified_at end,
      updated_at = now()
  where id = p_result_id
  returning * into v_row;

  -- Participate XP once when first verified
  if p_status = 'verified' and not v_had_verified then
    if not exists (
      select 1 from public.athlete_xp_ledger
      where member_id = v_row.member_id
        and reason = 'challenge_participate'
        and ref_id = v_row.challenge_id
    ) then
      perform public.award_xp(
        v_row.member_id,
        coalesce(v_chal.xp_participate, 75),
        'challenge_participate',
        'weekly_challenge',
        v_row.challenge_id
      );
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.close_weekly_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_chal public.weekly_challenges;
  v_place integer := 0;
  r record;
  v_code text;
  v_kind text;
  v_xp integer;
begin
  if not public.is_coach_or_admin() then raise exception 'Staff only'; end if;

  select * into v_chal from public.weekly_challenges where id = p_challenge_id for update;
  if v_chal.id is null then raise exception 'Challenge not found'; end if;

  update public.weekly_challenges
  set status = 'closed', closed_at = now(), updated_at = now()
  where id = p_challenge_id;

  delete from public.challenge_podium where challenge_id = p_challenge_id;

  for r in
    select cr.*
    from public.challenge_results cr
    where cr.challenge_id = p_challenge_id and cr.status = 'verified'
    order by
      case when v_chal.score_type = 'lowest_time' then cr.score_value end asc nulls last,
      case when v_chal.score_type <> 'lowest_time' then cr.score_value end desc nulls last,
      cr.created_at asc
    limit 3
  loop
    v_place := v_place + 1;
    insert into public.challenge_podium (challenge_id, place, member_id, result_id, score_display)
    values (p_challenge_id, v_place, r.member_id, r.id, r.score_display);

    if v_place = 1 then
      v_code := 'weekly_champion'; v_kind := 'weekly_champion'; v_xp := 500;
    elsif v_place = 2 then
      v_code := 'weekly_runner_up'; v_kind := 'weekly_runner_up'; v_xp := 300;
    else
      v_code := 'weekly_bronze'; v_kind := 'weekly_bronze'; v_xp := 200;
    end if;

    perform public.unlock_achievement(r.member_id, v_code);

    insert into public.pending_celebrations (member_id, kind, title, body, meta)
    values (
      r.member_id,
      v_kind,
      case v_place when 1 then 'WEEKLY CHAMPION' when 2 then 'WEEKLY RUNNER-UP' else 'WEEKLY BRONZE' end,
      'You finished this week''s challenge in ' || r.score_display,
      jsonb_build_object(
        'challenge_id', p_challenge_id,
        'place', v_place,
        'score_display', r.score_display,
        'xp', v_xp,
        'challenge_name', v_chal.name
      )
    );
  end loop;

  return jsonb_build_object('closed', true, 'podium_count', v_place);
end;
$$;

create or replace function public.manual_award_achievement(
  p_member uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_coach_or_admin() then raise exception 'Staff only'; end if;
  return public.unlock_achievement(p_member, p_code);
end;
$$;

create or replace function public.mark_celebration_seen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.pending_celebrations
  set seen_at = now()
  where id = p_id and member_id = auth.uid();
end;
$$;

grant execute on function public.evaluate_session_achievements(uuid) to authenticated;
grant execute on function public.submit_challenge_result(uuid, numeric, text) to authenticated;
grant execute on function public.verify_challenge_result(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.close_weekly_challenge(uuid) to authenticated;
grant execute on function public.manual_award_achievement(uuid, text) to authenticated;
grant execute on function public.mark_celebration_seen(uuid) to authenticated;
grant execute on function public.xp_level_for(integer) to authenticated;
grant execute on function public.xp_for_level(integer) to authenticated;
grant execute on function public.athlete_level_title(integer) to authenticated;
grant execute on function public.is_coach_or_admin() to authenticated;

-- XP / unlock only via staff RPCs or evaluate/close (not direct client award)
revoke all on function public.award_xp(uuid, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.unlock_achievement(uuid, text) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text, uuid) to service_role;
grant execute on function public.unlock_achievement(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Seed / update catalog
-- ---------------------------------------------------------------------------
update public.achievements set
  rarity = coalesce(rarity, 'common'),
  xp_reward = case code
    when 'first_session' then 50
    when 'sessions_10' then 100
    when 'sessions_50' then 200
    when 'sessions_100' then 400
    when 'new_pr' then 100
    else coalesce(xp_reward, 50)
  end,
  category = case
    when category in ('strength') then 'performance'
    when category in ('program') then 'training'
    else category
  end
where true;

insert into public.achievements (code, title, description, category, threshold, rarity, xp_reward, icon_key, award_mode)
values
  ('sessions_250', '250 WORKOUTS', 'Complete 250 workouts.', 'training', 250, 'legendary', 800, 'flash', 'automatic'),
  ('streak_5', '5 WORKOUT STREAK', 'Train 5 days in a row.', 'consistency', 5, 'common', 100, 'flame', 'automatic'),
  ('streak_10', '10 WORKOUT STREAK', 'Train 10 days in a row.', 'consistency', 10, 'rare', 150, 'flame', 'automatic'),
  ('streak_30', '30 WORKOUT STREAK', 'Train 30 days in a row.', 'consistency', 30, 'epic', 400, 'flame', 'automatic'),
  ('prs_5', '5 PERSONAL RECORDS', 'Set 5 personal records.', 'performance', 5, 'rare', 200, 'trending-up', 'automatic'),
  ('prs_10', '10 PERSONAL RECORDS', 'Set 10 personal records.', 'performance', 10, 'epic', 350, 'trending-up', 'automatic'),
  ('weekly_champion', 'WEEKLY CHAMPION', 'Win a weekly REFORGE challenge.', 'challenges', 1, 'legendary', 500, 'trophy', 'automatic'),
  ('weekly_runner_up', 'WEEKLY RUNNER-UP', 'Finish 2nd in a weekly challenge.', 'challenges', 2, 'epic', 300, 'medal', 'automatic'),
  ('weekly_bronze', 'WEEKLY BRONZE', 'Finish 3rd in a weekly challenge.', 'challenges', 3, 'rare', 200, 'medal', 'automatic'),
  ('coachs_choice', 'COACH''S CHOICE', 'Recognized by the coaching staff.', 'special', null, 'legendary', 250, 'star', 'manual'),
  ('most_improved', 'MOST IMPROVED', 'Outstanding progress this cycle.', 'special', null, 'epic', 250, 'sparkles', 'manual'),
  ('community_champion', 'COMMUNITY CHAMPION', 'Elevated the REFORGE community.', 'special', null, 'epic', 200, 'people', 'manual'),
  ('athlete_of_month', 'ATHLETE OF THE MONTH', 'REFORGE Athlete of the Month.', 'special', null, 'legendary', 500, 'ribbon', 'manual')
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  threshold = excluded.threshold,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  icon_key = excluded.icon_key,
  award_mode = excluded.award_mode;
