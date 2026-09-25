-- DREEM finance rail configuration under institutional authority.
-- Provider secrets remain server-side; schools configure only public merchant identity and enablement.

drop policy if exists dreem_payment_rails_insert on public.dreem_payment_rails;
drop policy if exists dreem_payment_rails_update on public.dreem_payment_rails;

create policy dreem_payment_rails_insert
on public.dreem_payment_rails
for insert to authenticated
with check (
  public.dreem_has_authority(school_id,'finance_approval')
  and public.dreem_has_authority(school_id,'school_configuration')
);

create policy dreem_payment_rails_update
on public.dreem_payment_rails
for update to authenticated
using (
  public.dreem_has_authority(school_id,'finance_approval')
  and public.dreem_has_authority(school_id,'school_configuration')
)
with check (
  public.dreem_has_authority(school_id,'finance_approval')
  and public.dreem_has_authority(school_id,'school_configuration')
);

create or replace function public.dreem_configure_payment_rail(
  p_school_id uuid,
  p_rail_code text,
  p_display_name text,
  p_merchant_reference text,
  p_enabled boolean,
  p_priority integer
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_type text;
begin
  if not public.dreem_has_authority(p_school_id,'finance_approval')
     or not public.dreem_has_authority(p_school_id,'school_configuration') then
    raise exception 'Finance policy and school configuration authority are both required.';
  end if;
  if p_rail_code not in ('cash','wave','mtn_momo','orange_money','bank','card','cheque','other') then
    raise exception 'Unsupported payment rail.';
  end if;
  if nullif(trim(p_display_name),'') is null then raise exception 'Payment rail name is required.'; end if;
  if p_priority is null or p_priority<0 then raise exception 'Payment rail priority must be zero or greater.'; end if;
  if p_rail_code<>'cash' and p_enabled and nullif(trim(coalesce(p_merchant_reference,'')),'') is null then
    raise exception 'An institutional merchant/account reference is required before enabling a digital or bank rail.';
  end if;

  v_type:=case
    when p_rail_code in ('wave','mtn_momo','orange_money') then 'mobile_money'
    when p_rail_code='bank' then 'bank'
    when p_rail_code='card' then 'card'
    when p_rail_code='cheque' then 'cheque'
    when p_rail_code='cash' then 'cash'
    else 'other'
  end;

  insert into public.dreem_payment_rails(school_id,rail_code,display_name,rail_type,merchant_reference,enabled,priority,configuration)
  values(p_school_id,p_rail_code,trim(p_display_name),v_type,nullif(trim(coalesce(p_merchant_reference,'')),''),case when p_rail_code='cash' then true else coalesce(p_enabled,false) end,p_priority,'{}'::jsonb)
  on conflict(school_id,rail_code) do update
    set display_name=excluded.display_name,
        rail_type=excluded.rail_type,
        merchant_reference=excluded.merchant_reference,
        enabled=excluded.enabled,
        priority=excluded.priority,
        updated_at=now()
  returning id into v_id;

  insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail)
  values(p_school_id,(select auth.uid()),'finance.payment_rail_configured','payment_rail',v_id,
    jsonb_build_object('rail_code',p_rail_code,'enabled',case when p_rail_code='cash' then true else coalesce(p_enabled,false) end,'priority',p_priority));

  return v_id;
end;
$$;

revoke all on function public.dreem_configure_payment_rail(uuid,text,text,text,boolean,integer) from public;
grant execute on function public.dreem_configure_payment_rail(uuid,text,text,text,boolean,integer) to authenticated;
