alter table public.dreem_payment_confirmations
  add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

create index if not exists dreem_payment_confirmations_pending_expiry_idx
  on public.dreem_payment_confirmations(expires_at)
  where acknowledgement_status='pending';

create or replace function public.dreem_acknowledge_payment(p_confirmation_token uuid, p_action text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_confirmation public.dreem_payment_confirmations%rowtype;
begin
  if p_confirmation_token is null or p_action not in ('confirmed','disputed') then
    return false;
  end if;

  select * into v_confirmation
    from public.dreem_payment_confirmations c
   where c.confirmation_token=p_confirmation_token
   for update;

  if not found
     or v_confirmation.acknowledgement_status<>'pending'
     or v_confirmation.expires_at<=now() then
    return false;
  end if;

  update public.dreem_payment_confirmations
     set acknowledgement_status=p_action,
         acknowledged_at=now()
   where id=v_confirmation.id
     and acknowledgement_status='pending';

  if not found then return false; end if;

  insert into public.dreem_domain_events(school_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload)
  values(
    v_confirmation.school_id,'payment',v_confirmation.payment_id,concat('payment.',p_action),
    concat('payment.ack:',v_confirmation.id),
    jsonb_build_object('payment_id',v_confirmation.payment_id,'action',p_action,'acknowledged_at',now())
  );
  return true;
end;
$function$;

revoke all on function public.dreem_acknowledge_payment(uuid,text) from public;
grant execute on function public.dreem_acknowledge_payment(uuid,text) to anon, authenticated, service_role;