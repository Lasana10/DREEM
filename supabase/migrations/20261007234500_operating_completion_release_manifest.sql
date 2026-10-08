create or replace function public.dreem_release_manifest()
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select case
    when (select auth.uid()) is null then jsonb_build_object('available',false)
    else jsonb_build_object(
      'available',true,
      'product','DREEM',
      'release_contract','operating-completion-v12',
      'database_contract','20261007221751',
      'edge_contract',jsonb_build_object(
        'provision-access-user',2,
        'update-access-status',2,
        'dispatch-notifications',1,
        'capture-institution-pulse',1,
        'process-policy-engine',1,
        'notification-delivery-webhook',1
      ),
      'capabilities',jsonb_build_object(
        'curriculum_provenance','verified',
        'teacher_curriculum_review','verified',
        'notification_acknowledgement','verified',
        'notification_provider_delivery','partial',
        'automatic_document_extraction','blocked_external',
        'frontend_deployment_sha','requires_build_stamp'
      ),
      'generated_at',now()
    )
  end;
$$;

revoke all on function public.dreem_release_manifest() from public,anon;
grant execute on function public.dreem_release_manifest() to authenticated,service_role;