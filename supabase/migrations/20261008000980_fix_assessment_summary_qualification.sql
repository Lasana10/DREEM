do $repair$
declare r record; v_def text;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname in ('dreem_record_assessment','dreem_record_assessment_v2')
  loop
    v_def:=pg_get_functiondef(r.oid);
    v_def:=replace(
      v_def,
      'from public.dreem_marks where assessment_id=v_id',
      'from public.dreem_marks dm where dm.assessment_id=v_id'
    );
    execute v_def;
  end loop;
end
$repair$;

do $verify$
begin
  if exists(
    select 1
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname in ('dreem_record_assessment','dreem_record_assessment_v2')
      and pg_get_functiondef(p.oid) like '%from public.dreem_marks where assessment_id=v_id%'
  ) then raise exception 'Assessment summary qualification repair incomplete'; end if;
end
$verify$;