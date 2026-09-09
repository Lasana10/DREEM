create table if not exists public.dreem_payment_allocations (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 payment_id uuid not null references public.dreem_financial_payments(id) on delete restrict,
 fee_charge_id uuid not null references public.dreem_student_fee_charges(id) on delete restrict,
 amount numeric not null check(amount>0), created_at timestamptz not null default now(), unique(payment_id,fee_charge_id)
);
create index if not exists dreem_payment_allocations_charge_idx on public.dreem_payment_allocations(fee_charge_id);
alter table public.dreem_payment_allocations enable row level security;
drop policy if exists dreem_payment_allocations_read on public.dreem_payment_allocations;
create policy dreem_payment_allocations_read on public.dreem_payment_allocations for select to authenticated using(
 private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','accountant','bursar','auditor'])
 or exists(select 1 from public.dreem_student_fee_charges c where c.id=fee_charge_id and private.dreem_is_family_of_student(c.school_id,c.student_id))
);
revoke insert,update,delete on public.dreem_payment_allocations from anon,authenticated;
grant select on public.dreem_payment_allocations to authenticated;

create or replace function private.dreem_allocate_payment_oldest_due(p_payment_id uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_payment public.dreem_financial_payments%rowtype; v_charge record; v_remaining numeric; v_paid numeric; v_open numeric; v_apply numeric; v_allocated numeric:=0;
begin
 select * into v_payment from public.dreem_financial_payments where id=p_payment_id;
 if v_payment.id is null or v_payment.fee_account_id is null or v_payment.reverses_payment_id is not null then return 0; end if;
 if exists(select 1 from public.dreem_payment_allocations where payment_id=v_payment.id) then select coalesce(sum(amount),0) into v_allocated from public.dreem_payment_allocations where payment_id=v_payment.id; return v_allocated; end if;
 v_remaining:=v_payment.amount;
 for v_charge in select c.* from public.dreem_student_fee_charges c where c.fee_account_id=v_payment.fee_account_id and c.school_id=v_payment.school_id and c.student_id=v_payment.student_id and c.status in('due','partially_paid') order by c.due_on nulls last,c.created_at,c.id for update loop
  select coalesce(sum(a.amount),0) into v_paid from public.dreem_payment_allocations a where a.fee_charge_id=v_charge.id;
  v_open:=greatest(v_charge.amount-v_charge.waived_amount-v_paid,0); if v_open<=0 then continue; end if;
  v_apply:=least(v_open,v_remaining); insert into public.dreem_payment_allocations(school_id,payment_id,fee_charge_id,amount) values(v_payment.school_id,v_payment.id,v_charge.id,v_apply);
  v_allocated:=v_allocated+v_apply; v_remaining:=v_remaining-v_apply;
  update public.dreem_student_fee_charges c set status=case when v_paid+v_apply>=c.amount-c.waived_amount then 'paid' else 'partially_paid' end,updated_at=now() where c.id=v_charge.id;
  exit when v_remaining<=0;
 end loop;
 update public.fee_accounts f set amount_paid=(select coalesce(sum(p.amount),0) from public.dreem_financial_payments p where p.fee_account_id=f.id and p.reverses_payment_id is null), balance_due=greatest(f.amount_due-(select coalesce(sum(p.amount),0) from public.dreem_financial_payments p where p.fee_account_id=f.id and p.reverses_payment_id is null),0), status=case when greatest(f.amount_due-(select coalesce(sum(p.amount),0) from public.dreem_financial_payments p where p.fee_account_id=f.id and p.reverses_payment_id is null),0)=0 then 'clear' when (select coalesce(sum(p.amount),0) from public.dreem_financial_payments p where p.fee_account_id=f.id and p.reverses_payment_id is null)>0 then 'partial' else 'open' end,updated_at=now() where f.id=v_payment.fee_account_id;
 return v_allocated;
end;$$;
revoke all on function private.dreem_allocate_payment_oldest_due(uuid) from public;
create or replace function private.dreem_allocate_payment_after_insert() returns trigger language plpgsql security definer set search_path='' as $$ begin perform private.dreem_allocate_payment_oldest_due(new.id); return new; end; $$;
drop trigger if exists dreem_allocate_payment_after_insert on public.dreem_financial_payments;
create trigger dreem_allocate_payment_after_insert after insert on public.dreem_financial_payments for each row execute function private.dreem_allocate_payment_after_insert();
do $$ declare r record; begin for r in select id from public.dreem_financial_payments where fee_account_id is not null and amount>0 and reverses_payment_id is null order by received_at,id loop perform private.dreem_allocate_payment_oldest_due(r.id); end loop; end $$;
