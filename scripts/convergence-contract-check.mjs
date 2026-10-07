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
