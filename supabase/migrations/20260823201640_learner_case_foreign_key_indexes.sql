create index if not exists dreem_case_events_school_idx on public.dreem_case_events(school_id);
create index if not exists dreem_case_events_actor_idx on public.dreem_case_events(actor_user_id);
create index if not exists dreem_student_cases_opened_by_idx on public.dreem_student_cases(opened_by);
