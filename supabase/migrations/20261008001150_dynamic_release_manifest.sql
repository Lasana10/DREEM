create or replace function public.dreem_release_manifest()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_db_contract text;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('available',false);
  end if;

  select max(m.version)::text into v_db_contract
  from supabase_migrations.schema_migrations m;

  return jsonb_build_object(
    'available',true,
    'product','DREEM',
    'release_contract','operating-completion-v12-final',
    'database_contract',coalesce(v_db_contract,'unavailable'),
    'edge_contract',jsonb_build_object(
      'provision-access-user',2,
      'update-access-status',2,
      'dispatch-notifications',1,
      'capture-institution-pulse',1,
      'process-policy-engine',1,
      'notification-delivery-webhook',1
    ),
    'capabilities',jsonb_build_object(
      'connected_school_day','verified',
      'cash_reconciliation_chain','verified',
      'offline_exactly_once','verified',
      'curriculum_provenance','verified',
      'teacher_curriculum_review','verified',
      'unauthorized_pickup_block','verified',
      'suspended_staff_denial','verified',
      'recovery_export_integrity','verified',
      'notification_acknowledgement','verified',
      'notification_provider_delivery','partial_external',
      'automatic_document_extraction','blocked_external',
      'destructive_restore_rehearsal','requires_isolated_target',
      'frontend_deployment_sha','requires_build_stamp'
    ),
    'generated_at',now()
  );
end;
$$;

revoke all on function public.dreem_release_manifest() from public,anon;
grant execute on function public.dreem_release_manifest() to authenticated,service_role;