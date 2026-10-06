create table if not exists public.dreem_learner_placements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  from_class_id uuid references public.dreem_classes(id) on delete set null,
  to_class_id uuid not null references public.dreem_classes(id) on delete restrict,
  from_academic_year_id uuid references public.dreem_academic_years(id) on delete set null,
  to_academic_year_id uuid not null references public.dreem_academic_years(id) on delete restrict,
  reason text not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  transition_key text not null,
  changed_at timestamptz not null default now(),
  unique(school_id,student_id,transition_key)
);
create index if not exists dreem_learner_placements_school_student_idx on public.dreem_learner_placements(school_id,student_id,changed_at desc);
create index if not exists dreem_learner_placements_year_idx on public.dreem_learner_placements(school_id,to_academic_year_id,to_class_id);
alter table public.dreem_learner_placements enable row level security;
revoke all on public.dreem_learner_placements from anon;
grant select on public.dreem_learner_placements to authenticated;
create policy dreem_learner_placements_read on public.dreem_learner_placements for select to authenticated using (
  public.dreem_has_authority(school_id,'institutional_leadership') or public.dreem_has_authority(school_id,'academics_delivery') or public.dreem_has_authority(school_id,'academics_approval') or public.dreem_has_authority(school_id,'admissions_intake') or public.dreem_has_authority(school_id,'admissions_decision') or public.dreem_has_authority(school_id,'audit')
);
create or replace function public.dreem_preview_class_transition(p_from_class_id uuid,p_to_class_id uuid) returns table(school_id uuid,from_class_name text,to_class_name text,from_academic_year_id uuid,to_academic_year_id uuid,affected_learners integer)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_from public.dreem_classes%rowtype; v_to public.dreem_classes%rowtype;
begin
 if v_actor is null then raise exception 'Authentication is required.'; end if;
 select * into v_from from public.dreem_classes where id=p_from_class_id; select * into v_to from public.dreem_classes where id=p_to_class_id;
 if v_from.id is null or v_to.id is null or v_from.school_id<>v_to.school_id then raise exception 'Choose two classes from the same school.'; end if;
 if v_to.academic_year_id is null then raise exception 'The destination class must belong to an academic year.'; end if;
 if not (public.dreem_has_authority(v_from.school_id,'academics_approval') or public.dreem_has_authority(v_from.school_id,'school_configuration') or public.dreem_has_authority(v_from.school_id,'institutional_leadership')) then raise exception 'You are not authorized to move a class into a new academic year.'; end if;
 school_id:=v_from.school_id;from_class_name:=v_from.name;to_class_name:=v_to.name;from_academic_year_id:=v_from.academic_year_id;to_academic_year_id:=v_to.academic_year_id;
 select count(*)::integer into affected_learners from public.students s where s.school_id=v_from.school_id and s.class_name=v_from.name and s.merged_into_student_id is null; return next;
end; $$;
create or replace function public.dreem_execute_class_transition(p_from_class_id uuid,p_to_class_id uuid,p_expected_count integer,p_reason text,p_idempotency_key text) returns table(moved_learners integer,destination_class text,transition_key text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_from public.dreem_classes%rowtype; v_to public.dreem_classes%rowtype; v_current_count integer; v_key text;
begin
 if v_actor is null then raise exception 'Authentication is required.'; end if;
 if char_length(trim(coalesce(p_reason,'')))<5 then raise exception 'Explain this class transition before continuing.'; end if;
 if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'A transition key is required.'; end if;
 select * into v_from from public.dreem_classes where id=p_from_class_id for share; select * into v_to from public.dreem_classes where id=p_to_class_id for share;
 if v_from.id is null or v_to.id is null or v_from.school_id<>v_to.school_id then raise exception 'Choose two classes from the same school.'; end if;
 if v_from.id=v_to.id then raise exception 'Choose a different destination class.'; end if;
 if v_to.academic_year_id is null then raise exception 'The destination class must belong to an academic year.'; end if;
 if not (public.dreem_has_authority(v_from.school_id,'academics_approval') or public.dreem_has_authority(v_from.school_id,'school_configuration') or public.dreem_has_authority(v_from.school_id,'institutional_leadership')) then raise exception 'You are not authorized to move a class into a new academic year.'; end if;
 select count(*)::integer into v_current_count from public.students s where s.school_id=v_from.school_id and s.class_name=v_from.name and s.merged_into_student_id is null;
 if v_current_count<>p_expected_count then raise exception 'The class changed after preview. Review the learner count again before continuing.'; end if;
 if v_current_count=0 then raise exception 'No learner is currently in the source class.'; end if; v_key:=trim(p_idempotency_key);
 if exists(select 1 from public.dreem_learner_placements p where p.school_id=v_from.school_id and p.transition_key=v_key) then select count(*)::integer into moved_learners from public.dreem_learner_placements p where p.school_id=v_from.school_id and p.transition_key=v_key;destination_class:=v_to.name;transition_key:=v_key;return next;return;end if;
 insert into public.dreem_learner_placements(school_id,student_id,from_class_id,to_class_id,from_academic_year_id,to_academic_year_id,reason,changed_by,transition_key)
 select v_from.school_id,s.id,v_from.id,v_to.id,v_from.academic_year_id,v_to.academic_year_id,trim(p_reason),v_actor,v_key from public.students s where s.school_id=v_from.school_id and s.class_name=v_from.name and s.merged_into_student_id is null;
 update public.students s set class_name=v_to.name,updated_at=now() where s.school_id=v_from.school_id and s.class_name=v_from.name and s.merged_into_student_id is null;
 perform private.dreem_write_event(v_from.school_id,'class',v_to.id,'class.transition_completed',concat('class-transition:',v_key),jsonb_build_object('actor',v_actor,'from_class',v_from.name,'to_class',v_to.name,'moved_learners',v_current_count,'reason',trim(p_reason),'from_academic_year_id',v_from.academic_year_id,'to_academic_year_id',v_to.academic_year_id));
 moved_learners:=v_current_count;destination_class:=v_to.name;transition_key:=v_key;return next;
end; $$;
revoke all on function public.dreem_preview_class_transition(uuid,uuid) from public,anon;grant execute on function public.dreem_preview_class_transition(uuid,uuid) to authenticated;
revoke all on function public.dreem_execute_class_transition(uuid,uuid,integer,text,text) from public,anon;grant execute on function public.dreem_execute_class_transition(uuid,uuid,integer,text,text) to authenticated;
