do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and p.proname <> 'dreem_acknowledge_payment'
  loop
    execute format('revoke execute on function %I.%I(%s) from public',r.schema_name,r.function_name,r.identity_args);
    execute format('revoke execute on function %I.%I(%s) from anon',r.schema_name,r.function_name,r.identity_args);
    execute format('grant execute on function %I.%I(%s) to authenticated',r.schema_name,r.function_name,r.identity_args);
    execute format('grant execute on function %I.%I(%s) to service_role',r.schema_name,r.function_name,r.identity_args);
  end loop;
end $$;

revoke all on table public.dreem_offline_operation_receipts from anon;
grant select on table public.dreem_offline_operation_receipts to authenticated;

drop policy if exists "actors and institutional reviewers read offline receipts" on public.dreem_offline_operation_receipts;
create policy "actors and institutional reviewers read offline receipts"
on public.dreem_offline_operation_receipts
for select to authenticated
using (
  actor_id=(select auth.uid())
  or private.dreem_has_role(school_id,array['leadership','support'])
);
