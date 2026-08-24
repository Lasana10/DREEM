-- Complete founder bootstrap with the required operational brand defaults.
-- Cameroon launch defaults are explicit and can be edited later in School Studio.
create or replace function public.dreem_bootstrap_school(
  p_school_name text,
  p_school_slug text,
  p_short_name text,
  p_motto text,
  p_city text,
  p_subsystem text,
  p_receipt_prefix text,
  p_student_id_prefix text,
  p_primary_color text,
  p_accent_color text
) returns table(school_id uuid, membership_role text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status jsonb;
  v_school_id uuid;
  v_slug text := lower(regexp_replace(coalesce(p_school_slug,''), '[^a-z0-9]+', '-', 'g'));
  v_cols text[];
  v_vals text[];
  v_sql text;
  v_existing_school uuid;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  v_status := public.dreem_bootstrap_status();
  if coalesce(v_status->>'mode','') = 'approved' then
    school_id := (v_status->>'schoolId')::uuid;
    membership_role := coalesce(v_status->>'role','platform_founder');
    return next;
    return;
  end if;

  if coalesce((v_status->>'canBootstrap')::boolean,false) is false then
    raise exception 'Founder bootstrap is not available for this account.';
  end if;
  if nullif(trim(p_school_name),'') is null then
    raise exception 'School name is required.';
  end if;
  if v_slug = '' then
    raise exception 'School slug is required.';
  end if;
  if p_subsystem not in ('anglophone','francophone','bilingual') then
    raise exception 'Subsystem must be anglophone, francophone or bilingual.';
  end if;

  execute 'select id from public.schools where slug = $1 limit 1' into v_existing_school using v_slug;
  if v_existing_school is not null then
    v_school_id := v_existing_school;
  else
    v_cols := array['name'];
    v_vals := array['$1'];
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='schools' and column_name='slug') then
      v_cols := array_append(v_cols,'slug');
      v_vals := array_append(v_vals,'$2');
    end if;
    v_sql := format('insert into public.schools(%s) values(%s) returning id', array_to_string(v_cols,','), array_to_string(v_vals,','));
    execute v_sql into v_school_id using p_school_name, v_slug;
  end if;

  update public.dreem_school_memberships
     set role = 'platform_founder', status = 'approved'
   where profile_id = v_actor and school_id = v_school_id;
  if not found then
    insert into public.dreem_school_memberships(profile_id, school_id, role, status)
    values (v_actor, v_school_id, 'platform_founder', 'approved');
  end if;

  insert into public.dreem_school_brands(
    school_id, short_name, motto, address_line, city, subsystem,
    primary_color, accent_color, receipt_prefix, student_id_prefix,
    timezone, currency
  ) values (
    v_school_id, p_short_name, coalesce(p_motto,''), '', coalesce(p_city,''), p_subsystem,
    p_primary_color, p_accent_color, p_receipt_prefix, p_student_id_prefix,
    'Africa/Douala', 'XAF'
  )
  on conflict (school_id) do update set
    short_name = excluded.short_name, motto = excluded.motto,
    address_line = excluded.address_line, city = excluded.city,
    subsystem = excluded.subsystem, primary_color = excluded.primary_color,
    accent_color = excluded.accent_color, receipt_prefix = excluded.receipt_prefix,
    student_id_prefix = excluded.student_id_prefix, timezone = excluded.timezone,
    currency = excluded.currency, updated_at = now();

  insert into public.audit_events(school_id, actor_id, action, entity_type, entity_id, detail)
  values (v_school_id, v_actor, 'FOUNDER_BOOTSTRAP', 'schools', v_school_id,
    jsonb_build_object('school_name', p_school_name, 'slug', v_slug, 'role', 'platform_founder'));

  school_id := v_school_id;
  membership_role := 'platform_founder';
  return next;
end;
$$;

revoke all on function public.dreem_bootstrap_school(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.dreem_bootstrap_school(text,text,text,text,text,text,text,text,text,text) to authenticated;
