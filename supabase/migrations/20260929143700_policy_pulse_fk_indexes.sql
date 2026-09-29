-- Cover new policy/pulse foreign-key paths used by cleanup, joins and audit lookups.

create index if not exists dreem_institution_pulse_created_by_idx
  on public.dreem_institution_pulse_snapshots(created_by);

create index if not exists dreem_policy_queue_student_idx
  on public.dreem_policy_evaluation_queue(student_id);

create index if not exists dreem_policy_findings_acknowledged_by_idx
  on public.dreem_policy_findings(acknowledged_by);

create index if not exists dreem_policy_findings_rule_idx
  on public.dreem_policy_findings(rule_id);

create index if not exists dreem_policy_rules_created_by_idx
  on public.dreem_policy_rules(created_by);

create index if not exists dreem_service_eligibility_finding_idx
  on public.dreem_service_eligibility(finding_id);

create index if not exists dreem_service_eligibility_updated_by_idx
  on public.dreem_service_eligibility(updated_by);
