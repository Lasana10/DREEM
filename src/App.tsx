import { useEffect, useState } from "react";
import AuthGate from "./components/AuthGate";
import AdmissionsView from "./components/AdmissionsView";
import AcademicJourneyWorkspace from "./components/AcademicJourneyWorkspace";
import TransportView from "./components/TransportView";
import TransportManagerWorkspace from "./components/TransportManagerWorkspace";
import DriverWorkspace from "./components/DriverWorkspace";
import SecurityGateView from "./components/SecurityGateView";
import BootstrapView from "./components/BootstrapView";
import CareView from "./components/CareView";
import CredentialCardStudio from "./components/CredentialCardStudio";
import FeedbackDialog from "./components/FeedbackDialog";
import CommunicationsWorkspace from "./components/CommunicationsWorkspace";
import OperationalWorkflowsView from "./components/OperationalWorkflows";
import SchoolCommandCentre from "./components/SchoolCommandCentre";
import SchoolContextPicker from "./components/SchoolContextPicker";
import Shell, { type ViewKey } from "./components/Shell";
import { CommandView } from "./components/Views";
import TeacherDevelopmentView from "./components/TeacherDevelopmentView";
import WorkspaceJourneyGuide from "./components/WorkspaceJourneyGuide";
import { SchoolStudioView } from "./components/SchoolStudioView";
import FinanceWorkspace from "./components/FinanceWorkspace";
import LearnersWorkspace from "./components/LearnersWorkspace";
import TeacherClassroomWorkspace from "./components/TeacherClassroomWorkspace";
import TeacherHome from "./components/TeacherHome";
import LearningWorkspace from "./components/LearningWorkspace";
import FamilyLearningWorkspace from "./components/FamilyLearningWorkspace";
import StudentWorkspace from "./components/StudentWorkspace";
import type { BootstrapStatus, CommunitySignal, Role } from "./domain/types";
import { buildOperationalPulse } from "./domain/rules";
import { bootstrapSchool, enrolLearner, inviteStaff, issueStudentCredential, loadBootstrapStatus, loadWorkspace, recordAssessment, recordAttendance, saveSchoolBrand, saveSchoolSetup, updateAccessStatus, updateSignalStatus, uploadSchoolLogo, type WorkspaceData } from "./lib/repository";
import { listApprovedSchoolContexts, selectActiveSchoolContext, type SchoolMembershipContext } from "./lib/schoolContext";
import { supabase } from "./lib/supabase";
import { applyRoleAppIdentity } from "./lib/roleApp";

const defaultViewByRole: Record<Role, ViewKey> = {
  platform_founder:"command",school_owner:"command",principal:"command",administrator:"command",academic_head:"command",
  bursar:"finance",accountant:"finance",teacher:"command",tutor:"learning",transport_manager:"transport",driver:"transport",security_guard:"transport",parent:"learning",student:"learning",auditor:"command",
};
const schoolLeadershipRoles:Role[]=["platform_founder","school_owner","principal","administrator","academic_head"];

function WorkspaceApp() {
  const [view, setView] = useState<ViewKey>("command");
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState("");
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [schoolChoices,setSchoolChoices]=useState<SchoolMembershipContext[]|null>(null);

  async function enterWorkspace(){
    const data=await loadWorkspace();applyRoleAppIdentity(data.viewer.role);setWorkspace(data);setView(defaultViewByRole[data.viewer.role]);setBootstrap(null);setSchoolChoices(null);setError("");
  }

  useEffect(() => {
    let active = true;
    async function hydrate() {
      try{
        const data = await loadWorkspace();
        if (active) { applyRoleAppIdentity(data.viewer.role); setWorkspace(data); setView(defaultViewByRole[data.viewer.role]); setBootstrap(null); setError(""); }
      }catch(reason){
        const message = reason instanceof Error ? reason.message : (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string" ? reason.message : "The school workspace could not be loaded.");
        if(message==="DREEM_SCHOOL_SELECTION_REQUIRED"){
          try{const contexts=await listApprovedSchoolContexts();if(active){setSchoolChoices(contexts.memberships);setError("");}}catch(inner){if(active)setError(inner instanceof Error?inner.message:"School choices could not be loaded.");}return;
        }
        if (/active school membership|attached to an active school/i.test(message)) {
          try{
            const bootstrapState = await loadBootstrapStatus();
            if (active) { setBootstrap(bootstrapState); setError(""); }
            return;
          }catch(innerReason){
            if (active) setError(innerReason instanceof Error ? innerReason.message : (innerReason && typeof innerReason === "object" && "message" in innerReason && typeof innerReason.message === "string" ? innerReason.message : message));
            return;
          }
        }
        if (active) setError(message);
      }
    }
    hydrate();
    return () => { active = false; };
  }, []);

  if(schoolChoices)return <SchoolContextPicker memberships={schoolChoices} onChoose={async schoolId=>{selectActiveSchoolContext(schoolId,schoolChoices);await enterWorkspace();}} onSignOut={async()=>{await supabase?.auth.signOut();}}/>;
  if (error) return <div className="auth-screen"><div className="auth-card"><strong>DREEM</strong><h1>Workspace unavailable</h1><p>{error}</p><button onClick={() => window.location.reload()}>Try again</button></div></div>;
  if (bootstrap) return <BootstrapView status={bootstrap} onSignOut={async()=>{await supabase?.auth.signOut();}} onBootstrap={async(payload)=>{await bootstrapSchool(payload);await enterWorkspace();}} />;
  if (!workspace) return <div className="auth-screen"><div className="auth-card"><strong>DREEM</strong><p>Preparing the school operating picture…</p></div></div>;

  const addSignal = (signal: CommunitySignal) => setWorkspace((current) => current ? { ...current, signals: [signal, ...current.signals] } : current);
  const saveBrand = async (brand: WorkspaceData["brand"]) => { const saved = await saveSchoolBrand(brand); setWorkspace((current) => current ? { ...current, brand:saved } : current); };
  const saveSetup = async (setup: WorkspaceData["setup"]) => { const saved = await saveSchoolSetup(setup); setWorkspace((current) => current ? { ...current, setup:saved } : current); };
  const refreshWorkspace = async () => setWorkspace(await loadWorkspace());
  const moveSignal = async (signalId: string, status: CommunitySignal["status"]) => { await updateSignalStatus(signalId,status); setWorkspace((current) => current ? { ...current, signals:current.signals.map(item=>item.id===signalId?{...item,status}:item) } : current); };
  const openFeedback = () => setFeedbackOpen(true);
  const familyLearning = workspace.viewer.role === "student" || workspace.viewer.role === "parent";
  const journeyViews:ViewKey[]=["admissions","finance","transport","care"];
  const roleOwnsCompactTransportCycle=["transport_manager","driver","security_guard"].includes(workspace.viewer.role);
  const showJourney=journeyViews.includes(view)&&!(view==="transport"&&roleOwnsCompactTransportCycle);
  const journey = showJourney ? <div className="content journey-guide-wrap"><WorkspaceJourneyGuide view={view} role={workspace.viewer.role}/></div> : null;
  const isSchoolLeadership=schoolLeadershipRoles.includes(workspace.viewer.role);

  return <>
    <Shell brand={workspace.brand} viewer={workspace.viewer} view={view} onView={setView} signalCount={workspace.signals.filter((item) => item.status === "new").length} onFeedback={openFeedback}>
      {journey}
      {view === "command" && (workspace.viewer.role === "teacher" ? <TeacherHome workspace={workspace} onNavigate={setView}/> : isSchoolLeadership ? <SchoolCommandCentre workspace={workspace} onNavigate={setView}/> : <CommandView learners={workspace.learners} finance={workspace.finance} pulse={buildOperationalPulse(workspace.learners,workspace.finance,workspace.signals,workspace.cases)} signals={workspace.signals} />)}
      {view === "admissions" && <AdmissionsView workspace={workspace} onRefresh={refreshWorkspace} onOpenLearners={()=>setView("learners")}/>}
      {view === "operations" && (workspace.viewer.role==="teacher"?<TeacherClassroomWorkspace workspace={workspace} onRefresh={refreshWorkspace}/>:<OperationalWorkflowsView workspace={workspace} onInviteStaff={inviteStaff} onUpdateAccess={updateAccessStatus} onEnrolLearner={enrolLearner} onIssueCredential={issueStudentCredential} onRecordAttendance={recordAttendance} onRecordAssessment={recordAssessment} onRefresh={refreshWorkspace} />)}
      {view === "academics" && <AcademicJourneyWorkspace workspace={workspace} onRefresh={refreshWorkspace} onOpenStudio={()=>setView("studio")}/>} 
      {view === "learning" && (workspace.viewer.role === "student" ? <StudentWorkspace workspace={workspace} onRefresh={refreshWorkspace}/> : familyLearning ? <FamilyLearningWorkspace workspace={workspace}/> : <LearningWorkspace workspace={workspace} onRefresh={refreshWorkspace}/>)}
      {view === "learners" && <LearnersWorkspace learners={workspace.learners} brand={workspace.brand} role={workspace.viewer.role} />}
      {view === "credentials" && <CredentialCardStudio workspace={workspace} onRefresh={refreshWorkspace} />}
      {view === "teachers" && <TeacherDevelopmentView teachers={workspace.teachers} />}
      {view === "care" && <CareView workspace={workspace} onRefresh={refreshWorkspace} />}
      {view === "transport" && (workspace.viewer.role === "security_guard" ? <SecurityGateView onRefresh={refreshWorkspace}/> : workspace.viewer.role === "driver" ? <DriverWorkspace workspace={workspace} onRefresh={refreshWorkspace}/> : workspace.viewer.role === "transport_manager" ? <TransportManagerWorkspace workspace={workspace} onRefresh={refreshWorkspace}/> : <TransportView workspace={workspace} onRefresh={refreshWorkspace}/>)}
      {view === "finance" && <FinanceWorkspace finance={workspace.finance} learners={workspace.learners} operations={workspace.operations} setup={workspace.setup} role={workspace.viewer.role} onRecorded={refreshWorkspace} />}
      {view === "signals" && <CommunicationsWorkspace role={workspace.viewer.role} signals={workspace.signals} onFeedback={openFeedback} onStatus={moveSignal} />}
      {view === "studio" && <SchoolStudioView brand={workspace.brand} setup={workspace.setup} onSave={saveBrand} onSaveSetup={saveSetup} onUploadLogo={uploadSchoolLogo} />}
    </Shell>
    <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} onCreated={addSignal} />
  </>;
}

export default function App() { return <AuthGate><WorkspaceApp /></AuthGate>; }
