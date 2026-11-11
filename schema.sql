-- Signage: database setup. Paste all of this into Supabase → SQL Editor → New query → Run.

-- Layouts made in the editor
create table if not exists public.layouts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled',
  data        jsonb not null default '{}'::jsonb,   -- { bg, zones: [...] }
  updated_at  timestamptz not null default now()
);

-- Fire Sticks / TVs
create table if not exists public.screens (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null unique,                -- random id the player keeps on the device
  pair_code   text not null unique,                -- 8-digit code shown on the TV
  name        text,
  paired      boolean not null default false,
  layout_id   uuid references public.layouts(id) on delete set null,
  last_seen   timestamptz default now(),
  created_at  timestamptz not null default now()
);

alter table public.layouts enable row level security;
alter table public.screens enable row level security;

-- Only signed-in users (you) can see and change layouts and screens from the dashboard.
drop policy if exists "signed in manage layouts" on public.layouts;
create policy "signed in manage layouts" on public.layouts
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in manage screens" on public.screens;
create policy "signed in manage screens" on public.screens
  for all to authenticated using (true) with check (true);

-- The player is not signed in. It only gets these two functions,
-- which can't see any other screen or list your layouts.

-- Gives a device its pairing code (creates one the first time).
create or replace function public.register_screen(p_device uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare c text;
begin
  select pair_code into c from screens where device_id = p_device;
  if c is not null then return c; end if;
  loop
    c := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from screens where pair_code = c);
  end loop;
  insert into screens (device_id, pair_code) values (p_device, c);
  return c;
end $$;

-- What a device should show right now. Also records that it's online.
create or replace function public.screen_config(p_device uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare s screens; l layouts;
begin
  update screens set last_seen = now() where device_id = p_device returning * into s;
  if s.id is null then return null; end if;
  if s.paired and s.layout_id is not null then
    select * into l from layouts where id = s.layout_id;
  end if;
  return jsonb_build_object(
    'paired', s.paired,
    'pair_code', s.pair_code,
    'name', s.name,
    'layout', case when l.id is null then null
                   else l.data || jsonb_build_object('id', l.id, 'name', l.name, 'updated_at', l.updated_at) end
  );
end $$;

revoke all on function public.register_screen(uuid) from public;
revoke all on function public.screen_config(uuid) from public;
grant execute on function public.register_screen(uuid) to anon, authenticated;
grant execute on function public.screen_config(uuid) to anon, authenticated;

-- Media files: a public bucket, so screens can download without signing in.
-- Only signed-in users can upload, replace or delete.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "signed in upload media" on storage.objects;
create policy "signed in upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "signed in update media" on storage.objects;
create policy "signed in update media" on storage.objects
  for update to authenticated using (bucket_id = 'media');

drop policy if exists "signed in delete media" on storage.objects;
create policy "signed in delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
