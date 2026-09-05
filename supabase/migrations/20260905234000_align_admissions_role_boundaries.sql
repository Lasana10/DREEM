do $block$
declare
  v_oid oid;
  v_definition text;
  v_old text := $q$array['leadership','administrator','academic_head']$q$;
  v_new text := $q$array['platform_founder','school_owner','principal','administrator']$q$;
begin
  for v_oid in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('dreem_record_admission_application','dreem_progress_admission_application')
  loop
    v_definition := pg_get_functiondef(v_oid);
    v_definition := replace(v_definition,v_old,v_new);
    if position(v_new in v_definition)=0 then
      raise exception 'Admission role guard replacement failed for function oid %',v_oid;
    end if;
    execute v_definition;
  end loop;
end
$block$;

revoke all on function public.dreem_record_admission_application(text,date,text,text,text,text,text,text,text,text,text,uuid,boolean,boolean,text) from public,anon;
revoke all on function public.dreem_progress_admission_application(uuid,text,text,uuid,numeric,text) from public,anon;
grant execute on function public.dreem_record_admission_application(text,date,text,text,text,text,text,text,text,text,text,uuid,boolean,boolean,text) to authenticated,service_role;
grant execute on function public.dreem_progress_admission_application(uuid,text,text,uuid,numeric,text) to authenticated,service_role;