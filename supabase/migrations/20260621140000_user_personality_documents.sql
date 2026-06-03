-- Personality document uploads: metadata table, users timestamp, private storage bucket.

create table if not exists public.user_personality_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  extracted_signals jsonb default null,
  narrative_summary text default null,
  processing_status text not null default 'pending',
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz default null,
  constraint user_personality_documents_processing_status_check
    check (processing_status in ('pending', 'processing', 'complete', 'failed'))
);

create unique index if not exists idx_user_personality_documents_storage_path
  on public.user_personality_documents(storage_path);

create index if not exists idx_user_personality_documents_user_id
  on public.user_personality_documents(user_id);

alter table public.users
  add column if not exists personality_documents_uploaded_at timestamptz default null;

alter table public.user_personality_documents enable row level security;

drop policy if exists "user_personality_documents_select_own" on public.user_personality_documents;
create policy "user_personality_documents_select_own"
  on public.user_personality_documents
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_personality_documents_insert_own" on public.user_personality_documents;
create policy "user_personality_documents_insert_own"
  on public.user_personality_documents
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_personality_documents_delete_own" on public.user_personality_documents;
create policy "user_personality_documents_delete_own"
  on public.user_personality_documents
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Private bucket — files are never publicly accessible.
insert into storage.buckets (id, name, public)
values ('personality-documents', 'personality-documents', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "personality_documents_insert_own" on storage.objects;
create policy "personality_documents_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'personality-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "personality_documents_select_own" on storage.objects;
create policy "personality_documents_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'personality-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "personality_documents_delete_own" on storage.objects;
create policy "personality_documents_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'personality-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
