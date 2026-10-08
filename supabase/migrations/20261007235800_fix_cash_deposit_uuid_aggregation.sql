create or replace function public.dreem_create_cash_deposit_batch(
  p_payment_ids uuid[], p_destination_rail_id uuid, p_deposit_reference text, p_evidence jsonb
) returns table(batch_id uuid, batch_reference text, amount numeric)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_school_id uuid; v_school_count integer; v_amount numeric(14,2); v_count integer; v_batch_id uuid; v_batch_reference text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication is required.'; end if;
  if coalesce(array_length(p_payment_ids,1),0)=0 then raise exception 'Select at least one cash payment.'; end if;
  if nullif(trim(p_deposit_reference),'') is null then raise exception 'Deposit reference is required.'; end if;

  select (array_agg(p.school_id order by p.school_id::text))[1],count(distinct p.school_id),sum(p.amount),count(*)
    into v_school_id,v_school_count,v_amount,v_count
    from public.dreem_financial_payments p
    join public.dreem_cashier_sessions c on c.id=p.cashier_session_id and c.status='approved'
   where p.id=any(p_payment_ids)
     and p.method='cash'
     and p.reverses_payment_id is null
     and p.received_by=(select auth.uid())
     and not exists(select 1 from public.dreem_cash_deposit_items i where i.payment_id=p.id);

  if v_count<>array_length(p_payment_ids,1) or v_school_count<>1 then
    raise exception 'Every payment must be the cashier''s approved, unsettled cash collection from one school.';
  end if;
  if not private.dreem_has_role(v_school_id,array['bursar']) then raise exception 'Authorized bursar membership required.'; end if;
  if not exists(
    select 1 from public.dreem_payment_rails r
    where r.id=p_destination_rail_id and r.school_id=v_school_id and r.rail_type in ('mobile_money','bank') and r.enabled
  ) then raise exception 'Enabled institutional settlement rail required.'; end if;

  v_batch_reference:=concat('DEP-',to_char(now(),'YYYYMMDD'),'-',upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  insert into public.dreem_cash_deposit_batches(school_id,batch_reference,amount,destination_rail_id,deposit_reference,evidence,submitted_by)
  values(v_school_id,v_batch_reference,v_amount,p_destination_rail_id,trim(p_deposit_reference),coalesce(p_evidence,'{}'::jsonb),(select auth.uid()))
  returning id into v_batch_id;

  insert into public.dreem_cash_deposit_items(batch_id,school_id,payment_id,amount)
  select v_batch_id,v_school_id,p.id,p.amount from public.dreem_financial_payments p where p.id=any(p_payment_ids);

  batch_id:=v_batch_id; batch_reference:=v_batch_reference; amount:=v_amount; return next;
end;
$$;

revoke all on function public.dreem_create_cash_deposit_batch(uuid[],uuid,text,jsonb) from public,anon;
grant execute on function public.dreem_create_cash_deposit_batch(uuid[],uuid,text,jsonb) to authenticated;