-- Account-isolated reusable Visual Builder elements and fonts.
create table if not exists public.visual_assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160), asset_type text not null,
  category text not null default 'element', storage_path text not null unique, mime_type text not null,
  file_size bigint not null check (file_size between 1 and 8388608), width integer, height integer,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.custom_fonts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 160), family_name text not null,
  storage_path text not null unique, mime_type text not null, file_size bigint not null check (file_size between 1 and 5242880),
  font_format text not null, font_weight integer not null default 400 check (font_weight between 100 and 900),
  font_style text not null default 'normal' check (font_style in ('normal','italic')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists visual_assets_user_created_idx on public.visual_assets(user_id, created_at desc);
create index if not exists visual_assets_user_category_idx on public.visual_assets(user_id, category);
create index if not exists custom_fonts_user_created_idx on public.custom_fonts(user_id, created_at desc);
alter table public.visual_assets enable row level security;
alter table public.custom_fonts enable row level security;
drop policy if exists "Owners manage visual assets" on public.visual_assets;
create policy "Owners manage visual assets" on public.visual_assets for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "Owners manage custom fonts" on public.custom_fonts;
create policy "Owners manage custom fonts" on public.custom_fonts for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('visual-assets','visual-assets',false,8388608,array['image/png','image/jpeg','image/webp']),
 ('custom-fonts','custom-fonts',false,5242880,array['font/woff2','font/woff','font/ttf','font/otf','application/font-woff','application/x-font-ttf','application/x-font-opentype','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Object names begin with the authenticated user's UUID.
drop policy if exists "Owners read visual library objects" on storage.objects;
create policy "Owners read visual library objects" on storage.objects for select to authenticated using (bucket_id in ('visual-assets','custom-fonts') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Owners insert visual library objects" on storage.objects;
create policy "Owners insert visual library objects" on storage.objects for insert to authenticated with check (bucket_id in ('visual-assets','custom-fonts') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Owners update visual library objects" on storage.objects;
create policy "Owners update visual library objects" on storage.objects for update to authenticated using (bucket_id in ('visual-assets','custom-fonts') and (storage.foldername(name))[1]=auth.uid()::text) with check ((storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Owners delete visual library objects" on storage.objects;
create policy "Owners delete visual library objects" on storage.objects for delete to authenticated using (bucket_id in ('visual-assets','custom-fonts') and (storage.foldername(name))[1]=auth.uid()::text);
