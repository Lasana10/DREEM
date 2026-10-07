alter table public.dreem_notification_deliveries
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references auth.users(id);

alter table public.dreem_notification_deliveries drop constraint if exists dreem_notification_deliveries_status_check;
alter table public.dreem_notification_deliveries
  add constraint dreem_notification_deliveries_status_check
  check(status in('queued','sent','delivered','acknowledged','failed','retrying','cancelled'));

create or replace function public.dreem_acknowledge_notification_delivery(p_delivery_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_delivery public.dreem_notification_deliveries%rowtype;
begin
 if v_actor is null then raise exception 'Authentication is required'; end if;
 select * into v_delivery from public.dreem_notification_deliveries where id=p_delivery_id for update;
 if not found then raise exception 'Delivery not found'; end if;
 if v_delivery.recipient_user_id<>v_actor then raise exception 'This notification belongs to another recipient'; end if;
 if v_delivery.status in('failed','cancelled') then raise exception 'A failed or cancelled delivery cannot be acknowledged'; end if;
 update public.dreem_notification_deliveries
 set status='acknowledged',
     sent_at=coalesce(sent_at,queued_at),
     delivered_at=coalesce(delivered_at,now()),
     acknowledged_at=coalesce(acknowledged_at,now()),
     acknowledged_by=v_actor,
     updated_at=now()
 where id=p_delivery_id;
 return 'acknowledged';
end;$$;

revoke all on function public.dreem_acknowledge_notification_delivery(uuid) from public,anon;
grant execute on function public.dreem_acknowledge_notification_delivery(uuid) to authenticated,service_role;

create or replace view public.dreem_my_notification_deliveries
with (security_invoker=true)
as
select d.id,d.school_id,d.announcement_id,d.channel,d.status,d.queued_at,d.sent_at,d.delivered_at,d.acknowledged_at,
       a.title,a.body,a.priority,a.category,a.audience
from public.dreem_notification_deliveries d
join public.dreem_announcements a on a.id=d.announcement_id
where d.recipient_user_id=(select auth.uid());

grant select on public.dreem_my_notification_deliveries to authenticated;