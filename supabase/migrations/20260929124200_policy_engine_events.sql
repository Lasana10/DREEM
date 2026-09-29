-- DREEM event-driven policy evaluation triggers.

create or replace function private.dreem_process_policy_queue_row()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  begin
    perform private.dreem_evaluate_student_policies(new.school_id,new.student_id);
    delete from public.dreem_policy_evaluation_queue where id=new.id;
  exception when others then
    update public.dreem_policy_evaluation_queue
    set attempts=attempts+1,
        last_error=left(sqlerrm,500),
        updated_at=now()
    where id=new.id;
  end;
  return null;
end;
$$;
revoke all on function private.dreem_process_policy_queue_row() from public,anon,authenticated;

drop trigger if exists dreem_process_policy_queue_row
on public.dreem_policy_evaluation_queue;

create trigger dreem_process_policy_queue_row
after insert or update of reason
on public.dreem_policy_evaluation_queue
for each row
execute function private.dreem_process_policy_queue_row();

create or replace function private.dreem_policy_queue_from_student()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.dreem_enqueue_policy_student(
    new.school_id,new.id,'learner_record_changed'
  );
  return new;
end;
$$;
revoke all on function private.dreem_policy_queue_from_student() from public,anon,authenticated;

create or replace function private.dreem_policy_queue_from_attendance()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.dreem_enqueue_policy_student(
    new.school_id,new.student_id,'attendance_changed'
  );
  return new;
end;
$$;
revoke all on function private.dreem_policy_queue_from_attendance() from public,anon,authenticated;

create or replace function private.dreem_policy_queue_from_submission()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.dreem_enqueue_policy_student(
    new.school_id,new.student_id,'assignment_submission_changed'
  );
  return new;
end;
$$;
revoke all on function private.dreem_policy_queue_from_submission() from public,anon,authenticated;

create or replace function private.dreem_policy_queue_from_fee_charge()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.dreem_enqueue_policy_student(
    new.school_id,new.student_id,'fee_charge_changed'
  );
  return new;
end;
$$;
revoke all on function private.dreem_policy_queue_from_fee_charge() from public,anon,authenticated;

create or replace function private.dreem_policy_queue_from_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.dreem_policy_evaluation_queue(school_id,student_id,reason)
  select new.school_id,s.id,'assignment_changed'
  from public.students s
  join public.dreem_classes c
    on c.school_id=s.school_id
   and lower(c.name)=lower(coalesce(s.class_name,''))
  where c.id=new.class_id
    and s.school_id=new.school_id
    and s.merged_into_student_id is null
  on conflict(school_id,student_id) do update
    set reason='assignment_changed',updated_at=now();

  return new;
end;
$$;
revoke all on function private.dreem_policy_queue_from_assignment() from public,anon,authenticated;

drop trigger if exists dreem_policy_queue_student on public.students;
create trigger dreem_policy_queue_student
after insert or update of attendance_rate,class_name
on public.students
for each row
execute function private.dreem_policy_queue_from_student();

drop trigger if exists dreem_policy_queue_attendance on public.dreem_attendance_marks;
create trigger dreem_policy_queue_attendance
after insert or update of status
on public.dreem_attendance_marks
for each row
execute function private.dreem_policy_queue_from_attendance();

drop trigger if exists dreem_policy_queue_submission on public.dreem_assignment_submissions;
create trigger dreem_policy_queue_submission
after insert or update of status
on public.dreem_assignment_submissions
for each row
execute function private.dreem_policy_queue_from_submission();

drop trigger if exists dreem_policy_queue_fee_charge on public.dreem_student_fee_charges;
create trigger dreem_policy_queue_fee_charge
after insert or update of status,due_on,waived_amount
on public.dreem_student_fee_charges
for each row
execute function private.dreem_policy_queue_from_fee_charge();

drop trigger if exists dreem_policy_queue_assignment on public.dreem_assignments;
create trigger dreem_policy_queue_assignment
after insert or update of status,due_at,class_id
on public.dreem_assignments
for each row
execute function private.dreem_policy_queue_from_assignment();

create or replace function private.dreem_seed_policy_on_school()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.dreem_seed_recommended_policy_rules(new.id,auth.uid());
  return new;
end;
$$;
revoke all on function private.dreem_seed_policy_on_school() from public,anon,authenticated;

drop trigger if exists dreem_seed_policy_on_school on public.schools;
create trigger dreem_seed_policy_on_school
after insert on public.schools
for each row
execute function private.dreem_seed_policy_on_school();

do $$
declare
  s record;
begin
  for s in select id from public.schools loop
    perform private.dreem_seed_recommended_policy_rules(s.id,null);
  end loop;
end;
$$;
