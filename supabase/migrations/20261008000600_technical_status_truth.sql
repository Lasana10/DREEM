drop policy if exists dreem_acceptance_evidence_read on public.dreem_acceptance_evidence;
create policy dreem_acceptance_evidence_read on public.dreem_acceptance_evidence
for select to authenticated using(
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','auditor','accountant','it_admin'])
  or public.dreem_has_authority(school_id,'technical_operations')
);

create or replace function public.dreem_technical_status()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_school uuid;
begin
  select m.school_id into v_school
  from public.dreem_school_memberships m
  where m.profile_id=(select auth.uid())
    and m.status='approved'
    and (m.role='it_admin' or public.dreem_has_authority(m.school_id,'technical_operations'))
  limit 1;

  if v_school is null then raise exception 'Technical operations authority is required.'; end if;

  return jsonb_build_object(
    'school_id',v_school,
    'queued_notifications',(select count(*) from public.dreem_notification_deliveries n where n.school_id=v_school and n.status in ('queued','retrying')),
    'failed_notifications',(select count(*) from public.dreem_notification_deliveries n where n.school_id=v_school and n.status='failed'),
    'delivered_notifications',(select count(*) from public.dreem_notification_deliveries n where n.school_id=v_school and n.status in ('delivered','acknowledged')),
    'offline_receipts_accepted',(select count(*) from public.dreem_offline_operation_receipts o where o.school_id=v_school and o.status='accepted'),
    'offline_receipts_rejected',(select count(*) from public.dreem_offline_operation_receipts o where o.school_id=v_school and o.status='rejected'),
    'failed_acceptance_checks',(select count(*) from public.dreem_acceptance_evidence e where e.school_id=v_school and e.status in ('failed','blocked')),
    'approved_memberships',(select count(*) from public.dreem_school_memberships m where m.school_id=v_school and m.status='approved'),
    'generated_at',now()
  );
end;
$$;

revoke all on function public.dreem_technical_status() from public,anon;
grant execute on function public.dreem_technical_status() to authenticated;