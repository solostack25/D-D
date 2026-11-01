-- Daily usage counters for the AI Dungeon Master, so the API key can't be drained.
create table if not exists public.ai_usage (
  code text not null,
  day date not null default (now() at time zone 'utc')::date,
  calls integer not null default 0,
  primary key (code, day)
);
alter table public.ai_usage enable row level security;

-- Returns 'ok', 'no_room', 'room_limit' or 'global_limit'. Counts the call when ok.
create or replace function public.ai_quota(p_code text, p_room_limit int default 300, p_global_limit int default 2000)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(trim(p_code));
  v_day date := (now() at time zone 'utc')::date;
  v_room int;
  v_total int;
begin
  if not exists (select 1 from public.rooms r where r.code = v_code and r.updated_at > now() - interval '12 hours') then
    return 'no_room';
  end if;
  select coalesce(sum(calls), 0) into v_total from public.ai_usage where day = v_day;
  if v_total >= least(p_global_limit, 2000) then return 'global_limit'; end if;
  insert into public.ai_usage (code, day, calls) values (v_code, v_day, 1)
  on conflict (code, day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_room;
  if v_room > least(p_room_limit, 300) then return 'room_limit'; end if;
  return 'ok';
end;
$$;

revoke all on function public.ai_quota(text, int, int) from public;
grant execute on function public.ai_quota(text, int, int) to anon, authenticated;
