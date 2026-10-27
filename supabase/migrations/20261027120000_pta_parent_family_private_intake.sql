-- Parent identity is private, self-declared and visible to authorised leadership only.
-- Names are not a verified identity or pupil enrolment match.
alter table public.dreem_pta_submissions
 add column parent_name text,
 add column children_names text,
 add column child_classes text;
alter table public.dreem_pta_submissions
 add constraint dreem_pta_parent_name_length check(parent_name is null or char_length(parent_name) between 2 and 160),
 add constraint dreem_pta_children_names_length check(children_names is null or char_length(children_names) between 2 and 400),
 add constraint dreem_pta_child_classes_length check(child_classes is null or char_length(child_classes)<=160);
-- The old write RPC is no longer available even to service_role.
revoke all on function public.dreem_pta_submit(uuid,text,text,text,text,text) from service_role;

create function public.dreem_pta_submit_family(
 p_campaign_id uuid,p_kind text,p_topic text,p_language text,p_message text,
 p_parent_name text,p_children_names text,p_child_classes text,p_contact text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_id uuid;
begin
 select c.school_id into v_school from public.dreem_pta_campaigns c
 where c.id=p_campaign_id and c.published=true and (c.closes_at is null or c.closes_at>now());
 if v_school is null then raise exception 'Consultation closed';end if;
 if p_kind not in ('concern','idea','question')
 or p_topic not in ('learning','facilities','administration','pta','other')
 or p_language not in ('en','fr') then raise exception 'Invalid category';end if;
 if char_length(trim(coalesce(p_message,''))) not between 15 and 2000
 or char_length(trim(coalesce(p_parent_name,''))) not between 2 and 160
 or char_length(trim(coalesce(p_children_names,''))) not between 2 and 400
 or char_length(coalesce(p_child_classes,''))>160
 or char_length(coalesce(p_contact,''))>160 then raise exception 'Invalid form';end if;
 if (select count(*) from public.dreem_pta_submissions
 where campaign_id=p_campaign_id and created_at>now()-interval '1 hour')>=1000
 then raise exception 'Submission rate limit reached';end if;
 insert into public.dreem_pta_submissions
 (campaign_id,school_id,kind,topic,language,message,contact,parent_name,children_names,child_classes)
 values(p_campaign_id,v_school,p_kind,p_topic,p_language,trim(p_message),
 nullif(trim(coalesce(p_contact,'')),''),trim(p_parent_name),
 trim(p_children_names),nullif(trim(coalesce(p_child_classes,'')),''))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.dreem_pta_submit_family(uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.dreem_pta_submit_family(uuid,text,text,text,text,text,text,text,text) to service_role;

-- Leadership-only read is replaced to include private parent/child names.
drop function public.dreem_pta_staff_submissions(uuid);
create function public.dreem_pta_staff_submissions(p_campaign_id uuid)
returns table(id uuid,kind text,topic text,language text,message text,contact text,status text,created_at timestamptz,
 parent_name text,children_names text,child_classes text)
language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 v_school:=private.dreem_active_school_for_role(array['leadership']);
 if v_school is null or not exists(select 1 from public.dreem_pta_campaigns
 where id=p_campaign_id and school_id=v_school) then raise exception 'Leadership required';end if;
 return query select s.id,s.kind,s.topic,s.language,s.message,s.contact,s.status,s.created_at,
 s.parent_name,s.children_names,s.child_classes
 from public.dreem_pta_submissions s
 where s.campaign_id=p_campaign_id and s.school_id=v_school
 order by s.created_at desc limit 500;
end $$;
revoke all on function public.dreem_pta_staff_submissions(uuid) from public,anon;
grant execute on function public.dreem_pta_staff_submissions(uuid) to authenticated;
