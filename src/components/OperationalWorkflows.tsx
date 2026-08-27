import { useState, type FormEvent } from "react";
import { BadgeCheck, ClipboardCheck, GraduationCap, IdCard, MailPlus, PenLine, QrCode, RefreshCw, UserPlus } from "lucide-react";
import type { AccessMembership, AssessmentCommand, AttendanceCommand, EnrollmentPayload, StaffInvitation } from "../domain/types";
import { createIdempotencyKey } from "../domain/rules";
import type { WorkspaceData } from "../lib/repository";

type Status = { tone: "idle" | "success" | "error"; message: string };
const roleOptions:{value:StaffInvitation["role"];label:string;purpose:string}[]=[
  {value:"principal",label:"Principal",purpose:"Full school operations and approvals"},
  {value:"administrator",label:"Administrator",purpose:"Admissions, access and daily records"},
  {value:"academic_head",label:"Academic head",purpose:"Teaching structure, timetable and assessment review"},
  {value:"bursar",label:"Bursar / cashier",purpose:"Collect payments and open cashier sessions"},
  {value:"accountant",label:"Accountant",purpose:"Review deposits, exceptions and finance closure"},
  {value:"teacher",label:"Teacher",purpose:"Attendance, marks and classroom evidence"},
  {value:"tutor",label:"Tutor",purpose:"Learner follow-up and pastoral support"},
  {value:"transport_manager",label:"Transport manager",purpose:"Routes, vehicles, consents and dispatch"},
  {value:"driver",label:"Driver",purpose:"Assigned trips and journey events"},
  {value:"security_guard",label:"Security / gate officer",purpose:"Scan pickup badges and confirm approved collectors"},
  {value:"auditor",label:"Auditor",purpose:"Read-only review of finance and evidence"},
];
function readableError(reason:unknown){if(reason instanceof Error&&reason.message)return reason.message;if(reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"){const item=reason as {message:string;details?:unknown;hint?:unknown;code?:unknown};return [item.message,item.details,item.hint?"Hint: "+item.hint:null,item.code?"Code: "+item.code:null].filter(Boolean).join(" ");}return "The operation could not be completed. Check the required setup and permissions.";}

export default function OperationalWorkflowsView({
  workspace,
  onInviteStaff,
  onUpdateAccess,
  onEnrolLearner,
  onIssueCredential,
  onRecordAttendance,
  onRecordAssessment,
  onRefresh,
}: {
  workspace: WorkspaceData;
  onInviteStaff: (input: { email: string; fullName: string; role: StaffInvitation["role"]; idempotencyKey: string }) => Promise<unknown>;
  onUpdateAccess: (membershipId:string,status:AccessMembership["status"]) => Promise<unknown>;
  onEnrolLearner: (input: EnrollmentPayload) => Promise<{ studentId: string; matricule: string }>;
  onIssueCredential: (studentId: string, validUntil: string, idempotencyKey: string) => Promise<{ credentialId: string; verificationToken: string }>;
  onRecordAttendance: (command: AttendanceCommand) => Promise<{ sessionId: string; recordedCount: number }>;
  onRecordAssessment: (command: AssessmentCommand) => Promise<{ assessmentId: string; marksCount: number }>;
  onRefresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "" });
  const [credentialToken, setCredentialToken] = useState("");
  const learners = workspace.learners;
  const classes = workspace.setup.classes.length ? workspace.setup.classes.map((item) => item.name) : Array.from(new Set(learners.map((item) => item.className)));
  const subjects = workspace.setup.subjects;
  const canManageAccess = ["platform_founder","school_owner","principal","administrator"].includes(workspace.viewer.role);

  async function run(action: () => Promise<string>) {
    setStatus({ tone: "idle", message: "Saving..." });
    try {
      const message = await action();
      await onRefresh();
      setStatus({ tone: "success", message });
    } catch (reason) {
      setStatus({ tone: "error", message: readableError(reason) });
    }
  }

  function selectedLearners(form: HTMLFormElement) {
    const values = new FormData(form);
    const className = String(values.get("className") ?? "");
    return learners.filter((learner) => learner.className === className).slice(0, 40);
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await onInviteStaff({
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        role: String(form.get("role") ?? "teacher") as StaffInvitation["role"],
        idempotencyKey: createIdempotencyKey("staff-invite"),
      });
      formElement.reset();
      return "Staff invitation recorded and Supabase Auth email requested.";
    });
  }

  async function enrol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const learner = await onEnrolLearner({
        fullName: String(form.get("fullName") ?? ""),
        className: String(form.get("className") ?? ""),
        dateOfBirth: String(form.get("dateOfBirth") || ""),
        sex: String(form.get("sex") || "") as EnrollmentPayload["sex"],
        guardianName: String(form.get("guardianName") ?? ""),
        guardianPhone: String(form.get("guardianPhone") ?? ""),
        guardianEmail: String(form.get("guardianEmail") || ""),
        relationship: String(form.get("relationship") || "guardian"),
        openingBalance: Number(form.get("openingBalance") || 0),
        idempotencyKey: createIdempotencyKey("learner-enrolment"),
      });
      formElement.reset();
      return `Learner enrolled with matricule ${learner.matricule}.`;
    });
  }

  async function issueCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const credential = await onIssueCredential(String(form.get("studentId") ?? ""), String(form.get("validUntil") ?? ""), createIdempotencyKey("credential"));
      setCredentialToken(credential.verificationToken);
      return "Credential issued. Use the opaque token for QR printing.";
    });
  }

  async function attendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const marks = selectedLearners(form).map((learner) => ({
      studentId: learner.id,
      status: String(values.get(`attendance:${learner.id}`) ?? "present") as AttendanceCommand["marks"][number]["status"],
      note: String(values.get(`attendance-note:${learner.id}`) || ""),
    }));
    await run(async () => {
      const session = await onRecordAttendance({
        className: String(values.get("className") ?? ""),
        sessionDate: String(values.get("sessionDate") ?? ""),
        periodLabel: String(values.get("periodLabel") || "AM"),
        marks,
        idempotencyKey: createIdempotencyKey("attendance"),
      });
      return `${session.recordedCount} attendance marks recorded.`;
    });
  }

  async function assessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const maxScore = Number(values.get("maxScore") || 20);
    const marks = selectedLearners(form).map((learner) => ({
      studentId: learner.id,
      score: Number(values.get(`score:${learner.id}`) || 0),
      comment: String(values.get(`comment:${learner.id}`) || ""),
    }));
    await run(async () => {
      const saved = await onRecordAssessment({
        subjectId: String(values.get("subjectId") || ""),
        className: String(values.get("className") ?? ""),
        title: String(values.get("title") ?? ""),
        maxScore,
        assessmentDate: String(values.get("assessmentDate") ?? ""),
        marks,
        idempotencyKey: createIdempotencyKey("assessment"),
      });
      return `${saved.marksCount} marks recorded for publication review.`;
    });
  }

  return <div className="content">
    <section className="page-intro">
      <div><span>DREEM OPERATING WORKFLOW</span><h2>Run the school day from verified actions.</h2><p>Every action writes to Supabase through controlled commands with audit and domain events.</p></div>
      <button className="primary" onClick={() => run(async () => { await onRefresh(); return "Workspace refreshed."; })}><RefreshCw/>Refresh</button>
    </section>
    {status.message ? <div className={`form-status ${status.tone === "error" ? "error" : "success"}`}><BadgeCheck/>{status.message}</div> : null}
    <div className="ops-grid">
      <form className="panel settings-form" onSubmit={invite}>
        <div className="panel-title"><div><span>ACCESS</span><h3>Invite staff</h3></div><MailPlus/></div>
        <p className="form-help">This is where leadership creates teachers, bursars, accountants, transport staff, security gate officers and auditors. The invited person accepts the email, then leadership approves the membership below.</p><div className="role-guide">{roleOptions.map(role=><article key={role.value}><strong>{role.label}</strong><small>{role.purpose}</small></article>)}</div><div className="form-grid"><label>Full name<input name="fullName" autoComplete="name" required/></label><label>Email<input name="email" type="email" inputMode="email" autoComplete="email" required/></label><label>Role<select name="role" defaultValue="teacher">{roleOptions.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label></div>
        <button className="primary" type="submit"><UserPlus/>Create invitation</button>
        <small>{workspace.operations.invitations.filter((item) => item.status === "pending").length} pending invitations</small>
        {canManageAccess&&workspace.operations.memberships.filter((item)=>item.status==="pending").map((membership)=><div className="access-review" key={membership.id}><span><strong>{membership.name}</strong><small>{membership.role.replaceAll("_"," ")}</small></span><button type="button" onClick={()=>run(async()=>{await onUpdateAccess(membership.id,"approved");return `${membership.name} approved.`})}>Approve</button><button type="button" onClick={()=>run(async()=>{await onUpdateAccess(membership.id,"rejected");return `${membership.name} rejected.`})}>Reject</button></div>)}
      </form>
      <details className="panel direct-enrolment">
        <summary><span><small>EXCEPTION WORKFLOW</small><strong>Direct enrolment without an application</strong></span><GraduationCap/></summary>
        <p>Use only for a walk-in, approved import or historical learner. Accepted admissions create their OneFile automatically from the Admissions screen.</p>
      <form className="settings-form" onSubmit={enrol}>
        <div className="form-grid"><label>Full name<input name="fullName" required/></label><label>Class<input name="className" list="classes" required/></label><label>Date of birth<input name="dateOfBirth" type="date"/></label><label>Sex<select name="sex" defaultValue=""><option value="">Not set</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label><label>Guardian<input name="guardianName" required/></label><label>Guardian phone<input name="guardianPhone"/></label><label>Guardian email<input name="guardianEmail" type="email"/></label><label>Relationship<input name="relationship" defaultValue="parent"/></label><label>Opening balance<input name="openingBalance" type="number" min="0" step="1" defaultValue="0"/></label></div>
        <button className="primary" type="submit"><GraduationCap/>Create direct learner OneFile</button>
      </form>
      </details>
    </div>
    <datalist id="classes">{classes.map((name) => <option key={name} value={name}/>)}</datalist>
    <div className="ops-grid">
      <form className="panel settings-form" onSubmit={issueCredential}>
        <div className="panel-title"><div><span>CREDENTIALS</span><h3>Issue student QR token</h3></div><QrCode/></div>
        <div className="form-grid"><label>Learner<select name="studentId" required>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name} · {learner.matricule}</option>)}</select></label><label>Valid until<input name="validUntil" type="date" required/></label></div>
        <button className="primary" type="submit"><IdCard/>Issue credential</button>
        {credentialToken ? <textarea readOnly rows={3} value={credentialToken} aria-label="Opaque verification token"/> : null}
      </form>
      <form className="panel settings-form" onSubmit={attendance}>
        <div className="panel-title"><div><span>ATTENDANCE</span><h3>Capture class attendance</h3></div><ClipboardCheck/></div>
        <ClassFields classes={classes} />
        <AttendanceRows learners={learners} />
        <button className="primary" type="submit"><ClipboardCheck/>Submit attendance</button>
      </form>
    </div>
    <form className="panel settings-form" onSubmit={assessment}>
      <div className="panel-title"><div><span>ACADEMICS</span><h3>Record assessment marks</h3></div><PenLine/></div>
      <div className="form-grid"><label>Title<input name="title" required placeholder="Mathematics quiz"/></label><label>Subject<select name="subjectId"><option value="">General</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Class<input name="className" list="classes" required defaultValue={classes[0] ?? ""}/></label><label>Date<input name="assessmentDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Max score<input name="maxScore" type="number" min="1" step="1" defaultValue="20" required/></label></div>
      <AssessmentRows learners={learners} />
      <button className="primary" type="submit"><PenLine/>Submit marks</button>
    </form>
  </div>;
}

function ClassFields({ classes }:{classes:string[]}) {
  return <div className="form-grid"><label>Class<input name="className" list="classes" required defaultValue={classes[0] ?? ""}/></label><label>Date<input name="sessionDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Period<select name="periodLabel" defaultValue="AM"><option value="AM">Morning</option><option value="PM">Afternoon</option><option value="EXTRA">Extra class</option></select></label></div>;
}

function AttendanceRows({ learners }:{learners:WorkspaceData["learners"]}) {
  return <div className="compact-table">{learners.slice(0,12).map((learner) => <label key={learner.id}>{learner.name}<select name={`attendance:${learner.id}`} defaultValue="present"><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select><input name={`attendance-note:${learner.id}`} placeholder="Note"/></label>)}</div>;
}

function AssessmentRows({ learners }:{learners:WorkspaceData["learners"]}) {
  return <div className="compact-table">{learners.slice(0,12).map((learner) => <label key={learner.id}>{learner.name}<input name={`score:${learner.id}`} type="number" min="0" step="0.5" defaultValue="0"/><input name={`comment:${learner.id}`} placeholder="Comment"/></label>)}</div>;
}
