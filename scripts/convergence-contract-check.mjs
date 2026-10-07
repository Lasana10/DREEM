import fs from "node:fs";

const failures=[];
const read=(file)=>fs.readFileSync(file,"utf8");
const requireFile=(file)=>{if(!fs.existsSync(file))failures.push(`Missing convergence behavior: ${file}`);return fs.existsSync(file)?read(file):"";};
const requireTokens=(file,tokens)=>{const source=requireFile(file);for(const token of tokens)if(!source.includes(token))failures.push(`${file} is missing required product behavior: ${token}`);};

requireTokens("src/App.tsx",["LearnerDirectoryWorkspace","initialLearners={workspace.learners}"]);
requireTokens("src/lib/learnerDirectory.ts",["count:\"exact\"",".range(from,to)","full_name.ilike","matricule.ilike","class_name.ilike"]);
requireTokens("src/components/LearnerDirectoryWorkspace.tsx",["Search name, matricule or class","Previous","Next","of {total}"]);
requireTokens("src/components/OperationalWorkflows.tsx",["ACTIVE STAFF","PAUSED ACCESS","\"suspended\"","Restore access","userFacingError"]);
requireTokens("src/components/BursarCollectionWorkspace.tsx",["payment-receipt","Print receipt","receiptNumber","paymentReference","RemoteLearnerPicker","userFacingError"]);
requireTokens("src/components/LearnersWorkspace.tsx",["Edit learner or guardian details","updateLearnerIdentity","updateGuardianProfile","userFacingError"]);
requireTokens("src/components/PickupAuthorizationStudio.tsx",["RemoteLearnerPicker","Pickup Circle","userFacingError"]);
requireTokens("src/components/AdmissionsView.tsx",["userFacingError","RECOMMENDED NEXT ACTION","Decision note"]);
requireTokens("src/components/TeacherClassroomWorkspace.tsx",["Teach","Attendance","Assess","Resources","outcomeId","loadTeacherClassRoster","userFacingError"]);
requireTokens("src/lib/curriculumLessonPlans.ts",["dreem_record_lesson_plan_with_outcomes","p_outcome_ids","Choose at least one curriculum outcome"]);
requireTokens("src/lib/teacherOffline.ts",["recordCurriculumLessonPlan","CurriculumLessonPlanCommand"]);
requireTokens("supabase/migrations/20261006144903_link_teacher_lesson_plans_to_curriculum.sql",["dreem_lesson_plan_outcomes","p_outcome_ids","grant execute"]);
requireTokens("src/components/AcademicJourneyWorkspace.tsx",["RemoteLearnerPicker","userFacingError","Authorised publisher"]);
requireTokens("src/components/TransportManagerWorkspace.tsx",["Live journeys","RemoteLearnerPicker","userFacingError","TRANSPORT · TODAY"]);
requireTokens("src/components/DriverWorkspace.tsx",["progressTransportTripResilient","Offline · saving locally","userFacingError"]);
requireTokens("src/components/PaymentRailStudio.tsx",["PAYMENT METHODS","userFacingError"]);
requireTokens("src/components/PaymentAcknowledgement.tsx",["One-time confirmation","userFacingError"]);
requireTokens("src/components/InstitutionAuthorityStudio.tsx",["ACCESS PREVIEW","userFacingError"]);
requireTokens("src/components/SchoolStudioView.tsx",["YearTransitionStudio","mergeStarter","userFacingError"]);
requireTokens("src/components/YearTransitionStudio.tsx",["Preview transition","Move ${preview.affectedLearners}","userFacingError"]);
requireTokens("src/lib/yearTransition.ts",["dreem_preview_class_transition","dreem_execute_class_transition"]);
requireTokens("src/lib/offlineOutbox.ts",["isRetryableRemoteFailure","OfflineReplayReceipt","blocked","conflict"]);
requireTokens("src/lib/teacherOffline.ts",["dreem_ingest_teacher_offline_operation","isRetryableRemoteFailure"]);
requireTokens("src/components/SecurityGateView.tsx",["DO NOT RELEASE","isRetryableRemoteFailure","queueOfflineGateDenial"]);
requireTokens("src/lib/releaseManifest.ts",["dreem_release_manifest","frontendCommit","Release unverified"]);
requireTokens("src/components/SchoolRecoveryPanel.tsx",["Download verified recovery bundle","Verify a recovery file","does not overwrite the live school"]);
requireTokens("src/lib/schoolRecovery.ts",["dreem_export_school_snapshot","dreem_verify_school_snapshot"]);
requireTokens("src/lib/languageContext.ts",["dreem-language","LanguageContext"]);
requireTokens("src/lib/LanguageProvider.tsx",["LanguageContext.Provider","localStorage.setItem"]);
requireTokens("src/components/Shell.tsx",["useLanguage","Passer en anglais","Trouver un espace ou une tâche"]);
requireTokens("src/components/CurriculumIntelligencePanel.tsx",["source provenance","teacher response","Record academic decision","Automatic extraction provider not connected"]);
requireTokens("src/components/TeacherClassroomWorkspace.tsx",["teacherReviewCurriculumProposal","Send review for academic approval","Preparation minutes saved"]);
requireTokens("src/lib/repository.ts",["dreem_propose_curriculum_outcome","dreem_teacher_review_curriculum_proposal","dreem_review_curriculum_proposal","dreem_acknowledge_notification_delivery"]);
requireTokens("src/components/NotificationDeliveryPanel.tsx",["MY DELIVERY RECEIPTS","Acknowledge","Queued, dispatched, delivered and acknowledged"]);
requireTokens("supabase/functions/notification-delivery-webhook/index.ts",["x-dreem-webhook-secret","delivered","failed"]);
requireTokens("supabase/migrations/20261007214847_it_role_and_technical_operations.sql",["it_admin","technical_operations"]);
requireTokens("supabase/migrations/20261007215323_it_authority_consistency.sql",["technical_operations","dreem_update_membership_status"]);
requireTokens("src/components/TechnicalOperationsHome.tsx",["IT · TODAY","RELEASE TRUTH","ACCEPTANCE EVIDENCE"]);
requireTokens("src/lib/technicalOperations.ts",["dreem_technical_status","dreem_acceptance_evidence"]);
requireTokens("src/lib/authority.ts",["technical_operations","it_admin"]);
requireTokens("src/lib/access.ts",["it_admin:[\"command\"]"]);
requireTokens("supabase/migrations/20261008000400_normalize_class_authorization.sql",["lower(trim(c.name))","lower(trim(coalesce(s.class_name"]);
requireTokens("supabase/migrations/20261008000750_fix_digest_schema_references.sql",["extensions.digest","dreem_verify_and_record_learner_release","dreem_export_school_snapshot"]);
requireTokens("supabase/migrations/20261008000850_fix_recovery_export_ordering_and_secrets.sql",["token_hash","to_jsonb(x)::text"]);
requireTokens("supabase/migrations/20261008000975_fix_assessment_marks_conflict_target.sql",["dreem_marks_assessment_id_student_id_key"]);
requireTokens("supabase/migrations/20261008000980_fix_assessment_summary_qualification.sql",["dm.assessment_id"]);
requireTokens("supabase/migrations/20261008001150_dynamic_release_manifest.sql",["operating-completion-v12-final","connected_school_day","max(m.version)"]);
requireTokens("supabase/migrations/20261008001000_connected_school_day_acceptance.sql",["attendance_recorded","support_case_closed","family_acknowledged"]);
requireTokens("supabase/migrations/20261008001050_suspended_staff_acceptance.sql",["suspended_staff_new_action_denied","false_success_records"]);



requireTokens("supabase/migrations/20261006151337_audited_learner_year_transitions.sql",["dreem_learner_placements","dreem_preview_class_transition","dreem_execute_class_transition"]);

const reachableSafeErrorFiles=[
  "src/components/AdmissionsView.tsx",
  "src/components/OperationalWorkflows.tsx",
  "src/components/LearnersWorkspace.tsx",
  "src/components/PickupAuthorizationStudio.tsx",
  "src/components/CredentialCardStudio.tsx",
  "src/components/PolicyStudio.tsx",
  "src/components/NotificationDeliveryPanel.tsx",
  "src/components/BursarCollectionWorkspace.tsx",
  "src/components/FinanceControlDesk.tsx",
  "src/components/PaymentRailStudio.tsx",
  "src/components/PaymentAcknowledgement.tsx",
  "src/components/StudentWorkspace.tsx",
  "src/components/FamilyLearningWorkspace.tsx",
  "src/components/CommunicationsWorkspace.tsx",
  "src/components/CareView.tsx",
  "src/components/TeacherClassroomWorkspace.tsx",
  "src/components/AcademicJourneyWorkspace.tsx",
  "src/components/TransportManagerWorkspace.tsx",
  "src/components/DriverWorkspace.tsx",
  "src/components/InstitutionAuthorityStudio.tsx",
  "src/components/SchoolStudioView.tsx",
  "src/components/YearTransitionStudio.tsx",
];
for(const file of reachableSafeErrorFiles){
  const source=requireFile(file);
  if(!source.includes("userFacingError"))failures.push(`Safe user error contract missing from ${file}`);
  for(const pattern of ["details?:unknown",'"Hint: "+','"Code: "+'])if(source.includes(pattern))failures.push(`Raw backend error construction returned in ${file}: ${pattern}`);
}

if(!read("src/App.tsx").includes("LearnerDirectoryWorkspace"))failures.push("People still depends only on the initial workspace learner snapshot");

if(failures.length){console.error(failures.join("\n"));process.exit(1)}
console.log("DREEM product convergence contract passed.");
