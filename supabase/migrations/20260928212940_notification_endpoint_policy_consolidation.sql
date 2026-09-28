drop policy if exists "users manage own notification endpoints" on public.dreem_notification_endpoints;
drop policy if exists "school admins inspect notification endpoints" on public.dreem_notification_endpoints;

create policy "notification endpoints read"
on public.dreem_notification_endpoints
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.dreem_has_role(school_id,array['leadership','support'])
);

create policy "users insert own notification endpoints"
on public.dreem_notification_endpoints
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.dreem_is_member(school_id)
);

create policy "users update own notification endpoints"
on public.dreem_notification_endpoints
for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and private.dreem_is_member(school_id)
);

create policy "users delete own notification endpoints"
on public.dreem_notification_endpoints
for delete to authenticated
using (user_id=(select auth.uid()));
