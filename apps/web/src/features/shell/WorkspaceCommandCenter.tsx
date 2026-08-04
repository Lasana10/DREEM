import { roleLabels } from "../../shared/data";
import type {
  Announcement,
  AuditEvent,
  BursarLiabilityRecord,
  ClassroomItem,
  FeeRecord,
  FeePaymentRecord,
  RoleId,
  SchoolConfig,
  StudentRecord,
  SyncMutation,
  TransportRoute,
  WorkspaceView,
  WorkflowCorrection
} from "../../shared/types";

interface WorkspaceCommandCenterProps {
  activeRole: RoleId;
  activeView: WorkspaceView;
  config: SchoolConfig;
  students: StudentRecord[];
  fees: FeeRecord[];
  payments: FeePaymentRecord[];
  liabilities: BursarLiabilityRecord[];
  routes: TransportRoute[];
  announcements: Announcement[];
  continuityItems: ClassroomItem[];
  corrections: WorkflowCorrection[];
  syncMutations: SyncMutation[];
  auditEvents: AuditEvent[];
  onOpenView: (view: WorkspaceView) => void;
}

const workspaceLabels: Record<WorkspaceView, string> = {
  overview: "Command",
  academics: "Academic cockpit",
  finance: "Bursar office",
  transport: "Transport desk",
  communications: "School communications",
  operations: "Institution setup",
  reporting: "Reports"
};

export function WorkspaceCommandCenter({
  activeRole,
  activeView,
  config,
  students,
  fees,
  payments,
  liabilities,
  routes,
  announcements,
  continuityItems,
  corrections,
  syncMutations,
  auditEvents,
  onOpenView
}: WorkspaceCommandCenterProps) {
  const enabledModules = config.enabledModules ?? [];
  const urgentFees = fees.filter((fee) => fee.status !== "clear").length;
  const atRisk = students.filter((student) => student.riskLevel !== "low").length;
  const transportExceptions = routes.filter((route) => route.status !== "on-time").length;
  const criticalAudit = auditEvents.filter((event) => event.severity === "critical").length;
  const openCorrections = corrections.filter((correction) => correction.status !== "applied").length;
  const pendingSync = syncMutations.filter((mutation) => mutation.status !== "synced").length;
  const openCashLiabilities = liabilities.filter((liability) => liability.status !== "settled").length;
  const familyMaterials = continuityItems.filter((item) => item.audience !== "teacher").length;
  const urgentAnnouncements = announcements.filter(
    (announcement) => announcement.priority === "urgent" || announcement.requiresAck
  ).length;
  const recentCollections = payments.filter((payment) => payment.status !== "reversed").length;

  const roleActions: Record<RoleId, Array<{ label: string; detail: string; view: WorkspaceView; count: number }>> = {
    leadership: [
      { label: "Resolve correction queue", detail: "Mistakes, transfers, reversals", view: "operations", count: openCorrections },
      { label: "Watch learner risk", detail: "Academic and attendance exposure", view: "academics", count: atRisk },
      { label: "Review finance posture", detail: "Open balances and cash control", view: "finance", count: urgentFees + openCashLiabilities }
    ],
    teacher: [
      { label: "Take today attendance", detail: "Simple classroom register", view: "academics", count: students.length },
      { label: "Publish continuity pack", detail: "Notes, assignments, follow-up", view: "academics", count: familyMaterials },
      { label: "Read school notices", detail: "Announcements needing action", view: "communications", count: urgentAnnouncements }
    ],
    bursar: [
      { label: "Post and reconcile fees", detail: "Receipts, balances, liabilities", view: "finance", count: urgentFees },
      { label: "Settle cash handovers", detail: "Outstanding bursar accountability", view: "finance", count: openCashLiabilities },
      { label: "Correct wrong payments", detail: "Reversals and fee adjustments", view: "finance", count: openCorrections }
    ],
    parent: [
      { label: "Family fee position", detail: "Balances, receipts, reminders", view: "finance", count: urgentFees },
      { label: "Learning sent home", detail: "Notes and assignments", view: "academics", count: familyMaterials },
      { label: "School notices", detail: "Announcements and acknowledgements", view: "communications", count: urgentAnnouncements }
    ],
    student: [
      { label: "Classroom tasks", detail: "Assignments and follow-up material", view: "academics", count: familyMaterials },
      { label: "School news", detail: "Recognition and announcements", view: "communications", count: announcements.length },
      { label: "Transport status", detail: "Bus route state", view: "transport", count: transportExceptions }
    ],
    transport: [
      { label: "Handle route exceptions", detail: "Delays and maintenance", view: "transport", count: transportExceptions },
      { label: "Notify affected families", detail: "Transport notices", view: "communications", count: urgentAnnouncements },
      { label: "Sync route updates", detail: "Offline queue health", view: "operations", count: pendingSync }
    ],
    support: [
      { label: "Provision identities", detail: "Users, matricules, access", view: "operations", count: students.length },
      { label: "Fix sync blockers", detail: "Cloud, OneDrive, local edge", view: "operations", count: pendingSync },
      { label: "Audit critical events", detail: "Security and data changes", view: "reporting", count: criticalAudit }
    ]
  };

  const operatingState = pendingSync > 0 ? "Sync attention" : openCorrections > 0 ? "Corrections open" : "Operating clean";

  return (
    <section className="os-spine">
      <div className="os-command-hero">
        <div className="os-title-block">
          <span className="eyebrow">DREEM operating system</span>
          <h2>{workspaceLabels[activeView]}</h2>
          <p>
            {roleLabels[activeRole]} cockpit for {config.schoolName} · {config.institutionEdition ?? "bilingual-k12"} · {config.countryPack ?? "cameroon-bilingual"}
          </p>
        </div>
        <div className={pendingSync > 0 || openCorrections > 0 ? "mission-state warm" : "mission-state good"}>
          <span>{operatingState}</span>
          <strong>{pendingSync + openCorrections}</strong>
          <small>items needing control</small>
        </div>
      </div>

      <div className="os-status-grid">
        <button className="os-status-card" onClick={() => onOpenView("academics")}>
          <span>Student watch</span>
          <strong>{atRisk}</strong>
          <small>{students.length} learners in scope</small>
        </button>
        <button className="os-status-card" onClick={() => onOpenView("finance")}>
          <span>Money work</span>
          <strong>{urgentFees}</strong>
          <small>open fee accounts</small>
        </button>
        <button className="os-status-card" onClick={() => onOpenView("transport")}>
          <span>Movement</span>
          <strong>{transportExceptions}</strong>
          <small>route exceptions</small>
        </button>
        <button className="os-status-card" onClick={() => onOpenView("operations")}>
          <span>Corrections</span>
          <strong>{openCorrections + criticalAudit}</strong>
          <small>audit-sensitive items</small>
        </button>
      </div>

      <div className="mission-control-grid">
        <div className="mission-panel">
          <span className="eyebrow">Next best actions</span>
          <h3>{roleLabels[activeRole]} queue</h3>
          <div className="action-queue">
            {roleActions[activeRole].map((action) => (
              <button key={action.label} className="action-row" onClick={() => onOpenView(action.view)}>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.detail}</small>
                </span>
                <b>{action.count}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="mission-panel">
          <span className="eyebrow">Operational truth</span>
          <h3>What is actually running</h3>
          <div className="truth-stack">
            <span>Identity: matricule + OTP/server provisioning</span>
            <span>Finance: {recentCollections} receipts · {openCashLiabilities} cash liabilities</span>
            <span>Continuity: {familyMaterials} family-facing learning items</span>
            <span>Reliability: {pendingSync} unsynced local mutations</span>
          </div>
        </div>
      </div>

      <div className="os-module-rail" aria-label="Enabled school modules">
        {enabledModules.map((module) => (
          <button key={module} onClick={() => onOpenView(module as WorkspaceView)}>
            {module}
          </button>
        ))}
      </div>
    </section>
  );
}
