revoke all on public.dreem_curriculum_outcomes from public,anon;
revoke all on public.dreem_lesson_plan_outcomes from public,anon;
grant select on public.dreem_curriculum_outcomes,public.dreem_lesson_plan_outcomes to authenticated;
