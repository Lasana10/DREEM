do $repair$
declare
  v_oid oid;
  v_def text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='dreem_export_school_snapshot'
  limit 1;

  if v_oid is null then raise exception 'DREEM recovery export function not found'; end if;

  v_def:=pg_get_functiondef(v_oid);
  v_def:=replace(v_def,' order by x.starts_on',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.name',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.created_at',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.day_of_week,x.start_time',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.lesson_date',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.session_date',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.assessment_date',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.queued_at',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.received_at',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,' order by x.recorded_at',' order by to_jsonb(x)::text');
  v_def:=replace(v_def,'to_jsonb(x) - ''credential_token''','to_jsonb(x) - ''token_hash''');
  execute v_def;
end
$repair$;

do $verify$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='dreem_export_school_snapshot'
  limit 1;

  if v_def like '%credential_token%' then
    raise exception 'Recovery export still references the wrong credential secret field';
  end if;
  if v_def not like '%to_jsonb(x) - ''token_hash''%' then
    raise exception 'Recovery export does not strip credential token hashes';
  end if;
end
$verify$;