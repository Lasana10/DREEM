create or replace function public.dreem_submit_cashier_session(p_cashier_session_id uuid, p_declared_cash numeric, p_explanation text, p_evidence jsonb)
returns table(review_id uuid, expected_cash numeric, variance numeric)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_session public.dreem_cashier_sessions%rowtype;
  v_expected numeric(14,2);
  v_review_id uuid;
begin
  select * into v_session from public.dreem_cashier_sessions c where c.id=p_cashier_session_id for update;
  if not found or v_session.cashier_user_id<>(select auth.uid()) or v_session.status<>'open' then raise exception 'Open cashier session not found.'; end if;
  if not private.dreem_has_role(v_session.school_id,array['bursar']) then raise exception 'Authorized bursar membership required.'; end if;
  if p_declared_cash is null or p_declared_cash<0 then raise exception 'Declared cash cannot be negative.'; end if;
  select v_session.opening_float+coalesce(sum(p.amount),0) into v_expected
    from public.dreem_financial_payments p
   where p.cashier_session_id=v_session.id
     and p.method='cash'
     and p.reverses_payment_id is null;
  if p_declared_cash<>v_expected and nullif(trim(coalesce(p_explanation,'')),'') is null then raise exception 'A variance explanation is required when declared cash differs from expected cash.'; end if;
  update public.dreem_cashier_sessions set declared_cash=p_declared_cash,expected_cash=v_expected,status='submitted',closed_at=now() where id=v_session.id;
  insert into public.dreem_reconciliation_reviews(school_id,cashier_session_id,submitted_by,variance,explanation,evidence)
  values(v_session.school_id,v_session.id,(select auth.uid()),p_declared_cash-v_expected,nullif(trim(p_explanation),''),coalesce(p_evidence,'{}'::jsonb)) returning id into v_review_id;
  perform private.dreem_write_event(v_session.school_id,'cashier_session',v_session.id,'cashier.submitted',concat('cashier.submitted:',v_session.id),jsonb_build_object('expected_cash',v_expected,'declared_cash',p_declared_cash,'variance',p_declared_cash-v_expected));
  review_id:=v_review_id; expected_cash:=v_expected; variance:=p_declared_cash-v_expected; return next;
end;
$function$;
revoke all on function public.dreem_submit_cashier_session(uuid,numeric,text,jsonb) from public,anon;
grant execute on function public.dreem_submit_cashier_session(uuid,numeric,text,jsonb) to authenticated,service_role;