create unique index if not exists fee_accounts_school_student_unique
  on public.fee_accounts(school_id, student_id)
  where student_id is not null;

create table if not exists public.dreem_fee_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid references public.dreem_academic_years(id) on delete restrict,
  class_id uuid not null references public.dreem_classes(id) on delete restrict,
  name text not null check (char_length(trim(name)) >= 3),
  currency text not null default 'XAF',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid not null,
  activated_by uuid,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreem_fee_plan_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  fee_plan_id uuid not null references public.dreem_fee_plans(id) on delete cascade,
  code text not null,
  label text not null check (char_length(trim(label)) >= 2),
  amount numeric not null check (amount > 0),
  due_on date,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(fee_plan_id, code)
);

create table if not exists public.dreem_student_fee_charges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_account_id uuid not null references public.fee_accounts(id) on delete cascade,
  fee_plan_id uuid not null references public.dreem_fee_plans(id) on delete restrict,
  fee_plan_item_id uuid not null references public.dreem_fee_plan_items(id) on delete restrict,
  amount numeric not null check (amount > 0),
  waived_amount numeric not null default 0 check (waived_amount >= 0 and waived_amount <= amount),
  status text not null default 'due' check (status in ('due','partially_paid','paid','waived','written_off')),
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, student_id, fee_plan_item_id)
);

create index if not exists dreem_fee_plans_school_class_idx on public.dreem_fee_plans(school_id,class_id,status);
create index if not exists dreem_fee_plan_items_plan_idx on public.dreem_fee_plan_items(fee_plan_id);
create index if not exists dreem_student_fee_charges_student_idx on public.dreem_student_fee_charges(school_id,student_id,status);
create index if not exists dreem_student_fee_charges_account_idx on public.dreem_student_fee_charges(fee_account_id);

alter table public.dreem_fee_plans enable row level security;
alter table public.dreem_fee_plan_items enable row level security;
alter table public.dreem_student_fee_charges enable row level security;

drop policy if exists dreem_fee_plans_read on public.dreem_fee_plans;
create policy dreem_fee_plans_read on public.dreem_fee_plans for select to authenticated
using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','accountant','bursar','auditor']));

drop policy if exists dreem_fee_plan_items_read on public.dreem_fee_plan_items;
create policy dreem_fee_plan_items_read on public.dreem_fee_plan_items for select to authenticated
using (private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','accountant','bursar','auditor']));

drop policy if exists dreem_student_fee_charges_read on public.dreem_student_fee_charges;
create policy dreem_student_fee_charges_read on public.dreem_student_fee_charges for select to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','accountant','bursar','auditor'])
  or private.dreem_is_family_of_student(school_id,student_id)
);

revoke insert,update,delete on public.dreem_fee_plans,public.dreem_fee_plan_items,public.dreem_student_fee_charges from anon,authenticated;
grant select on public.dreem_fee_plans,public.dreem_fee_plan_items,public.dreem_student_fee_charges to authenticated;

create or replace function private.dreem_apply_fee_plan_to_account(p_fee_account_id uuid, p_fee_plan_id uuid)
returns numeric
language plpgsql
security definer
set search_path=''
as $$
declare
  v_account public.fee_accounts%rowtype;
  v_plan public.dreem_fee_plans%rowtype;
  v_inserted numeric := 0;
begin
  select * into v_account from public.fee_accounts where id=p_fee_account_id for update;
  select * into v_plan from public.dreem_fee_plans where id=p_fee_plan_id and status='active';
  if v_account.id is null or v_plan.id is null or v_account.school_id<>v_plan.school_id then return 0; end if;

  with inserted as (
    insert into public.dreem_student_fee_charges(
      school_id,student_id,fee_account_id,fee_plan_id,fee_plan_item_id,amount,due_on
    )
    select v_account.school_id,v_account.student_id,v_account.id,v_plan.id,i.id,i.amount,i.due_on
    from public.dreem_fee_plan_items i
    where i.fee_plan_id=v_plan.id and i.school_id=v_plan.school_id
    on conflict (school_id,student_id,fee_plan_item_id) do nothing
    returning amount
  ) select coalesce(sum(amount),0) into v_inserted from inserted;

  if v_inserted>0 then
    update public.fee_accounts
      set amount_due=amount_due+v_inserted,
          balance_due=balance_due+v_inserted,
          status=case when amount_paid+v_inserted>=amount_due+v_inserted and balance_due+v_inserted=0 then 'clear'
                      when amount_paid>0 then 'partial' else 'open' end,
          updated_at=now()
    where id=v_account.id;
  end if;
  return v_inserted;
end;
$$;
revoke all on function private.dreem_apply_fee_plan_to_account(uuid,uuid) from public;

create or replace function private.dreem_seed_fee_account_from_active_plan()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_plan_id uuid;
begin
  if new.student_id is null then return new; end if;
  select p.id into v_plan_id
  from public.students s
  join public.dreem_classes c on c.school_id=s.school_id and lower(c.name)=lower(coalesce(s.class_name,''))
  join public.dreem_fee_plans p on p.school_id=s.school_id and p.class_id=c.id and p.status='active'
  where s.id=new.student_id and s.school_id=new.school_id
  order by p.activated_at desc nulls last,p.created_at desc
  limit 1;
  if v_plan_id is not null then perform private.dreem_apply_fee_plan_to_account(new.id,v_plan_id); end if;
  return new;
end;
$$;

drop trigger if exists dreem_seed_fee_account_from_active_plan on public.fee_accounts;
create trigger dreem_seed_fee_account_from_active_plan
after insert on public.fee_accounts
for each row execute function private.dreem_seed_fee_account_from_active_plan();

create or replace function public.dreem_create_fee_plan(
  p_academic_year_id uuid,
  p_class_id uuid,
  p_name text,
  p_currency text,
  p_items jsonb,
  p_idempotency_key text
)
returns table(plan_id uuid,plan_status text,total_amount numeric)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_school_id uuid;
  v_plan_id uuid;
  v_total numeric;
  v_item jsonb;
begin
  select c.school_id into v_school_id from public.dreem_classes c where c.id=p_class_id;
  if v_actor is null or v_school_id is null or not private.dreem_has_role(v_school_id,array['platform_founder','school_owner','principal']) then
    raise exception 'Only school leadership may create fee plans.';
  end if;
  if p_academic_year_id is not null and not exists(select 1 from public.dreem_academic_years y where y.id=p_academic_year_id and y.school_id=v_school_id) then
    raise exception 'Academic year does not belong to this school.';
  end if;
  if char_length(trim(coalesce(p_name,'')))<3 then raise exception 'Fee plan name is required.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one fee item.'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'Idempotency key is required.'; end if;

  select e.aggregate_id into v_plan_id from public.dreem_domain_events e
   where e.school_id=v_school_id and e.idempotency_key='fee-plan.created:'||p_idempotency_key limit 1;
  if v_plan_id is not null then
    select coalesce(sum(i.amount),0) into v_total from public.dreem_fee_plan_items i where i.fee_plan_id=v_plan_id;
    plan_id:=v_plan_id; plan_status:='draft'; total_amount:=v_total; return next; return;
  end if;

  insert into public.dreem_fee_plans(school_id,academic_year_id,class_id,name,currency,created_by)
  values(v_school_id,p_academic_year_id,p_class_id,trim(p_name),upper(coalesce(nullif(trim(p_currency),''),'XAF')),v_actor)
  returning id into v_plan_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if char_length(trim(coalesce(v_item->>'code','')))<1 or char_length(trim(coalesce(v_item->>'label','')))<2 or coalesce((v_item->>'amount')::numeric,0)<=0 then
      raise exception 'Every fee item needs a code, label and positive amount.';
    end if;
    insert into public.dreem_fee_plan_items(school_id,fee_plan_id,code,label,amount,due_on,required)
    values(v_school_id,v_plan_id,upper(trim(v_item->>'code')),trim(v_item->>'label'),(v_item->>'amount')::numeric,nullif(v_item->>'due_on','')::date,coalesce((v_item->>'required')::boolean,true));
  end loop;
  select sum(amount) into v_total from public.dreem_fee_plan_items where fee_plan_id=v_plan_id;
  perform private.dreem_write_event(v_school_id,'fee_plan',v_plan_id,'fee_plan.created','fee-plan.created:'||p_idempotency_key,jsonb_build_object('class_id',p_class_id,'total',v_total));
  plan_id:=v_plan_id; plan_status:='draft'; total_amount:=v_total; return next;
end;
$$;

create or replace function public.dreem_activate_fee_plan(p_plan_id uuid,p_idempotency_key text)
returns table(plan_id uuid,plan_status text,learners_charged integer,total_charged numeric)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_plan public.dreem_fee_plans%rowtype;
  v_count integer:=0;
  v_total numeric:=0;
  v_added numeric;
  v_account record;
begin
  select * into v_plan from public.dreem_fee_plans where id=p_plan_id for update;
  if v_actor is null or v_plan.id is null or not private.dreem_has_role(v_plan.school_id,array['platform_founder','school_owner','principal']) then
    raise exception 'Only school leadership may activate fee plans.';
  end if;
  if not exists(select 1 from public.dreem_fee_plan_items where fee_plan_id=v_plan.id) then raise exception 'A fee plan needs at least one item.'; end if;
  if v_plan.status='active' then
    plan_id:=v_plan.id;plan_status:='active';learners_charged:=0;total_charged:=0;return next;return;
  end if;
  update public.dreem_fee_plans set status='archived',updated_at=now()
   where school_id=v_plan.school_id and class_id=v_plan.class_id and id<>v_plan.id and status='active'
     and academic_year_id is not distinct from v_plan.academic_year_id;
  update public.dreem_fee_plans set status='active',activated_by=v_actor,activated_at=now(),updated_at=now() where id=v_plan.id;

  for v_account in
    select f.id from public.fee_accounts f
    join public.students s on s.id=f.student_id and s.school_id=f.school_id
    join public.dreem_classes c on c.school_id=s.school_id and lower(c.name)=lower(coalesce(s.class_name,''))
    where f.school_id=v_plan.school_id and c.id=v_plan.class_id
  loop
    v_added:=private.dreem_apply_fee_plan_to_account(v_account.id,v_plan.id);
    if v_added>0 then v_count:=v_count+1;v_total:=v_total+v_added;end if;
  end loop;
  perform private.dreem_write_event(v_plan.school_id,'fee_plan',v_plan.id,'fee_plan.activated','fee-plan.activated:'||p_idempotency_key,jsonb_build_object('learners_charged',v_count,'total_charged',v_total));
  plan_id:=v_plan.id;plan_status:='active';learners_charged:=v_count;total_charged:=v_total;return next;
end;
$$;

revoke all on function public.dreem_create_fee_plan(uuid,uuid,text,text,jsonb,text) from public,anon;
revoke all on function public.dreem_activate_fee_plan(uuid,text) from public,anon;
grant execute on function public.dreem_create_fee_plan(uuid,uuid,text,text,jsonb,text) to authenticated;
grant execute on function public.dreem_activate_fee_plan(uuid,text) to authenticated;
