import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, ClipboardCheck, GraduationCap, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import AuthGate from "./AuthGate";
import WeeklyEvidencePanel from "./WeeklyEvidencePanel";
import WeeklyRegisterWorkspace from "./WeeklyRegisterWorkspace";
import QuestionBankWorkspace from "./QuestionBankWorkspace";
import TeacherClassroomWorkspace from "./TeacherClassroomWorkspace";
import AcademicJourneyWorkspace from "./AcademicJourneyWorkspace";
import AcademicActionQueue from "./AcademicActionQueue";
import CurriculumCoveragePanel from "./CurriculumCoveragePanel";
import { loadWorkspace, type WorkspaceData } from "../lib/repository";
import { resolveActiveSchoolContext } from "../lib/schoolContext";
import { canAuthority } from "../lib/access";
import { userFacingError } from "../lib/userFacingError";
import "./SchoolExcellence.css";

type Mode = "overview" | "teach" | "review" | "weekly" | "questions";
const featureCards = [
  { title: "Weekly lesson evidence", summary: "Plan with approved outcomes, record delivery and follow-up.", icon: BookOpenCheck },
  { title: "Academic supervision", summary: "Examine submitted lessons and assessments before approval.", icon: ClipboardCheck },
  { title: "Curriculum alignment", summary: "Use the school's approved outcomes and real teacher assignments.", icon: GraduationCap },
];

function ExcellenceWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [mode, setMode] = useState<Mode>("overview");
  const [focusOutcomeId, setFocusOutcomeId] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => { setWorkspace(await loadWorkspace()); }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await resolveActiveSchoolContext();
        const data = await loadWorkspace();
        if (active) setWorkspace(data);
      } catch (reason) {
        if (active) setError(userFacingError(reason, "Your school records could not be loaded. Please check your membership or connection."));
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, []);
  const teacher = workspace ? canAuthority(workspace.viewer, "academics_delivery") : false;
  const reviewer = workspace ? canAuthority(workspace.viewer, "academics_approval") : false;
  const counts = workspace ? {
    outcomes: workspace.academics.curriculumOutcomes.filter(item => item.status === "active").length,
    assignments: workspace.academics.assignments.filter(item => item.status === "active").length,
    reviews: workspace.academics.lessonPlans.filter(item => item.status === "submitted").length +
      workspace.academics.assessments.filter(item => item.status === "submitted").length,
  } : null;
  return <main className="excellence">
    <header className="excellence-topbar">
      <a href="/excellence" className="excellence-logo" aria-label="DREEM School Excellence home"><span className="excellence-mark">D</span><span><b>DREEM</b><small>SCHOOL EXCELLENCE</small></span></a>
      <nav aria-label="School Excellence navigation"><a href="/">Full School OS</a>{mode !== "overview" && <button type="button" onClick={() => setMode("overview")}><ArrowLeft size={15}/> Overview</button>}</nav>
    </header>
    <div className="excellence-container">
      {busy && <section className="excellence-state" role="status"><RefreshCw className="excellence-spin" size={24}/><h1>Opening your academic workspace</h1><p>Confirming your school and authorised work.</p></section>}
      {!busy && error && <section className="excellence-state" role="alert"><LockKeyhole size={24}/><h1>School access needs attention</h1><p>{error}</p><a href="/">Choose school in DREEM <ArrowRight size={16}/></a><button type="button" onClick={() => window.location.reload()}>Retry</button></section>}
      {!busy && workspace && !teacher && !reviewer && <section className="excellence-state"><LockKeyhole/><h1>Academic workspace access required</h1><p>Your active school membership has no academic delivery or approval permission. No student information has been displayed.</p><a href="/">Return to School OS <ArrowRight size={16}/></a></section>}
      {!busy && workspace && (teacher || reviewer) && <>
        {mode === "overview" && <>
          <section className="excellence-hero">
            <div><span className="excellence-kicker"><Sparkles size={15}/> SCHOOL EXCELLENCE · ACADEMIC OPERATIONS</span><h1>Better teaching.<br/><em>Visible progress.</em></h1><p>Curriculum, classroom evidence and independent academic review in one focused workspace—connected to your existing DREEM school records.</p><div className="excellence-actions">{teacher && <button className="excellence-primary" type="button" onClick={() => setMode("teach")}>Open my classroom <ArrowRight size={17}/></button>}<button className="excellence-secondary" type="button" onClick={() => setMode("weekly")}>Weekly register <BookOpenCheck size={17}/></button><button className="excellence-secondary" type="button" onClick={() => setMode("questions")}>Question bank <GraduationCap size={17}/></button>{reviewer && <button className="excellence-secondary" type="button" onClick={() => setMode("review")}>Academic review <ClipboardCheck size={17}/></button>}</div></div>
            <div className="excellence-hero-art" aria-hidden="true"><div className="excellence-orbit"><GraduationCap size={68}/></div><span>CURRICULUM</span><span>TEACHING</span><span>REVIEW</span></div>
          </section>
          <section className="excellence-summary" aria-label="School academic overview"><div><span>Active curriculum outcomes</span><strong>{counts?.outcomes ?? 0}</strong><small>Approved for delivery</small></div><div><span>Teaching assignments</span><strong>{counts?.assignments ?? 0}</strong><small>Active across this school</small></div><div><span>Pending academic reviews</span><strong>{counts?.reviews ?? 0}</strong><small>Submitted lesson plans and assessments</small></div></section>
          {reviewer && <AcademicActionQueue workspace={workspace} onOpen={setMode}/>}
          <CurriculumCoveragePanel workspace={workspace} teacherOnly={!reviewer} onPlanOutcome={teacher ? (id)=>{setFocusOutcomeId(id);setMode("teach");}:undefined}/>
          <WeeklyEvidencePanel workspace={workspace} teacherOnly={!reviewer}/>
          <div className="excellence-section-title"><div><span>CONNECTED WORKFLOWS</span><h2>One academic journey, not another school database.</h2></div><span className="excellence-integrity"><ShieldCheck size={16}/> Existing school permissions enforced</span></div>
          <div className="excellence-features">{featureCards.map(({title,summary,icon: Icon}) => <article className="excellence-feature" key={title}><span className="excellence-feature-icon"><Icon size={23}/></span><h3>{title}</h3><p>{summary}</p></article>)}</div>
          <div className="excellence-bottom"><Users size={20}/><div><strong>No forced data migration.</strong><span>Classrooms, identities, approved curricula and review permissions come from the school's current DREEM records. Schools using other software can introduce this academic workspace gradually.</span></div></div>
        </>}
        {mode !== "overview" && <section className="excellence-workflow"><div className="excellence-workflow-head"><div><span>ACADEMIC WORKSPACE</span><h1>{mode === "teach" ? "My classroom" : mode === "weekly" ? "Weekly teaching register" : mode === "questions" ? "Question bank & moderation" : "Supervision & approval"}</h1><p>{mode === "teach" ? "Teaching evidence aligned with the approved curriculum." : mode === "weekly" ? "Teacher submission and independent academic review." : mode === "questions" ? "Curriculum-aligned, independently approved assessment materials." : "Independent review of academic plans and assessment results."}</p></div><button type="button" onClick={() => setMode("overview")}><ArrowLeft size={16}/> Back to overview</button></div>
          {mode === "questions" && <QuestionBankWorkspace workspace={workspace} teacher={teacher} reviewer={reviewer}/>}
          {mode === "weekly" && <WeeklyRegisterWorkspace workspace={workspace} teacher={teacher} reviewer={reviewer}/>}
          {mode === "teach" && teacher && <TeacherClassroomWorkspace workspace={workspace} onRefresh={refresh} focusOutcomeId={focusOutcomeId}/>}
          {mode === "review" && reviewer && <AcademicJourneyWorkspace workspace={workspace} onRefresh={refresh} onOpenStudio={() => window.location.assign("/")}/>}
        </section>}
      </>}
    </div>
    <footer className="excellence-footer"><span>DREEM · SCHOOL EXCELLENCE</span><span>Academic integrity · Existing records · Controlled access</span></footer>
  </main>;
}
export default function SchoolExcellenceStandalone() { return <AuthGate><ExcellenceWorkspace/></AuthGate>; }
