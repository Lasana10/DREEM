import type {WorkspaceData} from "./repository";
import type {WorkspaceView} from "./access";
import {canAuthority,canOpenView} from "./access";

export type WorkLane="needs"|"waiting"|"done";
export type RoleWorkTask={id:string;lane:WorkLane;title:string;detail:string;count:number;view:WorkspaceView;priority:"urgent"|"normal"};
const task=(id:string,lane:WorkLane,title:string,detail:string,count:number,view:WorkspaceView,priority:RoleWorkTask["priority"]="normal"):RoleWorkTask=>({id,lane,title,detail,count,view,priority});

/** Evidence-backed role queues: visible work is never confused with approval authority. */
export function roleWorkQueues(workspace:WorkspaceData):RoleWorkTask[]{
 const {viewer,academics,admissions,finance,transport,cases}=workspace;
 const owned=(scope:Parameters<typeof canAuthority>[1])=>canAuthority(viewer,scope);
 const rows:RoleWorkTask[]=[];
 const add=(row:RoleWorkTask)=>{if(row.count>0&&canOpenView(viewer,row.view))rows.push(row);};
 const reviewAcademics=owned("academics_approval");
 const deliverAcademics=owned("academics_delivery");
 const decideAdmissions=owned("admissions_decision");
 const prepareAdmissions=owned("admissions_intake");
 if(reviewAcademics){
  add(task("lesson-approval","needs","Review submitted lesson plans","Teachers have submitted lesson evidence awaiting independent academic review.",academics.lessonPlans.filter(p=>p.status==="submitted").length,"academics"));
  add(task("assessment-moderation","needs","Moderate assessments","Submitted marks need independent review before publication.",academics.assessments.filter(a=>a.status==="submitted").length,"academics"));
  add(task("academic-reviewed","done","Reviewed lesson plans","Previously reviewed teaching evidence.",academics.lessonPlans.filter(p=>p.status==="reviewed").length,"academics"));
  add(task("academic-published","done","Published assessment results","Assessments already published after approval.",academics.assessments.filter(a=>a.status==="published").length,"academics"));
 }
 if(deliverAcademics&&viewer.id){
  const mine=academics.assignments.filter(a=>a.teacherUserId===viewer.id).map(a=>a.id);
  const mineIds=new Set(mine);
  const ownPlans=academics.lessonPlans.filter(p=>p.createdBy===viewer.id&&mineIds.has(p.assignmentId));
  const ownAssessments=academics.assessments.filter(a=>a.createdBy===viewer.id);
  const assignmentIds=new Set(academics.assignmentsForLearners.filter(a=>mineIds.has(a.teachingAssignmentId)).map(a=>a.id));
  const submissions=academics.assignmentSubmissions.filter(s=>assignmentIds.has(s.assignmentId));
  add(task("teacher-grading","needs","Review pupil submissions","Submitted pupil work from your own teaching assignments.",submissions.filter(s=>s.status==="submitted"||s.status==="late").length,"learning"));
  add(task("teacher-returned","needs","Revise returned lesson plans","Academic reviewers have requested changes to your plans.",ownPlans.filter(p=>p.status==="returned").length,"learning"));
  add(task("teacher-awaiting","waiting","Teaching plans awaiting review","Plans you submitted for independent review.",ownPlans.filter(p=>p.status==="submitted").length,"learning"));
  add(task("teacher-assessment-awaiting","waiting","Assessments awaiting moderation","Your submitted assessments awaiting independent approval.",ownAssessments.filter(a=>a.status==="submitted").length,"learning"));
  add(task("teacher-reviewed","done","Teaching plans reviewed","Your reviewed lesson plans.",ownPlans.filter(p=>p.status==="reviewed").length,"learning"));
  add(task("teacher-graded","done","Pupil work graded","Graded submissions from your own assignments.",submissions.filter(s=>s.status==="graded").length,"learning"));
 }
 if(decideAdmissions){
  add(task("admissions-decision","needs","Admissions awaiting decision","Applications requiring the authorised admissions decision.",admissions.filter(a=>["under_review","interview","offered","waitlisted"].includes(a.status)).length,"admissions"));
  add(task("admissions-decided","done","Admissions decisions completed","Applications accepted, enrolled or declined.",admissions.filter(a=>["accepted","enrolled","rejected"].includes(a.status)).length,"admissions"));
 }
 if(prepareAdmissions){
  add(task("admissions-documents","needs","Complete admission files","Applications requiring administrative preparation or missing documents.",admissions.filter(a=>["submitted","documents_pending"].includes(a.status)).length,"admissions"));
  if(!decideAdmissions)add(task("admissions-waiting","waiting","Applications with decision makers","Prepared applications awaiting admissions leadership.",admissions.filter(a=>["under_review","interview","offered","waitlisted"].includes(a.status)).length,"admissions"));
 }
 if(owned("finance_approval")){
  add(task("finance-exceptions","needs","Review finance exceptions","Financial exceptions require independent review.",finance.openExceptions,"finance","urgent"));
  add(task("finance-settlement","waiting","Cash awaiting confirmation","Received cash still awaits approved accounting or deposit evidence.",finance.cashAwaitingDeposit>0?1:0,"finance"));
 }
 if(owned("transport_management")){
  add(task("transport-delays","needs","Review delayed journeys","Transport exceptions require the route manager's follow-up.",transport.trips.filter(t=>t.status==="delayed").length,"transport","urgent"));
  add(task("transport-awaiting","waiting","Dispatched routes","Journeys awaiting departure or completion.",transport.trips.filter(t=>t.status==="dispatched"||t.status==="in_progress").length,"transport"));
  add(task("transport-completed","done","Routes completed","Journeys recorded as completed.",transport.trips.filter(t=>t.status==="completed").length,"transport"));
 }
 if(owned("safeguarding")||owned("institutional_leadership")){
  add(task("urgent-care","needs","Urgent learner safeguarding","Unresolved urgent or critical learner concerns for authorised review.",cases.filter(c=>!["resolved","closed"].includes(c.status)&&["urgent","critical"].includes(c.priority)).length,"care","urgent"));
 }
 return rows;
}
