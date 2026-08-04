alter table public.students
  add column if not exists enrolment_status text default 'active' check (
    enrolment_status in ('applicant', 'active', 'transferred', 'graduated')
  ),
  add column if not exists academic_year text,
  add column if not exists parent_user_ids uuid[] default array[]::uuid[],
  add column if not exists merged_into_student_id uuid references public.students(id);

alter table public.school_settings
  add column if not exists campus_name text default 'Main Campus',
  add column if not exists academic_year text default '2026/2027',
  add column if not exists active_term text default 'Term 1',
  add column if not exists matricule_prefix text default 'DRM',
  add column if not exists institution_edition text default 'bilingual-k12',
  add column if not exists country_pack text default 'cameroon-bilingual',
  add column if not exists enabled_modules text[] default array['academics','finance','communications','transport','reporting'],
  add column if not exists languages text[] default array['en','fr'],
  add column if not exists terminology jsonb default '{"student":"Learner","class":"Class","guardian":"Parent / guardian"}'::jsonb;

create table if not exists public.workflow_corrections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  correction_type text not null check (
    correction_type in (
      'payment-reversal',
      'invoice-adjustment',
      'student-transfer',
      'placement-change',
      'duplicate-merge',
      'parent-link'
    )
  ),
  original_record_id text not null,
  replacement_record_id text,
  status text not null default 'requested' check (status in ('requested','approved','rejected','applied')),
  reason text not null,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists workflow_corrections_school_created_idx
  on public.workflow_corrections (school_id, created_at desc);

create table if not exists public.bursar_liabilities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  bursar_id uuid references public.profiles(id),
  bursar_name text not null,
  student_id uuid references public.students(id),
  student_name text not null,
  receipt_number text not null,
  amount numeric(12,2) not null check (amount >= 0),
  collected_at timestamptz not null default now(),
  status text not null default 'outstanding' check (status in ('outstanding','part-settled','settled','disputed')),
  settlement_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists bursar_liabilities_school_status_idx
  on public.bursar_liabilities (school_id, status, collected_at desc);

create table if not exists public.bursar_settlements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  bursar_id uuid references public.profiles(id),
  bursar_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  settled_at timestamptz not null default now(),
  channel text not null check (channel in ('cash-handover','bank-deposit','mobile-money','orange-money')),
  reference text not null,
  status text not null default 'pending-review' check (status in ('pending-review','accepted','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists bursar_settlements_school_status_idx
  on public.bursar_settlements (school_id, status, settled_at desc);

alter table public.workflow_corrections enable row level security;
alter table public.bursar_liabilities enable row level security;
alter table public.bursar_settlements enable row level security;

grant select, insert on public.workflow_corrections to authenticated;
grant select, insert on public.bursar_liabilities to authenticated;
grant select, insert on public.bursar_settlements to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, update on public.fee_accounts to authenticated;

drop policy if exists "Students insert within same school" on public.students;
create policy "Students insert requires school configuration permission"
on public.students
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "Students update within same school" on public.students;
create policy "Students update requires school configuration permission"
on public.students
for update
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
)
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "Workflow corrections visible within school" on public.workflow_corrections;
create policy "Workflow corrections visible within school"
on public.workflow_corrections
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('operations.school.configure')
    or public.current_user_can('finance.payments.write')
    or public.current_user_can('reporting.view')
  )
);

drop policy if exists "Workflow corrections writable by authorized operators" on public.workflow_corrections;
create policy "Workflow corrections writable by authorized operators"
on public.workflow_corrections
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('operations.school.configure')
    or public.current_user_can('finance.payments.write')
  )
);

drop policy if exists "Bursar liabilities visible to finance operators" on public.bursar_liabilities;
create policy "Bursar liabilities visible to finance operators"
on public.bursar_liabilities
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('finance.view')
    or public.current_user_can('reporting.view')
  )
);

drop policy if exists "Bursar liabilities writable by payment operators" on public.bursar_liabilities;
create policy "Bursar liabilities writable by payment operators"
on public.bursar_liabilities
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.payments.write')
);

drop policy if exists "Bursar settlements visible to finance operators" on public.bursar_settlements;
create policy "Bursar settlements visible to finance operators"
on public.bursar_settlements
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('finance.view')
    or public.current_user_can('reporting.view')
  )
);

drop policy if exists "Bursar settlements writable by payment operators" on public.bursar_settlements;
create policy "Bursar settlements writable by payment operators"
on public.bursar_settlements
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.payments.write')
);
