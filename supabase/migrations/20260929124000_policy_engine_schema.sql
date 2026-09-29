-- DREEM persistent policy, finding, queue, and service-eligibility schema.

create table if not exists public.dreem_policy_rules(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null,
  name text not null,
  domain text not null check(domain in('attendance','learning','finance','transport','admissions','care','communication')),
  condition jsonb not null default '{}'::jsonb,
  action_level text not null default 'review'
    check(action_level in('notify','remind','review','restrict_specific_service')),
  target_service text,
  owner_scope text not null,
  enabled boolean not null default true,
  recommended boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,code),
  check(action_level<>'restrict_specific_service' or target_service is not null)
);

create table if not exists public.dreem_policy_findings(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  rule_id uuid not null references public.dreem_policy_rules(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  fingerprint text not null,
  domain text not null,
  severity text not null check(severity in('info','warning','critical')),
  state text not null default 'open' check(state in('open','acknowledged','resolved')),
  title text not null,
  explanation text not null,
  next_action text not null,
  owner_scope text not null,
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  unique(school_id,fingerprint)
);

create table if not exists public.dreem_policy_evaluation_queue(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  reason text not null,
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,student_id)
);

create table if not exists public.dreem_service_eligibility(
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  service_code text not null
    check(service_code in('exam','report','trip','renewal','graduation','transport','boarding','library','activity','document')),
  state text not null default 'clear' check(state in('clear','warn','review','restricted')),
  reason text,
  finding_id uuid references public.dreem_policy_findings(id) on delete set null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(school_id,student_id,service_code)
);

create index if not exists dreem_policy_rules_school_enabled_idx
  on public.dreem_policy_rules(school_id,enabled);
create index if not exists dreem_policy_findings_school_state_idx
  on public.dreem_policy_findings(school_id,state,last_seen_at desc);
create index if not exists dreem_policy_findings_student_idx
  on public.dreem_policy_findings(student_id,state,last_seen_at desc);
create index if not exists dreem_policy_queue_school_queued_idx
  on public.dreem_policy_evaluation_queue(school_id,queued_at);
create index if not exists dreem_service_eligibility_student_idx
  on public.dreem_service_eligibility(student_id,state);

alter table public.dreem_policy_rules enable row level security;
alter table public.dreem_policy_findings enable row level security;
alter table public.dreem_policy_evaluation_queue enable row level security;
alter table public.dreem_service_eligibility enable row level security;

revoke all on public.dreem_policy_rules from anon,authenticated;
revoke all on public.dreem_policy_findings from anon,authenticated;
revoke all on public.dreem_policy_evaluation_queue from anon,authenticated;
revoke all on public.dreem_service_eligibility from anon,authenticated;

grant select on public.dreem_policy_rules to authenticated;
grant select on public.dreem_policy_findings to authenticated;
grant select on public.dreem_service_eligibility to authenticated;

drop policy if exists dreem_policy_rules_read on public.dreem_policy_rules;
create policy dreem_policy_rules_read
on public.dreem_policy_rules
for select to authenticated
using(private.dreem_is_member(school_id));

drop policy if exists dreem_policy_findings_read on public.dreem_policy_findings;
create policy dreem_policy_findings_read
on public.dreem_policy_findings
for select to authenticated
using(
  public.dreem_has_authority(school_id,'institutional_leadership')
  or public.dreem_has_authority(school_id,owner_scope)
  or public.dreem_has_authority(school_id,'school_configuration')
);

drop policy if exists dreem_service_eligibility_read on public.dreem_service_eligibility;
create policy dreem_service_eligibility_read
on public.dreem_service_eligibility
for select to authenticated
using(
  public.dreem_has_authority(school_id,'institutional_leadership')
  or public.dreem_has_authority(school_id,'school_configuration')
  or public.dreem_has_authority(school_id,'safeguarding')
  or private.dreem_can_view_student(school_id,student_id)
);
