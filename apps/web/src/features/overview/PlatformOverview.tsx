import { roleLabels, roleProfiles, roleWorkspaceAccess } from "../../shared/data";
import type {
  Announcement,
  AttendanceRecord,
  ClassroomItem,
  FeeRecord,
  RoleId,
  SchoolConfig,
  StorageConnection,
  StudentRecord,
  SyncMutation,
  TransportRoute,
  WorkerBackupTopology,
  WorkflowCorrection,
  WorkspaceView
} from "../../shared/types";

interface PlatformOverviewProps {
  activeRole: RoleId;
  demoMode: boolean;
  announcements: Announcement[];
  students: StudentRecord[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  routes: TransportRoute[];
  continuityItems: ClassroomItem[];
  storageConnections: StorageConnection[];
  backupTopology?: WorkerBackupTopology | null;
  schoolConfig: SchoolConfig;
  corrections: WorkflowCorrection[];
  syncMutations: SyncMutation[];
  onOpenView: (view: WorkspaceView) => void;
}

const rolePriorities: Record<RoleId, Array<{ label: string; view: WorkspaceView }>> = {
  leadership: [
    { label: "Review school risk", view: "reporting" },
    { label: "Approve communications", view: "communications" },
    { label: "Inspect operations", view: "operations" }
  ],
  teacher: [
    { label: "Mark attendance", view: "academics" },
    { label: "Publish class material", view: "academics" },
    { label: "Read staff notices", view: "communications" }
  ],
  student: [
    { label: "Open assignments", view: "academics" },
    { label: "Check notices", view: "communications" },
    { label: "Review follow-up work", view: "academics" }
  ],
  parent: [
    { label: "Check child updates", view: "academics" },
    { label: "Read school notices", view: "communications" },
    { label: "View fee account", view: "finance" }
  ],
  bursar: [
    { label: "Post collections", view: "finance" },
    { label: "Queue reminders", view: "finance" },
    { label: "Audit fee setup", view: "operations" }
  ],
  transport: [
    { label: "Update routes", view: "transport" },
    { label: "Send delay notice", view: "communications" },
    { label: "Check assigned students", view: "transport" }
  ],
  support: [
    { label: "Check sync health", view: "operations" },
    { label: "Review storage", view: "operations" },
    { label: "Prepare reports", view: "reporting" }
  ]
};

const editionLabels: Record<NonNullable<SchoolConfig["institutionEdition"]>, string> = {
  "bilingual-k12": "Bilingual K-12",
  tvET: "TVET",
  "higher-education": "Higher education"
};

const countryPackLabels: Record<NonNullable<SchoolConfig["countryPack"]>, string> = {
  "cameroon-bilingual": "Cameroon bilingual pack",
  custom: "Custom pack"
};

function money(value: number) {
  return value.toLocaleString();
}

export function PlatformOverview({
  activeRole,
  demoMode,
  announcements,
  students,
  attendance,
  fees,
  routes,
  continuityItems,
  storageConnections,
  backupTopology,
  schoolConfig,
  corrections,
  syncMutations,
  onOpenView
}: PlatformOverviewProps) {
  const allowedViews = roleWorkspaceAccess[activeRole];
  const roleProfile = roleProfiles[activeRole];
  const atRiskStudents = students.filter((student) => student.riskLevel !== "low");
  const overdueFees = fees.filter((fee) => fee.status === "overdue");
  const partialFees = fees.filter((fee) => fee.status === "partial");
  const urgentAnnouncements = announcements.filter((item) => item.priority === "urgent");
  const delayedRoutes = routes.filter((route) => route.status !== "on-time");
  const absentToday = attendance.filter((entry) => entry.status === "absent");
  const remoteMaterials = continuityItems.filter(
    (item) => item.delivery === "assignment" || item.delivery === "follow-up"
  );
  const activeStorage = storageConnections.filter((item) => item.status === "active");
  const readyBackupLanes = backupTopology?.lanes.filter((lane) => lane.ready) ?? [];
  const linkedFamilies = students.filter((student) => (student.parentUserIds?.length ?? 0) > 0);
  const pendingSync = syncMutations.filter((mutation) => mutation.status === "pending");
  const blockedSync = syncMutations.filter((mutation) => mutation.status === "blocked");
  const appliedCorrections = corrections.filter((correction) => correction.status === "applied");
  const requestedCorrections = corrections.filter(
    (correction) => correction.status === "requested"
  );
  const collectionRate =
    fees.length === 0
      ? 0
      : Math.round(
          (fees.reduce((sum, fee) => sum + fee.amountPaid, 0) /
            fees.reduce((sum, fee) => sum + fee.amountDue, 0)) *
            100
        );

  const visiblePriorities = rolePriorities[activeRole].filter((item) =>
    allowedViews.includes(item.view)
  );

  const engineLayers = [
    {
      title: "DREEM core",
      detail: "Identity, permissions, audit, finance integrity, communications, and sync orchestration.",
      status: "Shared engine",
      metric: `${allowedViews.length} workspaces available`
    },
    {
      title: "Institution edition",
      detail: "The education model above the kernel.",
      status: schoolConfig.institutionEdition
        ? editionLabels[schoolConfig.institutionEdition]
        : "Needs selection",
      metric: schoolConfig.academicYear ?? "Academic year pending"
    },
    {
      title: "Country pack",
      detail: "Local policy, language, and reporting conventions.",
      status: schoolConfig.countryPack
        ? countryPackLabels[schoolConfig.countryPack]
        : "Needs selection",
      metric: `${(schoolConfig.languages ?? []).join(" / ") || "Language setup pending"}`
    },
    {
      title: "School configuration",
      detail: "Campus identity, terminology, classes, subjects, and fees.",
      status: schoolConfig.campusName ?? schoolConfig.schoolName,
      metric: `${schoolConfig.classes.length} classes · ${schoolConfig.subjects.length} subjects · ${schoolConfig.feeCategories.length} fee groups`
    }
  ];

  const operatingTruths = [
    {
      label: "Configured modules",
      value: (schoolConfig.enabledModules ?? []).length,
      detail: `${(schoolConfig.enabledModules ?? []).join(", ") || "No modules enabled yet"}`,
      tone: "cool",
      view: "operations" as WorkspaceView
    },
    {
      label: "Correction engine",
      value: corrections.length,
      detail: `${appliedCorrections.length} applied · ${requestedCorrections.length} awaiting control`,
      tone: corrections.length > 0 ? "warm" : "cool",
      view: "operations" as WorkspaceView
    },
    {
      label: "Offline sync queue",
      value: pendingSync.length + blockedSync.length,
      detail: `${pendingSync.length} pending · ${blockedSync.length} blocked`,
      tone: blockedSync.length > 0 ? "alert" : pendingSync.length > 0 ? "warm" : "good",
      view: "operations" as WorkspaceView
    },
    {
      label: "Family identity links",
      value: linkedFamilies.length,
      detail: `${students.length} learners in registry`,
      tone: linkedFamilies.length > 0 ? "good" : "warm",
      view: "operations" as WorkspaceView
    }
  ].filter((card) => allowedViews.includes(card.view));

  const commandCards = [
    {
      label: "Learners needing support",
      value: atRiskStudents.length,
      detail: `${absentToday.length} absent marks in the register`,
      tone: atRiskStudents.length > 0 ? "warm" : "good",
      view: "academics" as WorkspaceView
    },
    {
      label: "Fee pressure",
      value: overdueFees.length + partialFees.length,
      detail: `${collectionRate}% collection rate`,
      tone: overdueFees.length > 0 ? "alert" : "good",
      view: "finance" as WorkspaceView
    },
    {
      label: "Route exceptions",
      value: delayedRoutes.length,
      detail: `${routes.length} transport routes tracked`,
      tone: delayedRoutes.length > 0 ? "warm" : "good",
      view: "transport" as WorkspaceView
    },
    {
      label: "Urgent notices",
      value: urgentAnnouncements.length,
      detail: `${announcements.length} communications in the feed`,
      tone: urgentAnnouncements.length > 0 ? "alert" : "good",
      view: "communications" as WorkspaceView
    },
    {
      label: "Home learning packs",
      value: remoteMaterials.length,
      detail: "Notes, assignments, and follow-up material",
      tone: "cool",
      view: "academics" as WorkspaceView
    },
    {
      label: "Active storage layers",
      value: backupTopology ? readyBackupLanes.length : activeStorage.length,
      detail: backupTopology
        ? `${backupTopology.lanes.length} backup lanes visible from worker`
        : `${storageConnections.length} storage strategies configured`,
      tone: backupTopology?.ready || activeStorage.length > 0 ? "good" : "warm",
      view: "operations" as WorkspaceView
    }
  ].filter((card) => allowedViews.includes(card.view));

  const workQueue = [
    ...atRiskStudents.slice(0, 2).map((student) => ({
      title: student.fullName,
      detail: `${student.className} needs ${student.riskLevel} risk follow-up`,
      view: "academics" as WorkspaceView,
      tone: "warm"
    })),
    ...overdueFees.slice(0, 2).map((fee) => ({
      title: fee.studentName,
      detail: `Balance ${money(fee.amountDue - fee.amountPaid)} due by ${fee.dueDate}`,
      view: "finance" as WorkspaceView,
      tone: "alert"
    })),
    ...delayedRoutes.slice(0, 2).map((route) => ({
      title: route.routeName,
      detail: `${route.driver} is marked ${route.status} at ${route.nextStop}`,
      view: "transport" as WorkspaceView,
      tone: "warm"
    })),
    ...urgentAnnouncements.slice(0, 2).map((item) => ({
      title: item.title,
      detail: `${item.audience} audience via ${(item.channels ?? ["app"]).join(", ")}`,
      view: "communications" as WorkspaceView,
      tone: "alert"
    }))
  ].filter((item) => allowedViews.includes(item.view));

  const workflowLanes = [
    {
      title: "Identity and onboarding",
      owner: "Admin",
      view: "operations" as WorkspaceView,
      status: students.length > 0 ? "Active" : "Needs setup",
      metric: students.length,
      metricLabel: "student records",
      actions: ["Create learner", "Issue matricule", "Assign role access"]
    },
    {
      title: "Learning continuity",
      owner: "Teacher",
      view: "academics" as WorkspaceView,
      status: remoteMaterials.length > 0 ? "Running" : "Needs materials",
      metric: remoteMaterials.length,
      metricLabel: "home-learning items",
      actions: ["Publish notes", "Add assignment", "Share follow-up"]
    },
    {
      title: "Attendance and support",
      owner: "Teacher + leadership",
      view: "academics" as WorkspaceView,
      status: atRiskStudents.length > 0 ? "Follow-up required" : "Stable",
      metric: atRiskStudents.length,
      metricLabel: "students needing support",
      actions: ["Mark register", "Review absences", "Escalate risk"]
    },
    {
      title: "Bursar money flow",
      owner: "Bursar",
      view: "finance" as WorkspaceView,
      status: overdueFees.length + partialFees.length > 0 ? "Collections open" : "Balanced",
      metric: overdueFees.length + partialFees.length,
      metricLabel: "open fee accounts",
      actions: ["Post payment", "Reverse mistake", "Queue SMS reminder"]
    },
    {
      title: "School communications",
      owner: "Administration",
      view: "communications" as WorkspaceView,
      status: urgentAnnouncements.length > 0 ? "Urgent notices" : "Normal",
      metric: announcements.length,
      metricLabel: "published items",
      actions: ["Publish notice", "Recognize student", "Send transport alert"]
    },
    {
      title: "Transport operations",
      owner: "Transport desk",
      view: "transport" as WorkspaceView,
      status: delayedRoutes.length > 0 ? "Exceptions" : "On schedule",
      metric: delayedRoutes.length,
      metricLabel: "route exceptions",
      actions: ["Update route", "Notify parents", "Track next stop"]
    }
  ].filter((lane) => allowedViews.includes(lane.view));

  const productionReadiness = [
    {
      label: "Role workspaces and workflows",
      status: "Working locally",
      detail: "Role shells, learner onboarding, fee actions, announcements, continuity, transport, and correction views are running in the app."
    },
    {
      label: "Supabase persistence",
      status: demoMode ? "Partially wired" : "Live tables",
      detail: demoMode
        ? "Current session uses demo or local records until the full schema and RLS are applied."
        : "Connected to the configured Supabase project."
    },
    {
      label: "Protected correction history",
      status: corrections.length > 0 ? "Visible in product" : "Structure ready",
      detail: "Payment reversals, fee adjustments, placement changes, duplicate merges, and parent links are modeled and surfaced."
    },
    {
      label: "Offline and Pi node",
      status: syncMutations.length > 0 ? "Partially surfaced" : "Planned",
      detail: "The sync outbox is visible, but the full school-node runtime, conflict handling, and Pi deployment are not production yet."
    }
  ];

  const productFoundation = [
    {
      label: "What is real now",
      items: [
        "Configurable school structure with classes, subjects, fees, modules, and language choices.",
        "Local workflows for learner creation, parent linking, fee posting, settlements, reminders, corrections, and route updates.",
        "Role-based surfaces for leadership, bursar, teacher, parent, student, transport, and support."
      ]
    },
    {
      label: "What still needs hardening",
      items: [
        "Full Supabase migration application with verified RLS on the new operations tables.",
        "True authenticated user lifecycle instead of mostly demo or staged access.",
        "Production sync between browser state, cloud persistence, and later the local school node."
      ]
    }
  ];

  return (
    <section className="overview-workspace">
      <section className="operating-map">
        <div className="map-head">
          <div>
            <span className="eyebrow">DREEM operating system</span>
            <h2>Institution engine, workflows, and delivery truth</h2>
          </div>
          <span className={demoMode ? "status-pill warm" : "status-pill good"}>
            {demoMode ? "Demo/local data" : "Live Supabase data"}
          </span>
        </div>

        <div className="engine-layer-grid">
          {engineLayers.map((layer) => (
            <article key={layer.title} className="engine-layer-card">
              <div className="workflow-lane-head">
                <strong>{layer.title}</strong>
                <span>{layer.status}</span>
              </div>
              <p>{layer.detail}</p>
              <div className="engine-layer-metric">{layer.metric}</div>
            </article>
          ))}
        </div>

        <div className="metric-grid truth-grid">
          {operatingTruths.map((card) => (
            <button
              key={card.label}
              className={`metric-card ${card.tone}`}
              onClick={() => onOpenView(card.view)}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </button>
          ))}
        </div>

        <div className="workflow-lanes">
          {workflowLanes.map((lane) => (
            <button
              key={lane.title}
              className="workflow-lane"
              onClick={() => onOpenView(lane.view)}
            >
              <div className="workflow-lane-head">
                <strong>{lane.title}</strong>
                <span>{lane.status}</span>
              </div>
              <p>{lane.owner}</p>
              <div className="workflow-metric">
                <strong>{lane.metric}</strong>
                <span>{lane.metricLabel}</span>
              </div>
              <div className="module-chip-row">
                {lane.actions.map((action) => (
                  <span key={action} className="mini-tag">
                    {action}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="command-strip">
        <div>
          <span className="eyebrow">Live command center</span>
          <h2>{roleLabels[activeRole]} cockpit</h2>
          <p className="command-copy">{roleProfile.focus}</p>
        </div>
        <div className="command-actions">
          {visiblePriorities.map((item) => (
            <button
              key={item.label}
              className="compact-action"
              onClick={() => onOpenView(item.view)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="metric-grid">
        {commandCards.map((card) => (
          <button
            key={card.label}
            className={`metric-card ${card.tone}`}
            onClick={() => onOpenView(card.view)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </button>
        ))}
      </section>

      <section className="operations-grid">
        <article className="panel queue-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Needs action</span>
              <h2>Today&apos;s operating queue</h2>
            </div>
          </div>

          <div className="work-queue">
            {workQueue.length > 0 ? (
              workQueue.slice(0, 6).map((item) => (
                <button
                  key={`${item.title}-${item.detail}`}
                  className={`work-item ${item.tone}`}
                  onClick={() => onOpenView(item.view)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <strong>No urgent queue for this role.</strong>
                <span>Use the module buttons above to continue routine school work.</span>
              </div>
            )}
          </div>
        </article>

        <article className="panel coverage-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Reality check</span>
              <h2>What is built versus what still needs hardening</h2>
            </div>
          </div>

          <div className="readiness-list">
            {productionReadiness.map((item) => (
              <article key={item.label} className="readiness-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <span className="module-chip">{item.status}</span>
              </article>
            ))}
          </div>

          <div className="foundation-grid">
            {productFoundation.map((column) => (
              <article key={column.label} className="foundation-card">
                <strong>{column.label}</strong>
                <div className="foundation-list">
                  {column.items.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
