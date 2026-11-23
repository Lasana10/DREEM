-- Enforce human physical-ID attestation at the database boundary, not only in the gate UI.
-- Existing release RPCs insert into this immutable event table; all inserts must satisfy
-- this check. Denials remain possible without verified collector identity.
create or replace function private.dreem_require_release_identity_attestation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.decision='released' and (
   coalesce(new.evidence->>'identity_checked','false') <> 'true'
   or coalesce(new.evidence->>'identity_method','') not in ('school_photo','physical_photo_id')
   or coalesce(new.evidence->>'capture','') <> 'gate_scanner'
 ) then
  raise exception 'DO NOT RELEASE: physical collector identity verification and evidence attestation are mandatory';
 end if;
 return new;
end;
$$;
revoke all on function private.dreem_require_release_identity_attestation() from public,anon,authenticated;
drop trigger if exists dreem_release_requires_identity_attestation on public.dreem_learner_release_events;
create trigger dreem_release_requires_identity_attestation
 before insert on public.dreem_learner_release_events
 for each row execute function private.dreem_require_release_identity_attestation();
