-- Mirrors live migration 20260910121252. Finance adjustments, auditable concessions and reversal-aware allocations.
create table if not exists public.dreem_fee_adjustments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 fee_charge_id uuid not null references public.dreem_student_fee_charges(id) on delete restrict,
 adjustment_type text not null check (adjustment_type in ('scholarship','sibling_discount','concession','waiver','credit')),
 amount numeric(14,2) not null check (amount > 0), reason text not null,
 status text not null default 'approved' check (status in ('approved','reversed')),
 created_by uuid not null, created_at timestamptz not null default now(), reversed_by uuid, reversed_at timestamptz,
 idempotency_key text not null, unique(school_id,idempotency_key)
);
alter table public.dreem_fee_adjustments enable row level security;
create policy "finance adjustments readable by finance leadership audit and family" on public.dreem_fee_adjustments for select to authenticated using (
 private.dreem_has_role(school_id,array['leadership','bursar','accountant','auditor']) or
 exists(select 1 from public.students s where s.id=student_id and s.school_id=school_id and ((select auth.uid())=s.profile_id or (select auth.uid())=any(coalesce(s.parent_user_ids,array[]::uuid[]))))
);
revoke insert,update,delete on public.dreem_fee_adjustments from authenticated;
-- Command and reversal trigger are defined by the follow-up correction migration so account totals use adjusted charges and unreversed payments.
