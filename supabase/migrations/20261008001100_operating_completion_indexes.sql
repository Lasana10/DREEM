create index if not exists dreem_acceptance_evidence_school_idx
  on public.dreem_acceptance_evidence(school_id,run_at desc);

create index if not exists dreem_curriculum_provenance_school_idx
  on public.dreem_curriculum_outcome_provenance(school_id);
create index if not exists dreem_curriculum_provenance_proposal_idx
  on public.dreem_curriculum_outcome_provenance(proposal_id);
create index if not exists dreem_curriculum_provenance_document_idx
  on public.dreem_curriculum_outcome_provenance(document_id);
create index if not exists dreem_curriculum_provenance_approved_by_idx
  on public.dreem_curriculum_outcome_provenance(approved_by);

create index if not exists dreem_curriculum_proposals_academic_year_idx
  on public.dreem_curriculum_proposals(academic_year_id);
create index if not exists dreem_curriculum_proposals_class_idx
  on public.dreem_curriculum_proposals(class_id);
create index if not exists dreem_curriculum_proposals_subject_idx
  on public.dreem_curriculum_proposals(subject_id);
create index if not exists dreem_curriculum_proposals_created_by_idx
  on public.dreem_curriculum_proposals(created_by);
create index if not exists dreem_curriculum_proposals_reviewed_by_idx
  on public.dreem_curriculum_proposals(reviewed_by);
create index if not exists dreem_curriculum_proposals_teacher_reviewed_by_idx
  on public.dreem_curriculum_proposals(teacher_reviewed_by);

create index if not exists dreem_curriculum_feedback_school_idx
  on public.dreem_curriculum_suggestion_feedback(school_id,created_at desc);
create index if not exists dreem_curriculum_feedback_proposal_idx
  on public.dreem_curriculum_suggestion_feedback(proposal_id);
create index if not exists dreem_curriculum_feedback_outcome_idx
  on public.dreem_curriculum_suggestion_feedback(outcome_id);
create index if not exists dreem_curriculum_feedback_teacher_idx
  on public.dreem_curriculum_suggestion_feedback(teacher_user_id,created_at desc);