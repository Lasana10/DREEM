import { useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, BadgeCheck, ClipboardList, FileCheck2, UserPlus } from "lucide-react";
import type { AdmissionStatus, ProgressAdmissionCommand, RecordAdmissionCommand } from "../domain/types";
import { createIdempotencyKey } from "../domain/rules";
import {
  progressAdmissionApplication,
  recordAdmissionApplication,
  type WorkspaceData,
} from "../lib/repository";

type State = { error: boolean; message: string };
type TargetAdmissionStatus = Exclude<AdmissionStatus, "submitted">;

const terminalAdmissionStatuses: AdmissionStatus[] = ["rejected", "withdrawn", "enrolled"];

const admissionStatusLabels: Record<AdmissionStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  documents_pending: "Documents pending",
  interview: "Interview",
  offered: "Offered",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  enrolled: "Enrolled",
};

const allowedAdmissionTransitions: Record<AdmissionStatus, TargetAdmissionStatus[]> = {
  submitted: ["under_review", "documents_pending", "interview", "waitlisted", "rejected", "withdrawn"],
  under_review: ["documents_pending", "interview", "offered", "waitlisted", "rejected", "withdrawn"],
  documents_pending: ["under_review", "interview", "offered", "waitlisted", "rejected", "withdrawn"],
  interview: ["under_review", "documents_pending", "offered", "waitlisted", "rejected", "withdrawn"],
  offered: ["accepted", "rejected", "withdrawn"],
  accepted: ["enrolled", "withdrawn"],
  waitlisted: ["under_review", "offered", "rejected", "withdrawn"],
  rejected: [],
  withdrawn: [],
  enrolled: [],
};

const recommendedAdmissionTransition: Partial<Record<AdmissionStatus, TargetAdmissionStatus>> = {
  submitted: "under_review",
  under_review: "offered",
  documents_pending: "under_review",
  interview: "offered",
  offered: "accepted",
  accepted: "enrolled",
  waitlisted: "under_review",
};

const admissionActionLabels: Record<TargetAdmissionStatus, string> = {
  under_review: "Start application review",
  documents_pending: "Request missing documents",
  interview: "Schedule interview",
  offered: "Approve and send offer",
  accepted: "Record guardian acceptance",
  waitlisted: "Place on waiting list",
  rejected: "Reject application",
  withdrawn: "Record withdrawal",
  enrolled: "Enrol and create learner OneFile",
};

const journeySteps = ["Application", "Review", "Offer", "Accepted", "OneFile"];

function admissionJourneyPosition(status: AdmissionStatus) {
  if (status === "enrolled") return 4;
  if (status === "accepted") return 3;
  if (status === "offered") return 2;
  if (["under_review", "documents_pending", "interview", "waitlisted"].includes(status)) return 1;
  return 0;
}

function displayOwner(owner?: string) {
  if (!owner) return "Admissions queue";
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(owner) ? "Assigned staff member" : owner;
}

function admissionErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") {
    const details =
      "details" in reason && typeof reason.details === "string" && reason.details ? ` ${reason.details}` : "";
    const hint = "hint" in reason && typeof reason.hint === "string" && reason.hint ? ` Hint: ${reason.hint}` : "";
    const code = "code" in reason && typeof reason.code === "string" && reason.code ? ` [${reason.code}]` : "";
    return `${reason.message}${details}${hint}${code}`.trim();
  }
  return "Admission action failed. Please retry or contact the school administrator.";
}

export default function AdmissionsView({
  workspace,
  onRefresh,
  onOpenLearners,
}: {
  workspace: WorkspaceData;
  onRefresh: () => Promise<void>;
  onOpenLearners?: () => void;
}) {
  const initialApplication = workspace.admissions[0];
  const [state, setState] = useState<State>({ error: false, message: "" });
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [selected, setSelected] = useState(initialApplication?.id ?? "");
  const [targetStatus, setTargetStatus] = useState<TargetAdmissionStatus | "">("");

  const staff = workspace.operations.memberships.filter(
    item => item.status === "approved" && !["parent", "student"].includes(item.role),
  );
  const active = workspace.admissions.filter(item => !terminalAdmissionStatuses.includes(item.status));
  const selectedApplication = workspace.admissions.find(item => item.id === selected) ?? initialApplication;
  const selectedApplicationId = selectedApplication?.id ?? "";
  const decisionApplications = [...workspace.admissions].sort((a, b) => {
    const aTerminal = terminalAdmissionStatuses.includes(a.status);
    const bTerminal = terminalAdmissionStatuses.includes(b.status);
    if (aTerminal !== bTerminal) return aTerminal ? 1 : -1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
  const availableStatuses = useMemo(
    () => (selectedApplication ? allowedAdmissionTransitions[selectedApplication.status] : []),
    [selectedApplication],
  );
  const recommendedStatus = selectedApplication
    ? recommendedAdmissionTransition[selectedApplication.status]
    : undefined;
  const effectiveTargetStatus = availableStatuses.includes(targetStatus as TargetAdmissionStatus)
    ? targetStatus
    : recommendedStatus ?? availableStatuses[0] ?? "";

  async function run(action: () => Promise<string>) {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    setState({ error: false, message: "Saving admission evidence..." });
    try {
      const message = await action();
      await onRefresh();
      setState({ error: false, message });
      return true;
    } catch (reason) {
      setState({ error: true, message: admissionErrorMessage(reason) });
      return false;
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const f = new FormData(element);
    const command: RecordAdmissionCommand = {
      learnerFullName: String(f.get("learnerFullName") ?? ""),
      dateOfBirth: String(f.get("dateOfBirth") || "") || undefined,
      sex: (String(f.get("sex") || "") as RecordAdmissionCommand["sex"]) || undefined,
      targetClassName: String(f.get("targetClassName") ?? ""),
      previousSchool: String(f.get("previousSchool") || "") || undefined,
      supportNotes: String(f.get("supportNotes") || "") || undefined,
      guardianFullName: String(f.get("guardianFullName") ?? ""),
      guardianPhone: String(f.get("guardianPhone") || "") || undefined,
      guardianEmail: String(f.get("guardianEmail") || "") || undefined,
      guardianRelationship: String(f.get("guardianRelationship") || "guardian"),
      source: (String(f.get("source") || "school_desk") as RecordAdmissionCommand["source"]) || "school_desk",
      assignedTo: String(f.get("assignedTo") || "") || undefined,
      consentAccuracy: f.get("consentAccuracy") === "on",
      consentDataProcessing: f.get("consentDataProcessing") === "on",
      idempotencyKey: createIdempotencyKey("admission"),
    };

    await run(async () => {
      const result = await recordAdmissionApplication(command);
      element.reset();
      setSelected(result.applicationId);
      return `Application ${result.applicationNumber} submitted with required declarations.`;
    });
  }

  async function progress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedApplicationId || !effectiveTargetStatus) {
      setState({ error: true, message: "Choose an active application and a valid next state." });
      return;
    }

    const element = event.currentTarget;
    const f = new FormData(element);
    const command: ProgressAdmissionCommand = {
      applicationId: selectedApplicationId,
      targetStatus: effectiveTargetStatus,
      note: String(f.get("note") ?? ""),
      assignedTo: String(f.get("assignedTo") || "") || undefined,
      openingBalance: Number(f.get("openingBalance") || 0),
      idempotencyKey: createIdempotencyKey("admission-progress"),
    };

    let enrolled = false;
    const succeeded = await run(async () => {
      const result = await progressAdmissionApplication(command);
      element.reset();
      const resultStatus = result.status as AdmissionStatus;
      enrolled = Boolean(result.matricule);
      return result.matricule
        ? `Applicant enrolled with matricule ${result.matricule}.`
        : `Application moved to ${admissionStatusLabels[resultStatus]}.`;
    });
    if (succeeded && enrolled) onOpenLearners?.();
  }

  return (
    <div className="content">
      <section className="page-intro">
        <div>
          <span>ADMISSIONS & ENROLMENT</span>
          <h2>One controlled journey from applicant to learner OneFile.</h2>
          <p>
            Declarations, guardian identity, review decisions and final enrolment remain linked instead of being
            re-entered across paper registers.
          </p>
        </div>
      </section>

      {state.message ? (
        <div className={`form-status ${state.error ? "error" : "success"}`}>
          {state.error ? <AlertTriangle /> : <BadgeCheck />}
          {state.message}
        </div>
      ) : null}

      <section className="metrics">
        <article className="metric">
          <span>Applications</span>
          <strong>{workspace.admissions.length}</strong>
          <small>Complete register</small>
        </article>
        <article className="metric blue">
          <span>Under action</span>
          <strong>{active.length}</strong>
          <small>Not terminal</small>
        </article>
        <article className="metric amber">
          <span>Offers / accepted</span>
          <strong>{workspace.admissions.filter(item => ["offered", "accepted"].includes(item.status)).length}</strong>
          <small>Ready for decision</small>
        </article>
        <article className="metric">
          <span>Enrolled</span>
          <strong>{workspace.admissions.filter(item => item.status === "enrolled").length}</strong>
          <small>OneFiles created</small>
        </article>
      </section>

      <div className="care-grid">
        <form className="panel settings-form" onSubmit={record}>
          <div className="panel-title">
            <div>
              <span>NEW APPLICATION</span>
              <h3>Applicant and guardian record</h3>
            </div>
            <UserPlus />
          </div>
          <div className="form-grid">
            <label>
              Learner full name
              <input name="learnerFullName" required minLength={3} autoComplete="name" />
            </label>
            <label>
              Date of birth
              <input name="dateOfBirth" type="date" />
            </label>
            <label>
              Sex
              <select name="sex" defaultValue="">
                <option value="">Not recorded</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Target class
              <input name="targetClassName" list="classes" required />
            </label>
            <label>
              Previous school
              <input name="previousSchool" />
            </label>
            <label>
              Guardian full name
              <input name="guardianFullName" required minLength={3} autoComplete="section-guardian name" />
            </label>
            <label>
              Guardian phone
              <input name="guardianPhone" type="tel" inputMode="tel" autoComplete="tel" />
            </label>
            <label>
              Guardian email
              <input name="guardianEmail" type="email" autoComplete="email" />
            </label>
            <label>
              Relationship
              <input name="guardianRelationship" defaultValue="parent" />
            </label>
            <label>
              Source
              <select name="source" defaultValue="school_desk">
                <option value="school_desk">School desk</option>
                <option value="referral">Referral</option>
                <option value="website">Website</option>
                <option value="campaign">Campaign</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Assign reviewer
              <select name="assignedTo">
                <option value="">Admissions queue</option>
                {staff.map(item => (
                  <option key={item.profileId} value={item.profileId}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Support / accessibility information
            <textarea name="supportNotes" rows={3} />
          </label>
          <label className="consent-check">
            <input type="checkbox" name="consentAccuracy" required />
            Guardian confirms the information is accurate.
          </label>
          <label className="consent-check">
            <input type="checkbox" name="consentDataProcessing" required />
            Guardian authorises processing for admission and school operations.
          </label>
          <button className="primary" type="submit" disabled={busy}>
            <FileCheck2 />
            {busy ? "Saving…" : "Submit application"}
          </button>
        </form>

        <form className="panel settings-form" onSubmit={progress}>
          <div className="panel-title">
            <div>
              <span>DECISION WORKFLOW</span>
              <h3>Review, offer, accept and enrol</h3>
            </div>
            <ClipboardList />
          </div>
          <label>
            Application
            <select
              name="applicationId"
              required
              value={selectedApplicationId}
              onChange={e => {
                const nextApplication = workspace.admissions.find(item => item.id === e.target.value);
                setSelected(e.target.value);
                setTargetStatus(nextApplication ? allowedAdmissionTransitions[nextApplication.status][0] ?? "" : "");
              }}
            >
              <option value="">Choose application</option>
              {decisionApplications.map(item => (
                <option key={item.id} value={item.id}>
                  {item.applicationNumber} - {item.learnerName} - {admissionStatusLabels[item.status]}
                </option>
              ))}
            </select>
          </label>
          {selectedApplication ? (
            <div className="admission-journey" aria-label="Admission journey">
              {journeySteps.map((step, index) => (
                <span
                  className={index < admissionJourneyPosition(selectedApplication.status) ? "complete" : index === admissionJourneyPosition(selectedApplication.status) ? "current" : ""}
                  key={step}
                >
                  <b>{index + 1}</b>{step}
                </span>
              ))}
            </div>
          ) : null}
          {effectiveTargetStatus ? (
            <div className="workflow-next">
              <small>RECOMMENDED NEXT ACTION</small>
              <strong>{admissionActionLabels[effectiveTargetStatus]}</strong>
              <p>The current record is {selectedApplication ? admissionStatusLabels[selectedApplication.status].toLowerCase() : "not selected"}. This action will be saved to its evidence trail.</p>
            </div>
          ) : null}
          <div className="form-grid">
            <label>
              Assign to
              <select name="assignedTo">
                <option value="">Keep owner</option>
                {staff.map(item => (
                  <option key={item.profileId} value={item.profileId}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {effectiveTargetStatus === "enrolled" ? (
              <label>
                Opening fee balance
                <input name="openingBalance" type="number" min="0" defaultValue="0" />
              </label>
            ) : null}
          </div>
          {availableStatuses.length > 1 ? (
            <details className="workflow-exceptions">
              <summary>Use a different valid action</summary>
              <label>
                Alternative action
                <select
                  name="targetStatus"
                  value={effectiveTargetStatus}
                  onChange={e => setTargetStatus(e.target.value as TargetAdmissionStatus)}
                >
                  {availableStatuses.map(status => (
                    <option key={status} value={status}>{admissionActionLabels[status]}</option>
                  ))}
                </select>
              </label>
            </details>
          ) : null}
          {!availableStatuses.length && selectedApplication ? (
            <div className="form-status warning">
              <AlertTriangle />
              This application is already {admissionStatusLabels[selectedApplication.status].toLowerCase()}.
            </div>
          ) : null}
          <label>
            Decision / action evidence
            <textarea name="note" required minLength={2} rows={4} placeholder="Record who confirmed the decision, the evidence checked, and any next condition." />
          </label>
          <button className="primary" type="submit" disabled={busy || !selectedApplicationId || !availableStatuses.length}>
            <ClipboardList />
            {busy ? "Saving…" : effectiveTargetStatus ? admissionActionLabels[effectiveTargetStatus] : "No further action"}
          </button>
        </form>
      </div>

      <section className="panel case-register">
        <div className="panel-title">
          <div>
            <span>APPLICATION REGISTER</span>
            <h3>Current admission journeys</h3>
          </div>
        </div>
        {workspace.admissions.map(item => (
          <article className="case-row" key={item.id}>
            <header>
              <span>
                <strong>{item.applicationNumber}</strong>
                <small>
                  {item.learnerName} - {item.targetClassName}
                </small>
              </span>
              <em>{admissionStatusLabels[item.status]}</em>
            </header>
            <p>
              Guardian: {item.guardianName}
              {item.guardianPhone ? ` - ${item.guardianPhone}` : ""}
            </p>
            <footer>
              <span>Source: {item.source.replaceAll("_", " ")}</span>
              <span>Owner: {displayOwner(item.assignedTo)}</span>
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}
