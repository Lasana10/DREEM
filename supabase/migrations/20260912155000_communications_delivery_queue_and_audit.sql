create table if not exists public.dreem_notification_deliveries (
  id uuid primary key default gen_random_uuid(), school_id uuid not null,
  announcement_id uuid not null references public.dreem_announcements(id) on delete cascade,
  recipient_user_id uuid not null, channel text not null check (channel in ('in_app','email','sms','whatsapp','push')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','retrying','cancelled')),
  attempts integer not null default 0,last_error text,provider_message_id text,queued_at timestamptz not null default now(),sent_at timestamptz,delivered_at timestamptz,updated_at timestamptz not null default now(),
  unique (announcement_id,recipient_user_id,channel)
);
create index if not exists dreem_notification_deliveries_school_status_idx on public.dreem_notification_deliveries(school_id,status,queued_at);
create index if not exists dreem_notification_deliveries_recipient_idx on public.dreem_notification_deliveries(recipient_user_id,queued_at desc);
alter table public.dreem_notification_deliveries enable row level security;
revoke all on public.dreem_notification_deliveries from anon; grant select on public.dreem_notification_deliveries to authenticated;
drop policy if exists "recipient reads own deliveries" on public.dreem_notification_deliveries;
create policy "recipient reads own deliveries" on public.dreem_notification_deliveries for select to authenticated using (recipient_user_id=(select auth.uid()) or private.dreem_has_role(school_id,array['leadership','support']));

create or replace function public.dreem_queue_announcement_delivery(p_announcement_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare a public.dreem_announcements%rowtype;v_count integer:=0;
begin
 select * into a from public.dreem_announcements where id=p_announcement_id;if not found then raise exception 'Announcement not found';end if;
 if a.publication_status<>'published' then raise exception 'Only published announcements can be delivered';end if;
 if not private.dreem_has_role(a.school_id,array['leadership','support']) and a.created_by<>(select auth.uid()) then raise exception 'You do not have permission to queue this announcement';end if;
 insert into public.dreem_notification_deliveries(school_id,announcement_id,recipient_user_id,channel,status)
 select a.school_id,a.id,m.profile_id,'in_app','queued' from public.dreem_school_memberships m where m.school_id=a.school_id and m.status='approved' and (a.audience='all' or (a.audience='staff' and m.role not in ('parent','student')) or (a.audience='families' and m.role='parent') or (a.audience='students' and m.role='student')) on conflict(announcement_id,recipient_user_id,channel) do nothing;
 get diagnostics v_count=row_count;
 insert into public.dreem_domain_events(school_id,aggregate_type,aggregate_id,event_type,idempotency_key,payload,status) values(a.school_id,'announcement',a.id,'ANNOUNCEMENT_DELIVERY_QUEUED','announcement-delivery:'||a.id::text,jsonb_build_object('announcement_id',a.id,'audience',a.audience,'priority',a.priority,'recipient_count',v_count),'pending') on conflict do nothing;
 insert into public.audit_events(school_id,actor_id,action,entity_type,entity_id,detail) values(a.school_id,(select auth.uid()),'announcement.delivery_queued','announcement',a.id,jsonb_build_object('audience',a.audience,'priority',a.priority,'recipient_count',v_count));return v_count;
end;$$;
revoke all on function public.dreem_queue_announcement_delivery(uuid) from public;grant execute on function public.dreem_queue_announcement_delivery(uuid) to authenticated;

create or replace function public.dreem_mark_in_app_delivered(p_delivery_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin update public.dreem_notification_deliveries set status='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now() where id=p_delivery_id and recipient_user_id=(select auth.uid()) and channel='in_app';end;$$;
revoke all on function public.dreem_mark_in_app_delivered(uuid) from public;grant execute on function public.dreem_mark_in_app_delivered(uuid) to authenticated;

create or replace function public.dreem_set_notification_delivery_status(p_delivery_id uuid,p_status text,p_provider_message_id text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.dreem_notification_deliveries%rowtype;begin if p_status not in ('sent','delivered','failed','retrying','cancelled') then raise exception 'Invalid delivery status';end if;select * into d from public.dreem_notification_deliveries where id=p_delivery_id;if not found then raise exception 'Delivery not found';end if;if not private.dreem_has_role(d.school_id,array['leadership','support']) then raise exception 'Not authorized';end if;update public.dreem_notification_deliveries set status=p_status,attempts=case when p_status in ('failed','retrying') then attempts+1 else attempts end,last_error=p_error,provider_message_id=coalesce(p_provider_message_id,provider_message_id),sent_at=case when p_status in ('sent','delivered') then coalesce(sent_at,now()) else sent_at end,delivered_at=case when p_status='delivered' then coalesce(delivered_at,now()) else delivered_at end,updated_at=now() where id=p_delivery_id;end;$$;
revoke all on function public.dreem_set_notification_delivery_status(uuid,text,text,text) from public;grant execute on function public.dreem_set_notification_delivery_status(uuid,text,text,text) to authenticated;