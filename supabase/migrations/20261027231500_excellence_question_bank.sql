-- Moderated curriculum-aligned question bank, not an autonomous assessment publisher.
create table public.dreem_question_bank (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 outcome_id uuid not null references public.dreem_curriculum_outcomes(id) on delete restrict,
 language text not null check(language in ('en','fr')),
 question_type text not null check(question_type in ('short_answer','multiple_choice','true_false')),
 difficulty text not null check(difficulty in ('foundation','intermediate','advanced')),
 question_text text not null check(length(trim(question_text)) between 10 and 4000),
 choices jsonb not null default '[]'::jsonb check(jsonb_typeof(choices)='array'),
 answer_key text not null check(length(trim(answer_key)) between 1 and 4000),
 marking_guide text not null default '',
 points integer not null check(points between 1 and 100),
 source_reference text not null default '',
 status text not null default 'draft' check(status in ('draft','submitted','approved','returned')),
 created_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index dreem_question_bank_outcome_idx on public.dreem_question_bank(school_id,outcome_id,status);
alter table public.dreem_question_bank enable row level security;
revoke all on public.dreem_question_bank from public,anon,authenticated;
grant select on public.dreem_question_bank to authenticated;
create policy dreem_question_bank_authorized_read on public.dreem_question_bank
for select to authenticated using (
 (select private.dreem_has_role(school_id,array['leadership','academic_head']))
 or created_by=(select auth.uid())
 or (status='approved' and exists (
   select 1 from public.dreem_curriculum_outcomes o
   join public.dreem_teaching_assignments a
     on a.school_id=o.school_id and a.academic_year_id=o.academic_year_id
     and a.class_id=o.class_id and a.subject_id=o.subject_id
   where o.id=outcome_id and a.teacher_user_id=(select auth.uid()) and a.status='active'
 ))
);
create trigger dreem_question_bank_audit after insert or update or delete
 on public.dreem_question_bank for each row execute function private.dreem_audit_row();

create function public.dreem_save_question(
 p_outcome_id uuid,p_language text,p_type text,p_difficulty text,p_question text,
 p_choices jsonb,p_answer text,p_marking_guide text,p_points integer,p_source text,
 p_question_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_outcome public.dreem_curriculum_outcomes%rowtype; v_id uuid;
 v_existing public.dreem_question_bank%rowtype;
begin
 if v_actor is null then raise exception 'Sign in to author questions';end if;
 select * into v_outcome from public.dreem_curriculum_outcomes where id=p_outcome_id and status='active';
 if not found then raise exception 'Approved curriculum outcome required';end if;
 if not private.dreem_has_role(v_outcome.school_id,array['leadership','academic_head'])
 and not exists(select 1 from public.dreem_teaching_assignments a
   where a.school_id=v_outcome.school_id and a.academic_year_id=v_outcome.academic_year_id
   and a.class_id=v_outcome.class_id and a.subject_id=v_outcome.subject_id
   and a.teacher_user_id=v_actor and a.status='active')
 then raise exception 'Not assigned to this curriculum outcome';end if;
 if p_language not in ('en','fr') or p_type not in ('short_answer','multiple_choice','true_false')
 or p_difficulty not in ('foundation','intermediate','advanced')
 or length(trim(coalesce(p_question,''))) not between 10 and 4000
 or length(trim(coalesce(p_answer,''))) not between 1 and 4000
 or p_points not between 1 and 100 or coalesce(jsonb_typeof(p_choices),'')<>'array'
 then raise exception 'Invalid question format or content';end if;
 if p_type='multiple_choice' and jsonb_array_length(p_choices) not between 2 and 6 then
 raise exception 'Multiple choice questions need 2 to 6 answer choices';end if;
 if p_question_id is not null then
  select * into v_existing from public.dreem_question_bank where id=p_question_id for update;
  if not found or v_existing.school_id<>v_outcome.school_id or v_existing.created_by<>v_actor
    or v_existing.status not in ('draft','returned') then
   raise exception 'Only your own draft or returned question can be edited';end if;
  update public.dreem_question_bank set outcome_id=p_outcome_id,language=p_language,question_type=p_type,
   difficulty=p_difficulty,question_text=trim(p_question),choices=p_choices,
   answer_key=trim(p_answer),marking_guide=coalesce(p_marking_guide,''),
   points=p_points,source_reference=coalesce(p_source,''),status='draft',
   review_note=null,reviewed_by=null,reviewed_at=null,updated_at=now()
   where id=p_question_id returning id into v_id;
 else
  insert into public.dreem_question_bank(
   school_id,outcome_id,language,question_type,difficulty,question_text,choices,
   answer_key,marking_guide,points,source_reference,created_by)
  values(v_outcome.school_id,p_outcome_id,p_language,p_type,p_difficulty,
   trim(p_question),p_choices,trim(p_answer),coalesce(p_marking_guide,''),
   p_points,coalesce(p_source,''),v_actor)
  returning id into v_id;
 end if;
 perform private.dreem_write_event(v_outcome.school_id,'question_bank',v_id,'question.draft_saved',
 'question-draft:'||v_id,jsonb_build_object('outcome_id',p_outcome_id));
 return v_id;
end;$$;

create function public.dreem_submit_question(p_question_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_row public.dreem_question_bank%rowtype;
begin
 select * into v_row from public.dreem_question_bank where id=p_question_id for update;
 if v_actor is null or not found or v_row.created_by<>v_actor or v_row.status<>'draft'
 then raise exception 'Only your own draft question can be submitted';end if;
 update public.dreem_question_bank set status='submitted',updated_at=now() where id=p_question_id;
 perform private.dreem_write_event(v_row.school_id,'question_bank',p_question_id,'question.submitted',
 'question-submitted:'||p_question_id,jsonb_build_object('outcome_id',v_row.outcome_id));
 return p_question_id;
end;$$;
create function public.dreem_review_question(p_question_id uuid,p_decision text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());v_row public.dreem_question_bank%rowtype;
begin
 select * into v_row from public.dreem_question_bank where id=p_question_id for update;
 if v_actor is null or not found then raise exception 'Question not found';end if;
 if not private.dreem_has_role(v_row.school_id,array['leadership','academic_head'])
 or v_row.created_by=v_actor then raise exception 'Independent academic approval required';end if;
 if v_row.status<>'submitted' or p_decision not in ('approved','returned')
 or length(trim(coalesce(p_note,'')))<5 then raise exception 'A submitted question and review note are required';end if;
 update public.dreem_question_bank set status=p_decision,reviewed_by=v_actor,
 reviewed_at=now(),review_note=trim(p_note),updated_at=now() where id=p_question_id;
 perform private.dreem_write_event(v_row.school_id,'question_bank',p_question_id,
 'question.'||p_decision,'question-review:'||p_question_id||':'||p_decision,
 jsonb_build_object('review_note',trim(p_note)));
 return p_question_id;
end;$$;
revoke all on function public.dreem_save_question(uuid,text,text,text,text,jsonb,text,text,integer,text,uuid) from public,anon;
revoke all on function public.dreem_submit_question(uuid) from public,anon;
revoke all on function public.dreem_review_question(uuid,text,text) from public,anon;
grant execute on function public.dreem_save_question(uuid,text,text,text,text,jsonb,text,text,integer,text,uuid) to authenticated;
grant execute on function public.dreem_submit_question(uuid) to authenticated;
grant execute on function public.dreem_review_question(uuid,text,text) to authenticated;
