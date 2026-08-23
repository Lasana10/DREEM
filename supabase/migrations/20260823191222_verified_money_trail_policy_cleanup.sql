-- Keep payment-rail read and management policies mutually exclusive so every
-- SELECT evaluates one permissive policy only.

drop policy if exists dreem_payment_rails_manage on public.dreem_payment_rails;

create policy dreem_payment_rails_insert
on public.dreem_payment_rails
for insert
to authenticated
with check ((select private.dreem_has_role(school_id,array['leadership','accountant'])));

create policy dreem_payment_rails_update
on public.dreem_payment_rails
for update
to authenticated
using ((select private.dreem_has_role(school_id,array['leadership','accountant'])))
with check ((select private.dreem_has_role(school_id,array['leadership','accountant'])));
