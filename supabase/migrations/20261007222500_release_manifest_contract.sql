create or replace function public.dreem_release_manifest()
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select case
    when (select auth.uid()) is null then
      jsonb_build_object('available',false)
    else
      jsonb_build_object(
        'available',true,
        'product','DREEM',
        'release_contract','operating-loop-v11',
        'database_contract','20261007211811',
        'edge_contract',jsonb_build_object(
          'provision-access-user',2,
          'update-access-status',2,
          'dispatch-notifications',1,
          'capture-institution-pulse',1,
          'process-policy-engine',1
        ),
        'generated_at',now()
      )
  end;
$$;

revoke all on function public.dreem_release_manifest() from public, anon;
grant execute on function public.dreem_release_manifest() to authenticated, service_role;