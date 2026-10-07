do $repair$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
      and p.proname=any(array[
        'dreem_authorize_collector',
        'dreem_export_school_snapshot',
        'dreem_invite_staff',
        'dreem_verify_and_record_learner_release',
        'dreem_verify_school_snapshot'
      ])
  loop
    v_def:=replace(pg_get_functiondef(r.oid),'public.digest(','extensions.digest(');
    execute v_def;
  end loop;
end
$repair$;

do $verify$
begin
  if exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
      and p.proname=any(array[
        'dreem_authorize_collector',
        'dreem_export_school_snapshot',
        'dreem_invite_staff',
        'dreem_verify_and_record_learner_release',
        'dreem_verify_school_snapshot'
      ])
      and pg_get_functiondef(p.oid) like '%public.digest(%'
  ) then
    raise exception 'DREEM digest schema repair did not cover every active function';
  end if;
end
$verify$;