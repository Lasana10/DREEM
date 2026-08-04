create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  matricule text not null,
  role text not null check (
    role in ('leadership', 'teacher', 'student', 'parent', 'bursar', 'transport', 'support')
  ),
  department text not null default '',
  created_at timestamptz not null default now(),
  unique (school_id, matricule)
);

create table if not exists public.access_identities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  matricule text not null,
  email text,
  phone text,
  is_active boolean not null default true,
  must_reset_password boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, matricule)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null,
  category text not null check (
    category in ('announcement', 'campus-news', 'recognition', 'transport')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_materials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null,
  class_name text,
  delivery text not null check (
    delivery in ('notes', 'assignment', 'follow-up')
  ),
  audience text not null check (
    audience in ('student', 'parent', 'teacher')
  ),
  summary text not null,
  due_date date,
  published_by text,
  status text not null default 'published' check (
    status in ('draft', 'published')
  ),
  storage_provider text not null default 'supabase' check (
    storage_provider in ('supabase', 'onedrive', 'local-node')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.storage_connections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  provider text not null check (
    provider in ('supabase', 'onedrive', 'local-node')
  ),
  label text not null,
  status text not null check (
    status in ('active', 'planned', 'disabled')
  ),
  connection_ref text,
  created_at timestamptz not null default now(),
  unique (school_id, provider)
);

create table if not exists public.school_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  school_name text not null,
  grading_label text not null default '20-point scale',
  currency text not null default 'XAF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, class_name)
);

create table if not exists public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, subject_name)
);

create table if not exists public.fee_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category_name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, category_name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  class_name text not null,
  guardian_name text not null,
  guardian_relation text not null default 'Guardian',
  guardian_phone text,
  guardian_email text,
  matricule text not null,
  fee_status text not null check (
    fee_status in ('clear', 'partial', 'overdue')
  ),
  attendance_rate numeric(5,2) not null default 0,
  risk_level text not null check (
    risk_level in ('low', 'medium', 'high')
  ),
  created_at timestamptz not null default now(),
  unique (school_id, matricule)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_name text not null,
  attended_on date not null,
  status text not null check (
    status in ('present', 'late', 'absent')
  ),
  note text not null default '',
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_name text not null,
  amount_due numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  due_date date not null,
  status text not null check (
    status in ('clear', 'partial', 'overdue')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  fee_account_id uuid not null references public.fee_accounts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (
    method in ('cash', 'transfer', 'mobile-money', 'orange-money')
  ),
  receipt_number text not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.fee_reminders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  channel text not null check (
    channel in ('sms', 'app')
  ),
  message text not null,
  status text not null check (
    status in ('queued', 'sent')
  ),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_name text not null,
  driver_name text not null,
  vehicle_code text not null,
  students_assigned integer not null default 0,
  status text not null check (
    status in ('on-time', 'delayed', 'maintenance')
  ),
  next_stop text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.access_identities enable row level security;
alter table public.announcements enable row level security;
alter table public.classroom_materials enable row level security;
alter table public.storage_connections enable row level security;
alter table public.school_settings enable row level security;
alter table public.school_classes enable row level security;
alter table public.school_subjects enable row level security;
alter table public.fee_categories enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.fee_accounts enable row level security;
alter table public.fee_payments enable row level security;
alter table public.fee_reminders enable row level security;
alter table public.transport_routes enable row level security;

create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  role text not null check (
    role in ('leadership', 'teacher', 'student', 'parent', 'bursar', 'transport', 'support')
  ),
  department text not null default '',
  matricule text not null,
  email text,
  phone text,
  status text not null default 'staged' check (
    status in ('staged', 'sent', 'accepted', 'cancelled')
  ),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, matricule)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  target text not null check (
    target in ('supabase', 'onedrive', 'local-node')
  ),
  entity_type text not null,
  entity_id uuid,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'synced', 'failed')
  ),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.access_invites enable row level security;
alter table public.audit_events enable row level security;
alter table public.sync_queue enable row level security;

create or replace function public.current_profile_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = (select auth.uid())
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.current_user_can(permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_profile_role()
    when 'leadership' then true
    when 'support' then permission in (
      'overview.view',
      'transport.view',
      'communications.view',
      'operations.view',
      'operations.users.manage',
      'operations.school.configure',
      'operations.sync.manage',
      'reporting.view'
    )
    when 'bursar' then permission in (
      'overview.view',
      'finance.view',
      'finance.payments.write',
      'finance.structure.manage',
      'finance.reminders.write',
      'communications.view',
      'operations.view',
      'operations.sync.manage',
      'reporting.view'
    )
    when 'teacher' then permission in (
      'overview.view',
      'academics.view',
      'academics.attendance.write',
      'communications.view'
    )
    when 'transport' then permission in (
      'overview.view',
      'transport.view',
      'transport.status.write',
      'communications.view'
    )
    when 'student' then permission in ('overview.view', 'academics.view', 'communications.view')
    when 'parent' then permission in ('overview.view', 'academics.view', 'communications.view')
    else false
  end
$$;

revoke execute on function public.current_profile_school_id() from public;
revoke execute on function public.current_profile_role() from public;
revoke execute on function public.current_user_can(text) from public;
grant execute on function public.current_profile_school_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_user_can(text) to authenticated;

create policy "Profiles visible within same school"
on public.profiles
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
);

create policy "Announcements visible within same school"
on public.announcements
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
);

create policy "Access identities visible within same school"
on public.access_identities
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.users.manage')
);

create policy "Announcements authored within same school"
on public.announcements
for insert
with check (
  author_id = auth.uid()
  and school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Classroom materials visible within same school"
on public.classroom_materials
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Classroom materials authored within same school"
on public.classroom_materials
for insert
with check (
  owner_id = auth.uid()
  and school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Storage connections visible within same school"
on public.storage_connections
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School settings visible within same school"
on public.school_settings
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School settings insert within same school"
on public.school_settings
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School settings update within same school"
on public.school_settings
for update
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
)
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School classes visible within same school"
on public.school_classes
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School classes insert within same school"
on public.school_classes
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School classes delete within same school"
on public.school_classes
for delete
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School subjects visible within same school"
on public.school_subjects
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School subjects insert within same school"
on public.school_subjects
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "School subjects delete within same school"
on public.school_subjects
for delete
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee categories visible within same school"
on public.fee_categories
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee categories insert within same school"
on public.fee_categories
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee categories delete within same school"
on public.fee_categories
for delete
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Students visible within same school"
on public.students
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Students insert within same school"
on public.students
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Students update within same school"
on public.students
for update
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
)
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Attendance visible within same school"
on public.attendance
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Attendance insert within same school"
on public.attendance
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Attendance update within same school"
on public.attendance
for update
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
)
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee accounts visible within same school"
on public.fee_accounts
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee payments visible within same school"
on public.fee_payments
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee accounts insert within same school"
on public.fee_accounts
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee accounts update within same school"
on public.fee_accounts
for update
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
)
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee payments insert within same school"
on public.fee_payments
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee reminders visible within same school"
on public.fee_reminders
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Fee reminders insert within same school"
on public.fee_reminders
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Transport routes visible within same school"
on public.transport_routes
for select
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Transport routes insert within same school"
on public.transport_routes
for insert
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

create policy "Transport routes update within same school"
on public.transport_routes
for update
using (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
)
with check (
  school_id in (
    select school_id from public.profiles where id = auth.uid()
  )
);

drop policy if exists "Announcements authored within same school" on public.announcements;
create policy "Announcements write requires publish permission"
on public.announcements
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and school_id = public.current_profile_school_id()
  and public.current_user_can('communications.publish')
);

drop policy if exists "School settings insert within same school" on public.school_settings;
create policy "School settings insert requires configuration permission"
on public.school_settings
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "School settings update within same school" on public.school_settings;
create policy "School settings update requires configuration permission"
on public.school_settings
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

drop policy if exists "School classes insert within same school" on public.school_classes;
create policy "School classes insert requires configuration permission"
on public.school_classes
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "School classes delete within same school" on public.school_classes;
create policy "School classes delete requires configuration permission"
on public.school_classes
for delete
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "School subjects insert within same school" on public.school_subjects;
create policy "School subjects insert requires configuration permission"
on public.school_subjects
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "School subjects delete within same school" on public.school_subjects;
create policy "School subjects delete requires configuration permission"
on public.school_subjects
for delete
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.school.configure')
);

drop policy if exists "Fee categories insert within same school" on public.fee_categories;
create policy "Fee categories insert requires finance structure permission"
on public.fee_categories
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('finance.structure.manage')
    or public.current_user_can('operations.school.configure')
  )
);

drop policy if exists "Fee categories delete within same school" on public.fee_categories;
create policy "Fee categories delete requires finance structure permission"
on public.fee_categories
for delete
to authenticated
using (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('finance.structure.manage')
    or public.current_user_can('operations.school.configure')
  )
);

drop policy if exists "Attendance insert within same school" on public.attendance;
create policy "Attendance insert requires attendance permission"
on public.attendance
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('academics.attendance.write')
);

drop policy if exists "Attendance update within same school" on public.attendance;
create policy "Attendance update requires attendance permission"
on public.attendance
for update
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('academics.attendance.write')
)
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('academics.attendance.write')
);

drop policy if exists "Fee accounts insert within same school" on public.fee_accounts;
create policy "Fee accounts insert requires finance permission"
on public.fee_accounts
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.structure.manage')
);

drop policy if exists "Fee accounts update within same school" on public.fee_accounts;
create policy "Fee accounts update requires payment permission"
on public.fee_accounts
for update
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.payments.write')
)
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.payments.write')
);

drop policy if exists "Fee payments insert within same school" on public.fee_payments;
create policy "Fee payments insert requires payment permission"
on public.fee_payments
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.payments.write')
);

drop policy if exists "Fee reminders insert within same school" on public.fee_reminders;
create policy "Fee reminders insert requires reminder permission"
on public.fee_reminders
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('finance.reminders.write')
);

drop policy if exists "Transport routes insert within same school" on public.transport_routes;
create policy "Transport routes insert requires transport permission"
on public.transport_routes
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('transport.status.write')
);

drop policy if exists "Transport routes update within same school" on public.transport_routes;
create policy "Transport routes update requires transport permission"
on public.transport_routes
for update
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('transport.status.write')
)
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('transport.status.write')
);

create policy "Access invites visible to user managers"
on public.access_invites
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.users.manage')
);

create policy "Access invites staged by user managers"
on public.access_invites
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and created_by = (select auth.uid())
  and public.current_user_can('operations.users.manage')
);

create policy "Audit visible to operators"
on public.audit_events
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and (
    public.current_user_can('operations.sync.manage')
    or public.current_user_can('reporting.view')
  )
);

create policy "Sync queue visible to sync managers"
on public.sync_queue
for select
to authenticated
using (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.sync.manage')
);

create policy "Sync queue writable by sync managers"
on public.sync_queue
for insert
to authenticated
with check (
  school_id = public.current_profile_school_id()
  and public.current_user_can('operations.sync.manage')
);
