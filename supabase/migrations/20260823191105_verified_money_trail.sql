-- DREEM-FINANCE-001: provider-neutral payment identity, custody, confirmation,
-- settlement and reconciliation controls.

-- Earlier policies use capability aliases. Expand those aliases to the concrete
-- DREEM membership roles so founder, leadership and operations permissions work.
create or replace function private.dreem_has_role(p_school_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
        from public.dreem_school_memberships m
       where m.school_id = p_school_id
         and m.profile_id = (select auth.uid())
         and m.status = 'approved'
         and (
           m.role = any(p_roles)
           or ('leadership' = any(p_roles) and m.role in ('platform_founder','school_owner','principal'))
           or ('support' = any(p_roles) and m.role in ('administrator','academic_head','accountant'))
         )
    );
$$;

revoke all on function private.dreem_has_role(uuid,text[]) from public, anon;
grant execute on function private.dreem_has_role(uuid,text[]) to authenticated;

alter table public.fee_accounts add column if not exists amount_paid numeric(14,2) not null default 0;
alter table public.fee_accounts add column if not exists balance_due numeric(14,2) not null default 0;
alter table public.fee_accounts drop constraint if exists fee_accounts_status_check;
alter table public.fee_accounts add constraint fee_accounts_status_check
  check (status in ('open','partial','clear','overdue','waived','written_off'));
alter table public.fee_accounts drop constraint if exists fee_accounts_amounts_valid;
alter table public.fee_accounts add constraint fee_accounts_amounts_valid
  check (amount_due >= 0 and amount_paid >= 0 and balance_due >= 0 and amount_paid <= amount_due);

update public.fee_accounts
   set balance_due = greatest(amount_due - amount_paid, 0),
       status = case
         when amount_due - amount_paid <= 0 then 'clear'
         when amount_paid > 0 then 'partial'
         else 'open'
       end;

create table if not exists public.dreem_payment_rails (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  rail_code text not null check (rail_code in ('cash','wave','mtn_momo','orange_money','bank','card','cheque','other')),
  display_name text not null,
  rail_type text not null check (rail_type in ('cash','mobile_money','bank','card','cheque','other')),
  merchant_reference text,
  enabled boolean not null default false,
  priority integer not null default 100 check (priority >= 0),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, rail_code)
);

create table if not exists public.dreem_payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id),
  fee_account_id uuid not null references public.fee_accounts(id),
  payment_reference text not null,
  amount_expected numeric(14,2) not null check (amount_expected > 0),
  payer_name text not null,
  payer_phone text,
  allowed_rails text[] not null default array['cash','wave','mtn_momo','orange_money','bank']::text[],
  idempotency_key text not null,
  status text not null default 'open' check (status in ('open','partially_paid','paid','expired','cancelled')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, payment_reference),
  unique (school_id, idempotency_key)
);

alter table public.dreem_financial_payments
  add column if not exists payment_intent_id uuid references public.dreem_payment_intents(id),
  add column if not exists rail_code text,
  add column if not exists payer_phone text;
alter table public.dreem_financial_payments drop constraint if exists dreem_financial_payments_rail_code_check;
alter table public.dreem_financial_payments add constraint dreem_financial_payments_rail_code_check
  check (rail_code is null or rail_code in ('cash','wave','mtn_momo','orange_money','bank','card','cheque','other'));

create table if not exists public.dreem_payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null references public.dreem_financial_payments(id),
  confirmation_token uuid not null default gen_random_uuid(),
  delivery_channel text not null check (delivery_channel in ('sms','whatsapp','email','app','print')),
  destination_hint text not null,
  delivery_status text not null default 'queued' check (delivery_status in ('queued','sent','delivered','failed')),
  acknowledgement_status text not null default 'pending' check (acknowledgement_status in ('pending','confirmed','disputed')),
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_id),
  unique (confirmation_token)
);

create table if not exists public.dreem_cash_deposit_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  batch_reference text not null,
  amount numeric(14,2) not null check (amount > 0),
  destination_rail_id uuid references public.dreem_payment_rails(id),
  deposit_reference text not null,
  status text not null default 'submitted' check (status in ('submitted','confirmed','rejected')),
  evidence jsonb not null default '{}'::jsonb,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  unique (school_id, batch_reference),
  unique (school_id, deposit_reference),
  check (reviewed_by is null or reviewed_by <> submitted_by),
  check (status = 'submitted' or (reviewed_by is not null and reviewed_at is not null))
);

create table if not exists public.dreem_cash_deposit_items (
  batch_id uuid not null references public.dreem_cash_deposit_batches(id),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null references public.dreem_financial_payments(id),
  amount numeric(14,2) not null check (amount > 0),
  primary key (batch_id, payment_id),
  unique (payment_id)
);

create index if not exists dreem_payment_intents_student_status_idx
  on public.dreem_payment_intents(school_id, student_id, status, created_at desc);
create index if not exists dreem_confirmations_status_idx
  on public.dreem_payment_confirmations(school_id, acknowledgement_status, created_at desc);
create index if not exists dreem_cash_batches_status_idx
  on public.dreem_cash_deposit_batches(school_id, status, submitted_at desc);
create index if not exists dreem_cash_items_school_idx
  on public.dreem_cash_deposit_items(school_id, payment_id);
create index if not exists dreem_payments_intent_idx
  on public.dreem_financial_payments(payment_intent_id);

alter table public.dreem_payment_rails enable row level security;
alter table public.dreem_payment_intents enable row level security;
alter table public.dreem_payment_confirmations enable row level security;
alter table public.dreem_cash_deposit_batches enable row level security;
alter table public.dreem_cash_deposit_items enable row level security;

create policy dreem_payment_rails_read on public.dreem_payment_rails
for select to authenticated using ((select private.dreem_is_member(school_id)));
create policy dreem_payment_rails_manage on public.dreem_payment_rails
for all to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','accountant'])))
with check ((select private.dreem_has_role(school_id,array['leadership','accountant'])));

create policy dreem_payment_intents_read on public.dreem_payment_intents
for select to authenticated
using ((select private.dreem_can_view_student(school_id,student_id)) or (select private.dreem_has_role(school_id,array['bursar','accountant','auditor'])));
create policy dreem_payment_confirmations_read on public.dreem_payment_confirmations
for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','bursar','accountant','auditor'])));
create policy dreem_cash_batches_read on public.dreem_cash_deposit_batches
for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','bursar','accountant','auditor'])));
create policy dreem_cash_items_read on public.dreem_cash_deposit_items
for select to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','bursar','accountant','auditor'])));

revoke all on public.dreem_payment_rails, public.dreem_payment_intents,
  public.dreem_payment_confirmations, public.dreem_cash_deposit_batches,
  public.dreem_cash_deposit_items from anon, authenticated;
grant select on public.dreem_payment_rails, public.dreem_payment_intents,
  public.dreem_payment_confirmations, public.dreem_cash_deposit_batches,
  public.dreem_cash_deposit_items to authenticated;
grant insert, update on public.dreem_payment_rails to authenticated;

-- Financial state transitions are command-only. In particular, a cashier must
-- not be able to mark their own session approved through a direct table update.
drop policy if exists dreem_cashier_update on public.dreem_cashier_sessions;
drop policy if exists dreem_reconciliation_submit on public.dreem_reconciliation_reviews;
drop policy if exists dreem_reconciliation_review on public.dreem_reconciliation_reviews;
revoke update, delete on public.dreem_cashier_sessions from authenticated;
revoke insert, update, delete on public.dreem_reconciliation_reviews from authenticated;
revoke execute on function public.dreem_record_payment(uuid,uuid,uuid,text,numeric,text,text,text) from authenticated;

create or replace function private.dreem_seed_payment_rails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dreem_payment_rails(school_id,rail_code,display_name,rail_type,enabled,priority)
  values
    (new.id,'cash','Cash desk','cash',true,50),
    (new.id,'wave','Wave','mobile_money',false,10),
    (new.id,'mtn_momo','MTN MoMo','mobile_money',false,20),
    (new.id,'orange_money','Orange Money','mobile_money',false,30),
    (new.id,'bank','Bank / merchant account','bank',false,40)
  on conflict (school_id,rail_code) do nothing;
  return new;
end;
$$;

drop trigger if exists dreem_seed_payment_rails on public.schools;
create trigger dreem_seed_payment_rails
after insert on public.schools
for each row execute function private.dreem_seed_payment_rails();

insert into public.dreem_payment_rails(school_id,rail_code,display_name,rail_type,enabled,priority)
select s.id, r.rail_code, r.display_name, r.rail_type, r.enabled, r.priority
from public.schools s
cross join (values
  ('cash','Cash desk','cash',true,50),
  ('wave','Wave','mobile_money',false,10),
  ('mtn_momo','MTN MoMo','mobile_money',false,20),
  ('orange_money','Orange Money','mobile_money',false,30),
  ('bank','Bank / merchant account','bank',false,40)
) as r(rail_code,display_name,rail_type,enabled,priority)
on conflict (school_id,rail_code) do nothing;

create or replace function public.dreem_create_payment_intent(
  p_student_id uuid,
  p_fee_account_id uuid,
  p_amount_expected numeric,
  p_payer_name text,
  p_payer_phone text,
  p_allowed_rails text[],
  p_idempotency_key text
) returns table(intent_id uuid, payment_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_balance numeric(14,2);
  v_prefix text;
  v_intent_id uuid;
  v_reference text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication is required.'; end if;
  if p_amount_expected is null or p_amount_expected <= 0 then raise exception 'Expected amount must be positive.'; end if;
  if nullif(trim(p_payer_name),'') is null then raise exception 'Payer name is required.'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.'; end if;

  select f.school_id, f.balance_due
    into v_school_id, v_balance
    from public.fee_accounts f
   where f.id = p_fee_account_id and f.student_id = p_student_id
   for update;

  if v_school_id is null or not private.dreem_has_role(v_school_id,array['bursar','accountant','leadership']) then
    raise exception 'No authorized finance membership for this fee account.';
  end if;
  if p_amount_expected > v_balance then raise exception 'Payment intent exceeds the current fee balance.'; end if;

  select i.id, i.payment_reference into v_intent_id, v_reference
    from public.dreem_payment_intents i
   where i.school_id = v_school_id
     and i.idempotency_key = p_idempotency_key;
  if found then
    intent_id := v_intent_id; payment_reference := v_reference; return next; return;
  end if;

  select coalesce(b.receipt_prefix,'DRM') into v_prefix
    from public.dreem_school_brands b where b.school_id = v_school_id;
  v_reference := concat(coalesce(v_prefix,'DRM'), '-PAY-', upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));

  insert into public.dreem_payment_intents(
    school_id,student_id,fee_account_id,payment_reference,amount_expected,
    payer_name,payer_phone,allowed_rails,idempotency_key,created_by
  ) values (
    v_school_id,p_student_id,p_fee_account_id,v_reference,p_amount_expected,
    trim(p_payer_name),nullif(trim(p_payer_phone),''),coalesce(p_allowed_rails,array['cash']::text[]),p_idempotency_key,(select auth.uid())
  ) returning id into v_intent_id;

  insert into public.dreem_domain_events(school_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload)
  values(v_school_id,'payment_intent',v_intent_id,'payment.intent_created',concat('payment.intent:',p_idempotency_key),
    jsonb_build_object('intent_id',v_intent_id,'student_id',p_student_id,'payment_reference',v_reference,'amount_expected',p_amount_expected));

  intent_id := v_intent_id; payment_reference := v_reference; return next;
end;
$$;

create or replace function public.dreem_record_verified_payment(
  p_payment_intent_id uuid,
  p_cashier_session_id uuid,
  p_method text,
  p_rail_code text,
  p_amount numeric,
  p_external_reference text,
  p_idempotency_key text
) returns table(payment_id uuid, receipt_number text, confirmation_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_intent public.dreem_payment_intents%rowtype;
  v_existing public.dreem_financial_payments%rowtype;
  v_payment_id uuid;
  v_receipt_number text;
  v_confirmation_token uuid;
  v_balance numeric(14,2);
  v_total_paid numeric(14,2);
  v_confirmation_channel text;
begin
  if v_actor_id is null then raise exception 'Authentication is required.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive.'; end if;
  if p_method not in ('cash','momo','bank_transfer','card','cheque') then raise exception 'Unsupported payment method.'; end if;
  if nullif(trim(p_rail_code),'') is null then raise exception 'A payment rail is required.'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'An idempotency key is required.'; end if;

  select * into v_intent from public.dreem_payment_intents i where i.id = p_payment_intent_id for update;
  if not found or v_intent.status not in ('open','partially_paid') then raise exception 'Payment reference is not open.'; end if;
  if not private.dreem_has_role(v_intent.school_id,array['bursar']) then raise exception 'No authorized DREEM bursar membership.'; end if;
  if not (p_rail_code = any(v_intent.allowed_rails)) then raise exception 'Payment rail is not allowed for this reference.'; end if;

  if p_method = 'cash' then
    if p_rail_code <> 'cash' or p_cashier_session_id is null then raise exception 'Cash requires the cash rail and an open cashier session.'; end if;
    if not exists(select 1 from public.dreem_cashier_sessions c where c.id=p_cashier_session_id and c.school_id=v_intent.school_id and c.cashier_user_id=v_actor_id and c.status='open') then
      raise exception 'Cashier session is not open for this cashier.';
    end if;
  else
    if nullif(trim(p_external_reference),'') is null then raise exception 'Digital and bank payments require a provider reference.'; end if;
    if not exists(select 1 from public.dreem_payment_rails r where r.school_id=v_intent.school_id and r.rail_code=p_rail_code and r.enabled) then
      raise exception 'The selected payment rail is not enabled for this school.';
    end if;
  end if;

  select * into v_existing from public.dreem_financial_payments p
   where p.school_id=v_intent.school_id and p.idempotency_key=p_idempotency_key;
  if found then
    select c.confirmation_token into v_confirmation_token from public.dreem_payment_confirmations c where c.payment_id=v_existing.id;
    payment_id:=v_existing.id; receipt_number:=v_existing.receipt_number; confirmation_token:=v_confirmation_token; return next; return;
  end if;

  select f.balance_due into v_balance from public.fee_accounts f where f.id=v_intent.fee_account_id for update;
  if p_amount > v_balance or p_amount > v_intent.amount_expected then raise exception 'Payment exceeds the open amount.'; end if;

  select concat(coalesce(b.receipt_prefix,'DRM'),'-',to_char(now(),'YYYYMMDD'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
    into v_receipt_number from public.dreem_school_brands b where b.school_id=v_intent.school_id;

  insert into public.dreem_financial_payments(
    school_id,student_id,fee_account_id,cashier_session_id,receipt_number,method,amount,
    external_reference,idempotency_key,payer_name,received_by,payment_intent_id,rail_code,payer_phone
  ) values (
    v_intent.school_id,v_intent.student_id,v_intent.fee_account_id,p_cashier_session_id,v_receipt_number,p_method,p_amount,
    nullif(trim(p_external_reference),''),p_idempotency_key,v_intent.payer_name,v_actor_id,v_intent.id,p_rail_code,v_intent.payer_phone
  ) returning id into v_payment_id;

  update public.fee_accounts
     set amount_paid=amount_paid+p_amount,
         balance_due=balance_due-p_amount,
         status=case when balance_due-p_amount=0 then 'clear' else 'partial' end,
         updated_at=now()
   where id=v_intent.fee_account_id;

  select coalesce(sum(p.amount),0) into v_total_paid
    from public.dreem_financial_payments p where p.payment_intent_id=v_intent.id and p.reverses_payment_id is null;
  update public.dreem_payment_intents
     set status=case when v_total_paid >= amount_expected then 'paid' else 'partially_paid' end, updated_at=now()
   where id=v_intent.id;

  insert into public.dreem_payment_events(school_id,payment_id,event_type,actor_user_id,note,evidence)
  values(v_intent.school_id,v_payment_id,'recorded',v_actor_id,'Payment recorded through DREEM Verified Money Trail',
    jsonb_build_object('rail_code',p_rail_code,'method',p_method,'amount',p_amount,'external_reference',p_external_reference));
  if p_method <> 'cash' then
    insert into public.dreem_payment_events(school_id,payment_id,event_type,actor_user_id,note,evidence)
    values(v_intent.school_id,v_payment_id,'confirmed',v_actor_id,'Provider reference captured',jsonb_build_object('rail_code',p_rail_code,'external_reference',p_external_reference));
  end if;

  v_confirmation_channel := case when nullif(trim(v_intent.payer_phone),'') is null then 'print' else 'sms' end;
  insert into public.dreem_payment_confirmations(school_id,payment_id,delivery_channel,destination_hint)
  values(v_intent.school_id,v_payment_id,v_confirmation_channel,
    case when v_confirmation_channel='print' then 'receipt' else concat('***',right(v_intent.payer_phone,4)) end)
  returning dreem_payment_confirmations.confirmation_token into v_confirmation_token;

  insert into public.dreem_domain_events(school_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload)
  values(v_intent.school_id,'payment',v_payment_id,'payment.recorded',concat('payment.verified:',p_idempotency_key),
    jsonb_build_object('payment_id',v_payment_id,'student_id',v_intent.student_id,'receipt_number',v_receipt_number,
      'payment_reference',v_intent.payment_reference,'amount',p_amount,'rail_code',p_rail_code,
      'payer_phone',v_intent.payer_phone,'confirmation_token',v_confirmation_token));

  payment_id:=v_payment_id; receipt_number:=v_receipt_number; confirmation_token:=v_confirmation_token; return next;
end;
$$;

create or replace function public.dreem_submit_cashier_session(
  p_cashier_session_id uuid,
  p_declared_cash numeric,
  p_explanation text,
  p_evidence jsonb
) returns table(review_id uuid, expected_cash numeric, variance numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.dreem_cashier_sessions%rowtype;
  v_expected numeric(14,2);
  v_review_id uuid;
begin
  select * into v_session from public.dreem_cashier_sessions c where c.id=p_cashier_session_id for update;
  if not found or v_session.cashier_user_id<>(select auth.uid()) or v_session.status<>'open' then raise exception 'Open cashier session not found.'; end if;
  if p_declared_cash is null or p_declared_cash<0 then raise exception 'Declared cash cannot be negative.'; end if;
  select v_session.opening_float+coalesce(sum(p.amount),0) into v_expected from public.dreem_financial_payments p
   where p.cashier_session_id=v_session.id and p.reverses_payment_id is null;
  update public.dreem_cashier_sessions set declared_cash=p_declared_cash,expected_cash=v_expected,status='submitted',closed_at=now() where id=v_session.id;
  insert into public.dreem_reconciliation_reviews(school_id,cashier_session_id,submitted_by,variance,explanation,evidence)
  values(v_session.school_id,v_session.id,(select auth.uid()),p_declared_cash-v_expected,nullif(trim(p_explanation),''),coalesce(p_evidence,'{}'::jsonb))
  returning id into v_review_id;
  review_id:=v_review_id; expected_cash:=v_expected; variance:=p_declared_cash-v_expected; return next;
end;
$$;

create or replace function public.dreem_review_cashier_session(
  p_review_id uuid,
  p_approved boolean,
  p_note text,
  p_evidence jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_review public.dreem_reconciliation_reviews%rowtype;
begin
  select * into v_review from public.dreem_reconciliation_reviews r where r.id=p_review_id for update;
  if not found or v_review.status<>'pending' then raise exception 'Pending reconciliation review not found.'; end if;
  if v_review.submitted_by=(select auth.uid()) then raise exception 'A cashier cannot approve their own closure.'; end if;
  if not private.dreem_has_role(v_review.school_id,array['accountant','leadership']) then raise exception 'Independent accountant or leadership review is required.'; end if;
  update public.dreem_reconciliation_reviews set status=case when p_approved then 'approved' else 'rejected' end,
    reviewed_by=(select auth.uid()),reviewed_at=now(),explanation=concat_ws(E'\n',explanation,nullif(trim(p_note),'')),evidence=evidence||coalesce(p_evidence,'{}'::jsonb)
  where id=p_review_id;
  update public.dreem_cashier_sessions set status=case when p_approved then 'approved' else 'rejected' end where id=v_review.cashier_session_id;
  return case when p_approved then 'approved' else 'rejected' end;
end;
$$;

create or replace function public.dreem_create_cash_deposit_batch(
  p_payment_ids uuid[],
  p_destination_rail_id uuid,
  p_deposit_reference text,
  p_evidence jsonb
) returns table(batch_id uuid, batch_reference text, amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare v_school_id uuid; v_school_count integer; v_amount numeric(14,2); v_count integer; v_batch_id uuid; v_batch_reference text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication is required.'; end if;
  if coalesce(array_length(p_payment_ids,1),0)=0 then raise exception 'Select at least one cash payment.'; end if;
  if nullif(trim(p_deposit_reference),'') is null then raise exception 'Deposit reference is required.'; end if;
  select min(p.school_id),count(distinct p.school_id),sum(p.amount),count(*) into v_school_id,v_school_count,v_amount,v_count
    from public.dreem_financial_payments p
    join public.dreem_cashier_sessions c on c.id=p.cashier_session_id and c.status='approved'
   where p.id=any(p_payment_ids) and p.method='cash' and p.reverses_payment_id is null
     and p.received_by=(select auth.uid())
     and not exists(select 1 from public.dreem_cash_deposit_items i where i.payment_id=p.id);
  if v_count<>array_length(p_payment_ids,1) or v_school_count<>1 then raise exception 'Every payment must be the cashier''s approved, unsettled cash collection from one school.'; end if;
  if not private.dreem_has_role(v_school_id,array['bursar']) then raise exception 'Authorized bursar membership required.'; end if;
  if not exists(select 1 from public.dreem_payment_rails r where r.id=p_destination_rail_id and r.school_id=v_school_id and r.rail_type in ('mobile_money','bank') and r.enabled) then
    raise exception 'Enabled institutional settlement rail required.';
  end if;
  v_batch_reference:=concat('DEP-',to_char(now(),'YYYYMMDD'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  insert into public.dreem_cash_deposit_batches(school_id,batch_reference,amount,destination_rail_id,deposit_reference,evidence,submitted_by)
  values(v_school_id,v_batch_reference,v_amount,p_destination_rail_id,trim(p_deposit_reference),coalesce(p_evidence,'{}'::jsonb),(select auth.uid())) returning id into v_batch_id;
  insert into public.dreem_cash_deposit_items(batch_id,school_id,payment_id,amount)
  select v_batch_id,v_school_id,p.id,p.amount from public.dreem_financial_payments p where p.id=any(p_payment_ids);
  batch_id:=v_batch_id; batch_reference:=v_batch_reference; amount:=v_amount; return next;
end;
$$;

create or replace function public.dreem_review_cash_deposit_batch(p_batch_id uuid,p_approved boolean,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare v_batch public.dreem_cash_deposit_batches%rowtype;
begin
  select * into v_batch from public.dreem_cash_deposit_batches b where b.id=p_batch_id for update;
  if not found or v_batch.status<>'submitted' then raise exception 'Submitted deposit batch not found.'; end if;
  if v_batch.submitted_by=(select auth.uid()) then raise exception 'Depositor cannot confirm their own batch.'; end if;
  if not private.dreem_has_role(v_batch.school_id,array['accountant','leadership']) then raise exception 'Independent settlement review is required.'; end if;
  update public.dreem_cash_deposit_batches set status=case when p_approved then 'confirmed' else 'rejected' end,
    reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=p_batch_id;
  if p_approved then
    insert into public.dreem_payment_events(school_id,payment_id,event_type,actor_user_id,note,evidence)
    select v_batch.school_id,i.payment_id,'reconciled',(select auth.uid()),'Cash deposited and independently confirmed',
      jsonb_build_object('batch_id',v_batch.id,'batch_reference',v_batch.batch_reference,'deposit_reference',v_batch.deposit_reference)
    from public.dreem_cash_deposit_items i where i.batch_id=v_batch.id;
  end if;
  return case when p_approved then 'confirmed' else 'rejected' end;
end;
$$;

create or replace function public.dreem_acknowledge_payment(p_confirmation_token uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_confirmation public.dreem_payment_confirmations%rowtype;
begin
  if p_action not in ('confirmed','disputed') then return false; end if;
  select * into v_confirmation from public.dreem_payment_confirmations c where c.confirmation_token=p_confirmation_token for update;
  if not found or v_confirmation.acknowledgement_status<>'pending' then return false; end if;
  update public.dreem_payment_confirmations set acknowledgement_status=p_action,acknowledged_at=now() where id=v_confirmation.id;
  insert into public.dreem_domain_events(school_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload)
  values(v_confirmation.school_id,'payment',v_confirmation.payment_id,concat('payment.',p_action),concat('payment.ack:',v_confirmation.id),
    jsonb_build_object('payment_id',v_confirmation.payment_id,'action',p_action));
  return true;
end;
$$;

revoke all on function public.dreem_create_payment_intent(uuid,uuid,numeric,text,text,text[],text) from public, anon;
revoke all on function public.dreem_record_verified_payment(uuid,uuid,text,text,numeric,text,text) from public, anon;
revoke all on function public.dreem_submit_cashier_session(uuid,numeric,text,jsonb) from public, anon;
revoke all on function public.dreem_review_cashier_session(uuid,boolean,text,jsonb) from public, anon;
revoke all on function public.dreem_create_cash_deposit_batch(uuid[],uuid,text,jsonb) from public, anon;
revoke all on function public.dreem_review_cash_deposit_batch(uuid,boolean,text) from public, anon;
revoke all on function public.dreem_acknowledge_payment(uuid,text) from public;

grant execute on function public.dreem_create_payment_intent(uuid,uuid,numeric,text,text,text[],text) to authenticated;
grant execute on function public.dreem_record_verified_payment(uuid,uuid,text,text,numeric,text,text) to authenticated;
grant execute on function public.dreem_submit_cashier_session(uuid,numeric,text,jsonb) to authenticated;
grant execute on function public.dreem_review_cashier_session(uuid,boolean,text,jsonb) to authenticated;
grant execute on function public.dreem_create_cash_deposit_batch(uuid[],uuid,text,jsonb) to authenticated;
grant execute on function public.dreem_review_cash_deposit_batch(uuid,boolean,text) to authenticated;
grant execute on function public.dreem_acknowledge_payment(uuid,text) to anon, authenticated;
