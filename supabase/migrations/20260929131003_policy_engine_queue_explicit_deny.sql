create policy dreem_policy_queue_no_direct_access
on public.dreem_policy_evaluation_queue
for all to authenticated
using (false)
with check (false);
