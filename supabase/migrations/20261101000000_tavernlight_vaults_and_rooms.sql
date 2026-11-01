create extension if not exists pgcrypto with schema extensions;

-- Character vaults: one secret "hero code" holds a player's characters.
-- Tables are locked down by RLS with no policies; access only through the functions below.
create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  characters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vaults enable row level security;

-- Saved room state so a campaign can pick up next session.
create table if not exists public.rooms (
  code text primary key check (char_length(code) between 4 and 12),
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.rooms enable row level security;

create or replace function public.vault_get(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select v.characters from public.vaults v
  where v.code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
$$;

create or replace function public.vault_put(p_code text, p_characters jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(p_code)) < 12 then raise exception 'hero code too short'; end if;
  if jsonb_typeof(p_characters) <> 'array' or jsonb_array_length(p_characters) > 50 or pg_column_size(p_characters) > 300000 then
    raise exception 'invalid characters payload';
  end if;
  insert into public.vaults (code_hash, characters)
  values (encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex'), p_characters)
  on conflict (code_hash) do update set characters = excluded.characters, updated_at = now();
end;
$$;

create or replace function public.room_get(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select r.state from public.rooms r where r.code = upper(trim(p_code));
$$;

create or replace function public.room_put(p_code text, p_state jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if pg_column_size(p_state) > 500000 then raise exception 'room state too large'; end if;
  insert into public.rooms (code, state) values (upper(trim(p_code)), p_state)
  on conflict (code) do update set state = excluded.state, updated_at = now();
end;
$$;

revoke all on function public.vault_get(text), public.vault_put(text, jsonb), public.room_get(text), public.room_put(text, jsonb) from public;
grant execute on function public.vault_get(text), public.vault_put(text, jsonb), public.room_get(text), public.room_put(text, jsonb) to anon, authenticated;
