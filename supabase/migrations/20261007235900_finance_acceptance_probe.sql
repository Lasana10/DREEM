create table if not exists public.dreem_acceptance_evidence(
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  scenario text not null,
  status text not null check(status in('passed','failed','blocked')),
  detail jsonb not null default '{}'::jsonb,
  source text not null,
  run_at timestamptz not null default now()
);
alter table public.dreem_acceptance_evidence enable row level security;
drop policy if exists dreem_acceptance_evidence_read on public.dreem_acceptance_evidence;
create policy dreem_acceptance_evidence_read on public.dreem_acceptance_evidence for select to authenticated using(
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','auditor','accountant'])
);
revoke insert,update,delete on public.dreem_acceptance_evidence from anon,authenticated;
grant select on public.dreem_acceptance_evidence to authenticated;

do $$
declare
  v_school uuid; v_founder uuid; v_teacher uuid; v_founder_membership uuid; v_teacher_membership uuid;
  v_fee_account uuid; v_student uuid; v_class uuid; v_plan uuid; v_item uuid; v_rail uuid;
  v_session uuid; v_intent uuid; v_reference text; v_payment uuid; v_receipt text; v_token uuid;
  v_review uuid; v_expected numeric; v_variance numeric; v_allocated numeric; v_batch uuid; v_batch_ref text; v_batch_amount numeric;
  v_reconciled integer:=0; v_self_review_blocked boolean:=false; v_self_deposit_blocked boolean:=false; v_pass boolean:=false;
begin
  select m.id,m.profile_id,m.school_id into v_founder_membership,v_founder,v_school
  from public.dreem_school_memberships m where m.role='platform_founder' and m.status='approved' limit 1;
  select m.id,m.profile_id into v_teacher_membership,v_teacher
  from public.dreem_school_memberships m where m.school_id=v_school and m.role='teacher' and m.status='approved' limit 1;
  select f.id,f.student_id into v_fee_account,v_student from public.fee_accounts f where f.school_id=v_school and f.balance_due>=1000 order by f.balance_due desc limit 1;
  select c.id into v_class from public.dreem_classes c where c.school_id=v_school order by c.created_at limit 1;
  select r.id into v_rail from public.dreem_payment_rails r where r.school_id=v_school and r.rail_code='bank' limit 1;

  if v_school is null or v_founder is null or v_teacher is null or v_fee_account is null or v_class is null or v_rail is null then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'cash_payment_to_reconciled_deposit','blocked',jsonb_build_object('reason','Representative fixture prerequisites unavailable'),'20261007235900_finance_acceptance_probe');
    return;
  end if;

  begin
    update public.dreem_school_memberships set role='bursar' where id=v_founder_membership;
    update public.dreem_school_memberships set role='accountant' where id=v_teacher_membership;
    update public.dreem_payment_rails set enabled=true,merchant_reference='ACCEPTANCE-ONLY' where id=v_rail;

    insert into public.dreem_fee_plans(school_id,class_id,name,currency,status,created_by,activated_by,activated_at)
    values(v_school,v_class,'DREEM acceptance probe','XAF','active',v_founder,v_founder,now()) returning id into v_plan;
    insert into public.dreem_fee_plan_items(school_id,fee_plan_id,code,label,amount,due_on,required)
    values(v_school,v_plan,'ACCEPT','Acceptance probe',1000,current_date,true) returning id into v_item;
    insert into public.dreem_student_fee_charges(school_id,student_id,fee_account_id,fee_plan_id,fee_plan_item_id,amount,due_on)
    values(v_school,v_student,v_fee_account,v_plan,v_item,1000,current_date);

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_founder::text,'role','authenticated')::text,true);
    insert into public.dreem_cashier_sessions(school_id,cashier_user_id,opening_float) values(v_school,v_founder,0) returning id into v_session;

    select intent_id,payment_reference into v_intent,v_reference
    from public.dreem_create_payment_intent(v_student,v_fee_account,1000,'Acceptance payer',null,array['cash'],'acceptance-intent-'||gen_random_uuid()::text);

    select payment_id,receipt_number,confirmation_token into v_payment,v_receipt,v_token
    from public.dreem_record_verified_payment(v_intent,v_session,'cash','cash',1000,null,'acceptance-payment-'||gen_random_uuid()::text);

    select coalesce(sum(amount),0) into v_allocated from public.dreem_payment_allocations where payment_id=v_payment;
    if v_allocated<>1000 or v_receipt is null or v_token is null then raise exception 'receipt/allocation assertion failed'; end if;

    select review_id,expected_cash,variance into v_review,v_expected,v_variance
    from public.dreem_submit_cashier_session(v_session,1000,'Acceptance exact count',jsonb_build_object('reference','acceptance-count'));
    if v_expected<>1000 or v_variance<>0 then raise exception 'cash closure assertion failed'; end if;

    begin
      perform public.dreem_review_cashier_session(v_review,true,'self approval must fail','{}'::jsonb);
    exception when others then
      if position('cannot approve their own' in lower(sqlerrm))>0 then v_self_review_blocked:=true; else raise; end if;
    end;
    if not v_self_review_blocked then raise exception 'cashier self approval was not blocked'; end if;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher::text,'role','authenticated')::text,true);
    if public.dreem_review_cashier_session(v_review,true,'Independent acceptance review',jsonb_build_object('reference','acceptance-review'))<>'approved' then
      raise exception 'independent closure approval failed';
    end if;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_founder::text,'role','authenticated')::text,true);
    select batch_id,batch_reference,amount into v_batch,v_batch_ref,v_batch_amount
    from public.dreem_create_cash_deposit_batch(array[v_payment],v_rail,'ACCEPTANCE-DEPOSIT',jsonb_build_object('reference','acceptance-slip'));
    if v_batch is null or v_batch_amount<>1000 then raise exception 'deposit batch assertion failed'; end if;

    begin
      perform public.dreem_review_cash_deposit_batch(v_batch,true,'self confirmation must fail');
    exception when others then
      if position('cannot confirm their own' in lower(sqlerrm))>0 then v_self_deposit_blocked:=true; else raise; end if;
    end;
    if not v_self_deposit_blocked then raise exception 'depositor self confirmation was not blocked'; end if;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_teacher::text,'role','authenticated')::text,true);
    if public.dreem_review_cash_deposit_batch(v_batch,true,'Independent settlement confirmation')<>'confirmed' then
      raise exception 'independent deposit confirmation failed';
    end if;
    select count(*) into v_reconciled from public.dreem_payment_events where payment_id=v_payment and event_type='reconciled';
    if v_reconciled<>1 then raise exception 'expected one reconciled event'; end if;

    v_pass:=true;
    raise exception using errcode='P0001',message='DREEM_ACCEPTANCE_ROLLBACK';
  exception
    when sqlstate 'P0001' then
      if sqlerrm<>'DREEM_ACCEPTANCE_ROLLBACK' then raise; end if;
  end;

  if v_pass then
    insert into public.dreem_acceptance_evidence(school_id,scenario,status,detail,source)
    values(v_school,'cash_payment_to_reconciled_deposit','passed',
      jsonb_build_object(
        'receipt_issued',true,'payment_allocated',true,'cashier_self_approval_blocked',v_self_review_blocked,
        'independent_closure_approved',true,'deposit_self_confirmation_blocked',v_self_deposit_blocked,
        'independent_deposit_confirmed',true,'reconciled_event_count',v_reconciled,'fixture_rolled_back',true
      ),
      '20261007235900_finance_acceptance_probe');
  end if;
end $$;