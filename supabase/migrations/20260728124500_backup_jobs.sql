create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  provider text not null check (
    provider in ('onedrive', 'cloudflare-r2', 'backblaze-b2', 'local-node')
  ),
  job_type text not null check (
    job_type in ('sync', 'backup', 'restore-test')
  ),
  status text not null check (
    status in ('queued', 'running', 'completed', 'failed', 'blocked')
  ) default 'queued',
  source text not null default 'render-worker',
  object_count integer not null default 0,
  bytes_processed bigint not null default 0,
  manifest jsonb not null default '{}'::jsonb,
  error_message text,
  requested_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.backup_jobs enable row level security;

create index if not exists backup_jobs_school_created_idx
on public.backup_jobs (school_id, created_at desc);

create index if not exists backup_jobs_provider_status_idx
on public.backup_jobs (provider, status);

drop policy if exists "Backup jobs visible within same school" on public.backup_jobs;
create policy "Backup jobs visible within same school"
on public.backup_jobs
for select
to authenticated
using (
  school_id in (
    select school_id from public.profiles where id = (select auth.uid())
  )
);

grant select on public.backup_jobs to authenticated;
