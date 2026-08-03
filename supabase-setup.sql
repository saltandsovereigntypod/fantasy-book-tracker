-- The Empyrean Tracker, initial Supabase schema.
-- Run this entire file once in the Supabase SQL Editor for project udxatwvbxpefbdhnsycf.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Reader',
  invite_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint invite_codes_nonnegative check (uses >= 0 and (max_uses is null or max_uses >= 1))
);

create table if not exists public.archive_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Reader'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.validate_invite_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invite_codes
    where code = trim(p_code)
      and is_active = true
      and (expires_at is null or expires_at > now())
      and (max_uses is null or uses < max_uses)
  );
$$;

create or replace function public.claim_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_id uuid;
  already_claimed boolean;
begin
  if auth.uid() is null then return false; end if;

  select invite_claimed into already_claimed
  from public.profiles where id = auth.uid();

  if already_claimed then return true; end if;

  select id into matched_id
  from public.invite_codes
  where code = trim(p_code)
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses)
  for update;

  if matched_id is null then return false; end if;

  update public.invite_codes set uses = uses + 1 where id = matched_id;
  update public.profiles set invite_claimed = true, updated_at = now() where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.validate_invite_code(text) from public;
revoke all on function public.claim_invite_code(text) from public;
grant execute on function public.validate_invite_code(text) to anon, authenticated;
grant execute on function public.claim_invite_code(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.archive_states enable row level security;

create policy "Users read own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "Users update own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Invited users read own archive"
on public.archive_states for select to authenticated
using (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.invite_claimed)
);

create policy "Invited users create own archive"
on public.archive_states for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.invite_claimed)
);

create policy "Invited users update own archive"
on public.archive_states for update to authenticated
using (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.invite_claimed)
)
with check (
  user_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.invite_claimed)
);

create policy "Users delete own archive"
on public.archive_states for delete to authenticated
using (user_id = auth.uid());

-- After the schema succeeds, create at least one invitation code.
-- Replace the example code before running this statement:
-- insert into public.invite_codes (code, max_uses) values ('YOUR-PRIVATE-CODE', 20);

-- Reusable authenticated Visual Builder assets. Object keys are always scoped
-- to the owning user's UUID by supabase-bridge.js.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visual-assets', 'visual-assets', true, 8388608, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own visual assets" on storage.objects;
create policy "Users upload own visual assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'visual-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own visual assets" on storage.objects;
create policy "Users update own visual assets"
on storage.objects for update to authenticated
using (bucket_id = 'visual-assets' and owner_id = auth.uid()::text)
with check (bucket_id = 'visual-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own visual assets" on storage.objects;
create policy "Users delete own visual assets"
on storage.objects for delete to authenticated
using (bucket_id = 'visual-assets' and owner_id = auth.uid()::text);
