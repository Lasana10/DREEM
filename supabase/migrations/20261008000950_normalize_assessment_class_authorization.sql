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
    v_def:=replace(v_def,'lower(c.name)=lower(trim(p_class_name))','lower(trim(c.name))=lower(trim(p_class_name))');
    v_def:=replace(v_def,'lower(coalesce(s.class_name,''''))
=lower(trim(p_class_name))','lower(trim(coalesce(s.class_name,'''')))=lower(trim(p_class_name))');
    v_def:=replace(v_def,'lower(coalesce(s.class_name,''''))=lower(trim(p_class_name))','lower(trim(coalesce(s.class_name,'''')))=lower(trim(p_class_name))');
    execute v_def;
  end loop;
end
$repair$;

do $verify$
begin
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname in ('dreem_record_assessment','dreem_record_assessment_v2')
      and (
        pg_get_functiondef(p.oid) like '%lower(c.name)=lower(trim(p_class_name))%'
        or pg_get_functiondef(p.oid) like '%lower(coalesce(s.class_name,%=lower(trim(p_class_name))%'
      )
  ) then raise exception 'Assessment class normalization repair incomplete'; end if;
end
$verify$;