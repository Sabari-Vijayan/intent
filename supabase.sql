-- Intent form builder - Supabase schema
-- Run this entire file once in the Supabase SQL Editor.
-- This file does not contain service-role credentials or database passwords.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  schema_json jsonb not null,
  creator uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (form_id, version_number)
);

alter table public.forms
  drop constraint if exists forms_current_version_id_fkey;
alter table public.forms
  add constraint forms_current_version_id_fkey
  foreign key (current_version_id) references public.form_versions(id);

create table if not exists public.form_translations (
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2,3}(?:-[A-Z][a-z]{2})?$'),
  strings jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('complete', 'partial', 'pending')),
  provider text,
  model text,
  updated_at timestamptz not null default now(),
  primary key (form_version_id, locale)
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete restrict,
  form_version_id uuid not null references public.form_versions(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  respondent_locale text not null,
  status text not null default 'submitted' check (status in ('submitted', 'partial')),
  idempotency_ref text not null,
  unique (form_id, idempotency_ref)
);

create table if not exists public.response_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  field_id text not null,
  value_json jsonb not null,
  original_text text,
  original_locale text,
  created_at timestamptz not null default now(),
  unique (response_id, field_id)
);

create table if not exists public.answer_translations (
  answer_id uuid not null references public.response_answers(id) on delete cascade,
  target_locale text not null,
  text text not null,
  provider text,
  model text,
  status text not null default 'pending' check (status in ('complete', 'failed', 'pending')),
  created_at timestamptz not null default now(),
  primary key (answer_id, target_locale)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists forms_workspace_id_idx on public.forms(workspace_id);
create index if not exists form_versions_form_id_idx on public.form_versions(form_id, version_number desc);
create index if not exists responses_form_id_idx on public.responses(form_id, submitted_at desc);
create index if not exists response_answers_response_id_idx on public.response_answers(response_id);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.create_workspace_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_workspace uuid;
begin
  insert into public.workspaces (owner_id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'workspace_name', ''), 'My workspace'))
  returning id into new_workspace;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_intent on auth.users;
create trigger on_auth_user_created_intent
  after insert on auth.users
  for each row execute procedure public.create_workspace_for_user();

create or replace function public.prevent_published_version_mutation()
returns trigger language plpgsql as $$
begin
  if old.published_at is not null then
    raise exception 'Published form versions are immutable';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_published_version_update on public.form_versions;
create trigger prevent_published_version_update
  before update or delete on public.form_versions
  for each row execute procedure public.prevent_published_version_mutation();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.forms enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_translations enable row level security;
alter table public.responses enable row level security;
alter table public.response_answers enable row level security;
alter table public.answer_translations enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists workspace_read on public.workspaces;
create policy workspace_read on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
drop policy if exists workspace_update on public.workspaces;
create policy workspace_update on public.workspaces for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists member_read on public.workspace_members;
create policy member_read on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists member_manage on public.workspace_members;
create policy member_manage on public.workspace_members for all to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

drop policy if exists form_member_read on public.forms;
create policy form_member_read on public.forms for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists form_public_read on public.forms;
create policy form_public_read on public.forms for select to anon, authenticated
  using (status = 'published');
drop policy if exists form_editor_insert on public.forms;
create policy form_editor_insert on public.forms for insert to authenticated
  with check (public.can_edit_workspace(workspace_id));
drop policy if exists form_editor_update on public.forms;
create policy form_editor_update on public.forms for update to authenticated
  using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id));
drop policy if exists form_editor_delete on public.forms;
create policy form_editor_delete on public.forms for delete to authenticated
  using (public.can_edit_workspace(workspace_id));

drop policy if exists version_member_read on public.form_versions;
create policy version_member_read on public.form_versions for select to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and public.is_workspace_member(f.workspace_id)));
drop policy if exists version_public_read on public.form_versions;
create policy version_public_read on public.form_versions for select to anon, authenticated
  using (published_at is not null and exists (select 1 from public.forms f where f.id = form_id and f.status = 'published'));
drop policy if exists version_editor_insert on public.form_versions;
create policy version_editor_insert on public.form_versions for insert to authenticated
  with check (exists (select 1 from public.forms f where f.id = form_id and public.can_edit_workspace(f.workspace_id)) and creator = auth.uid());
drop policy if exists version_editor_update on public.form_versions;
create policy version_editor_update on public.form_versions for update to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and public.can_edit_workspace(f.workspace_id)))
  with check (exists (select 1 from public.forms f where f.id = form_id and public.can_edit_workspace(f.workspace_id)));

drop policy if exists translation_member_read on public.form_translations;
create policy translation_member_read on public.form_translations for select to authenticated
  using (exists (select 1 from public.form_versions v join public.forms f on f.id = v.form_id where v.id = form_version_id and public.is_workspace_member(f.workspace_id)));
drop policy if exists translation_public_read on public.form_translations;
create policy translation_public_read on public.form_translations for select to anon, authenticated
  using (exists (select 1 from public.form_versions v join public.forms f on f.id = v.form_id where v.id = form_version_id and v.published_at is not null and f.status = 'published'));
drop policy if exists translation_editor_write on public.form_translations;
create policy translation_editor_write on public.form_translations for all to authenticated
  using (exists (select 1 from public.form_versions v join public.forms f on f.id = v.form_id where v.id = form_version_id and public.can_edit_workspace(f.workspace_id)))
  with check (exists (select 1 from public.form_versions v join public.forms f on f.id = v.form_id where v.id = form_version_id and public.can_edit_workspace(f.workspace_id)));

drop policy if exists response_public_insert on public.responses;
create policy response_public_insert on public.responses for insert to anon, authenticated
  with check (exists (select 1 from public.forms f join public.form_versions v on v.form_id = f.id where f.id = form_id and v.id = form_version_id and f.status = 'published' and v.published_at is not null));
drop policy if exists response_member_read on public.responses;
create policy response_member_read on public.responses for select to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and public.is_workspace_member(f.workspace_id)));

drop policy if exists answer_public_insert on public.response_answers;
create policy answer_public_insert on public.response_answers for insert to anon, authenticated
  with check (exists (select 1 from public.responses r join public.forms f on f.id = r.form_id where r.id = response_id and f.status = 'published'));
drop policy if exists answer_member_read on public.response_answers;
create policy answer_member_read on public.response_answers for select to authenticated
  using (exists (select 1 from public.responses r join public.forms f on f.id = r.form_id where r.id = response_id and public.is_workspace_member(f.workspace_id)));

drop policy if exists answer_translation_member_read on public.answer_translations;
create policy answer_translation_member_read on public.answer_translations for select to authenticated
  using (exists (select 1 from public.response_answers a join public.responses r on r.id = a.response_id join public.forms f on f.id = r.form_id where a.id = answer_id and public.is_workspace_member(f.workspace_id)));
drop policy if exists answer_translation_member_write on public.answer_translations;
create policy answer_translation_member_write on public.answer_translations for all to authenticated
  using (exists (select 1 from public.response_answers a join public.responses r on r.id = a.response_id join public.forms f on f.id = r.form_id where a.id = answer_id and public.is_workspace_member(f.workspace_id)))
  with check (exists (select 1 from public.response_answers a join public.responses r on r.id = a.response_id join public.forms f on f.id = r.form_id where a.id = answer_id and public.is_workspace_member(f.workspace_id)));

drop policy if exists audit_member_read on public.audit_events;
create policy audit_member_read on public.audit_events for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists audit_member_insert on public.audit_events;
create policy audit_member_insert on public.audit_events for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and actor = auth.uid());
