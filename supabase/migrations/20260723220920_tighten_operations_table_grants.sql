revoke all privileges on public.workflow_corrections from authenticated;
revoke all privileges on public.bursar_liabilities from authenticated;
revoke all privileges on public.bursar_settlements from authenticated;
revoke all privileges on public.students from authenticated;
revoke all privileges on public.fee_accounts from authenticated;

grant select, insert on public.workflow_corrections to authenticated;
grant select, insert on public.bursar_liabilities to authenticated;
grant select, insert on public.bursar_settlements to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.fee_accounts to authenticated;
