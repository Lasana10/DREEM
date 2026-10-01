import type {
  AcademicOperations,
  AdmissionSummary,
  CommunitySignal,
  FinanceSummary,
  LearnerSummary,
  StudentCaseSummary,
  TransportOperations,
} from "./types";

export interface RecommendedPolicyProfile {
  attendanceAttentionBelow:number;
  learningAttentionBelow:number;
  repeatedMissingWork:number;
  delayedTransportNeedsFollowUp:boolean;
  acceptedAdmissionFollowUp:boolean;
}

export const dreemRecommendedPolicy:RecommendedPolicyProfile={
  attendanceAttentionBelow:80,
  learningAttentionBelow:60,
  repeatedMissingWork:2,
  delayedTransportNeedsFollowUp:true,
  acceptedAdmissionFollowUp:true,
};

export type PolicyArea="learner"|"learning"|"finance"|"transport"|"admissions"|"care"|"communication";
export type PolicySeverity="critical"|"warning"|"info";

export interface PolicyAction {
  id:string;
  area:PolicyArea;
  severity:PolicySeverity;
  title:string;
  reason:string;
  owner:string;
  nextAction:string;
  evidenceCount:number;
  learnerId?:string;
  learnerName?:string;
  automaticAction:"none"|"notify_only";
}

export interface OperationalEvidence {
  learners:LearnerSummary[];
  academics:AcademicOperations;
  finance:FinanceSummary;
  transport:TransportOperations;
  admissions:AdmissionSummary[];
  signals:CommunitySignal[];
  cases:StudentCaseSummary[];
}

function overdueMissingWork(learner:LearnerSummary,academics:AcademicOperations,now:Date){
  const submitted=new Set(
    academics.assignmentSubmissions
      .filter(item=>item.studentId===learner.id&&item.status!=="needs_revision")
      .map(item=>item.assignmentId),
  );
  return academics.assignmentsForLearners.filter(item=>
    item.status==="published"&&
    item.className===learner.className&&
    new Date(item.dueAt).getTime()<now.getTime()&&
    !submitted.has(item.id),
  );
}

export function evaluateRecommendedPolicies(
  evidence:OperationalEvidence,
  profile:RecommendedPolicyProfile=dreemRecommendedPolicy,
  now=new Date(),
):PolicyAction[]{
  const actions:PolicyAction[]=[];
  for(const learner of evidence.learners){
    const attendanceLow=learner.attendance<profile.attendanceAttentionBelow;
    const learningLow=learner.mastery<profile.learningAttentionBelow;
    if(attendanceLow&&learningLow){
      actions.push({
        id:"learner-combined:"+learner.id,area:"learner",severity:"warning",
        title:learner.name+" needs a closer look",
        reason:"Attendance and learning results are both below the school attention level.",
        owner:"Academic / student support",nextAction:"Review the learner and decide whether to open an intervention.",
        evidenceCount:2,learnerId:learner.id,learnerName:learner.name,automaticAction:"notify_only",
      });
    }else if(attendanceLow){
      actions.push({
        id:"learner-attendance:"+learner.id,area:"learner",severity:"info",
        title:"Check "+learner.name+"'s attendance",
        reason:"Attendance is "+Math.round(learner.attendance)+"%, below the recommended attention level.",
        owner:"Class teacher / student affairs",nextAction:"Check the attendance pattern and contact the guardian when appropriate.",
        evidenceCount:1,learnerId:learner.id,learnerName:learner.name,automaticAction:"notify_only",
      });
    }else if(learningLow){
      actions.push({
        id:"learner-learning:"+learner.id,area:"learning",severity:"info",
        title:learner.name+" may need learning support",
        reason:"Current learning mastery is "+Math.round(learner.mastery)+"%, below the recommended attention level.",
        owner:"Teacher / academic team",nextAction:"Review recent work and decide the right support.",
        evidenceCount:1,learnerId:learner.id,learnerName:learner.name,automaticAction:"notify_only",
      });
    }
    const missing=overdueMissingWork(learner,evidence.academics,now);
    if(missing.length>=profile.repeatedMissingWork){
      actions.push({
        id:"missing-work:"+learner.id,area:"learning",severity:"warning",
        title:learner.name+" has repeated missing work",
        reason:missing.length+" released assignments are past due without a recorded submission.",
        owner:"Teacher",nextAction:"Review the missing work first, then involve the guardian if the pattern continues.",
        evidenceCount:missing.length,learnerId:learner.id,learnerName:learner.name,automaticAction:"notify_only",
      });
    }
  }

  if(evidence.finance.openExceptions>0)actions.push({
    id:"finance-difference",area:"finance",severity:"critical",
    title:evidence.finance.openExceptions+" payment difference"+(evidence.finance.openExceptions===1?"":"s")+" need checking",
    reason:evidence.finance.openExceptionValue.toLocaleString("fr-FR")+" FCFA is currently unresolved.",
    owner:"Accountant",nextAction:"Compare the payment records and record the independent decision.",
    evidenceCount:evidence.finance.openExceptions,automaticAction:"none",
  });
  if(evidence.finance.cashAwaitingDeposit>0)actions.push({
    id:"finance-cash",area:"finance",severity:"warning",
    title:evidence.finance.cashAwaitingDeposit.toLocaleString("fr-FR")+" FCFA still needs school confirmation",
    reason:"The money has been collected but the deposit and school confirmation are not complete.",
    owner:"Bursar + accountant",nextAction:"Complete the deposit and have it confirmed.",
    evidenceCount:1,automaticAction:"none",
  });

  if(profile.delayedTransportNeedsFollowUp){
    const delayed=evidence.transport.trips.filter(item=>item.status==="delayed");
    if(delayed.length)actions.push({
      id:"transport-delay",area:"transport",severity:"warning",
      title:delayed.length+" delayed school journey"+(delayed.length===1?"":"s"),
      reason:"Families and transport staff may need a current journey update.",
      owner:"Transport manager",nextAction:"Check the delay, update the journey and notify affected families when needed.",
      evidenceCount:delayed.length,automaticAction:"notify_only",
    });
  }

  if(profile.acceptedAdmissionFollowUp){
    const ready=evidence.admissions.filter(item=>item.status==="accepted"&&!item.enrolledStudentId);
    if(ready.length)actions.push({
      id:"accepted-admissions",area:"admissions",severity:"info",
      title:ready.length+" accepted applicant"+(ready.length===1?" is":"s are")+" ready for enrolment",
      reason:"The admission decision is complete but the learner record has not yet been created.",
      owner:"Admissions",nextAction:"Complete enrolment so learner, guardian and downstream school records can continue.",
      evidenceCount:ready.length,automaticAction:"none",
    });
  }

  const urgentCases=evidence.cases.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority));
  if(urgentCases.length)actions.push({
    id:"urgent-care",area:"care",severity:"critical",
    title:urgentCases.length+" serious learner care case"+(urgentCases.length===1?"":"s"),
    reason:"These learner-care cases are still open and time-sensitive.",
    owner:"Principal / authorised care role",nextAction:"Open the case and record the next action.",
    evidenceCount:urgentCases.length,automaticAction:"none",
  });

  const urgentSignals=evidence.signals.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","safeguarding"].includes(item.severity));
  if(urgentSignals.length)actions.push({
    id:"urgent-signals",area:"communication",severity:"critical",
    title:urgentSignals.length+" urgent school message"+(urgentSignals.length===1?"":"s")+" need follow-up",
    reason:"A parent, learner or staff message is still unresolved.",
    owner:"School office / lead",nextAction:"Route the message to the right owner and record the follow-up.",
    evidenceCount:urgentSignals.length,automaticAction:"notify_only",
  });

  return actions.sort((a,b)=>{
    const rank={critical:0,warning:1,info:2};
    return rank[a.severity]-rank[b.severity]||b.evidenceCount-a.evidenceCount;
  });
}

export type FlowHealthStatus="healthy"|"attention"|"broken";
export interface FlowHealthItem{
  id:string;
  status:FlowHealthStatus;
  title:string;
  detail:string;
  owner:string;
  evidenceCount:number;
}

export function buildInstitutionFlowHealth(evidence:OperationalEvidence):FlowHealthItem[]{
  const items:FlowHealthItem[]=[];
  const learnerIds=new Set(evidence.learners.map(item=>item.id));
  const assignmentIds=new Set(evidence.academics.assignmentsForLearners.map(item=>item.id));

  const brokenAdmissions=evidence.admissions.filter(item=>item.status==="enrolled"&&!!item.enrolledStudentId&&!learnerIds.has(item.enrolledStudentId));
  if(brokenAdmissions.length)items.push({
    id:"admission-learner-link",status:"broken",title:"Enrolment did not finish",
    detail:brokenAdmissions.length+" enrolled admission record"+(brokenAdmissions.length===1?" points":"s point")+" to a learner that is not present in the current school record.",
    owner:"Admissions / school admin",evidenceCount:brokenAdmissions.length,
  });

  const enrolledWithoutFinance=evidence.admissions.filter(item=>{
    if(item.status!=="enrolled"||!item.enrolledStudentId)return false;
    const learner=evidence.learners.find(candidate=>candidate.id===item.enrolledStudentId);
    return !!learner&&!learner.feeAccountId;
  });
  if(enrolledWithoutFinance.length)items.push({
    id:"enrolment-finance-link",status:"broken",title:"Enrolment did not reach learner finance",
    detail:enrolledWithoutFinance.length+" enrolled learner"+(enrolledWithoutFinance.length===1?" is":"s are")+" missing the expected fee account.",
    owner:"Admissions / finance admin",evidenceCount:enrolledWithoutFinance.length,
  });

  const brokenTransport=evidence.transport.assignments.filter(item=>item.status==="active"&&!learnerIds.has(item.studentId));
  if(brokenTransport.length)items.push({
    id:"transport-learner-link",status:"broken",title:"Transport link needs fixing",
    detail:brokenTransport.length+" active transport assignment"+(brokenTransport.length===1?" references":"s reference")+" a learner missing from the current school record.",
    owner:"Transport manager / school admin",evidenceCount:brokenTransport.length,
  });

  const brokenSubmissions=evidence.academics.assignmentSubmissions.filter(item=>!learnerIds.has(item.studentId)||!assignmentIds.has(item.assignmentId));
  if(brokenSubmissions.length)items.push({
    id:"learning-submission-link",status:"broken",title:"School work link needs fixing",
    detail:brokenSubmissions.length+" submitted work record"+(brokenSubmissions.length===1?" is":"s are")+" missing its learner or school-work link.",
    owner:"Academic admin",evidenceCount:brokenSubmissions.length,
  });

  const brokenReports=evidence.academics.reportCards.filter(item=>item.status==="published"&&!learnerIds.has(item.studentId));
  if(brokenReports.length)items.push({
    id:"report-learner-link",status:"broken",title:"Published report link needs repair",
    detail:brokenReports.length+" published report"+(brokenReports.length===1?" is":"s are")+" not linked to a learner in the current school record.",
    owner:"Academic admin",evidenceCount:brokenReports.length,
  });

  const accepted=evidence.admissions.filter(item=>item.status==="accepted"&&!item.enrolledStudentId);
  if(accepted.length)items.push({
    id:"admission-ready",status:"attention",title:"Accepted admissions waiting for enrolment",
    detail:accepted.length+" applicant"+(accepted.length===1?" is":"s are")+" accepted and ready to become a learner record.",
    owner:"Admissions",evidenceCount:accepted.length,
  });

  if(!items.some(item=>item.status==="broken"))items.push({
    id:"core-links-healthy",status:"healthy",title:"Core school processes are connected",
    detail:"Admissions, learner records, transport, school work and reports are currently connected.",
    owner:"DREEM",evidenceCount:evidence.learners.length,
  });
  return items;
}
