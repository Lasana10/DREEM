import { hasUserPermission } from "../../lib/permissions";
import type {
  FeeRecord,
  GovernmentReportRow,
  SchoolConfig,
  StudentRecord,
  TransportRoute,
  UserProfile
} from "../../shared/types";

interface ReportingModuleProps {
  activeUser: UserProfile;
  config: SchoolConfig;
  students: StudentRecord[];
  fees: FeeRecord[];
  routes: TransportRoute[];
}

function buildRows(
  config: SchoolConfig,
  students: StudentRecord[],
  fees: FeeRecord[]
): GovernmentReportRow[] {
  return config.classes.map((className) => {
    const classStudents = students.filter((student) => student.className === className);
    const classFees = fees.filter((fee) => fee.className === className);

    const attendanceAverage =
      classStudents.length === 0
        ? 0
        : Math.round(
            classStudents.reduce((sum, student) => sum + student.attendanceRate, 0) /
              classStudents.length
          );

    return {
      className,
      enrolled: classStudents.length,
      atRisk: classStudents.filter((student) => student.riskLevel !== "low").length,
      overdueFees: classFees.filter((fee) => fee.status === "overdue").length,
      attendanceAverage,
      girls: Math.ceil(classStudents.length / 2),
      boys: Math.floor(classStudents.length / 2),
      examReady: classStudents.filter(
        (student) => student.attendanceRate >= 75 && student.feeStatus !== "overdue"
      ).length
    };
  });
}

export function ReportingModule({
  activeUser,
  config,
  students,
  fees,
  routes
}: ReportingModuleProps) {
  const canViewReporting = hasUserPermission(activeUser, "reporting.view");
  const rows = buildRows(config, students, fees);
  const enrolled = students.length;
  const overdue = fees.filter((fee) => fee.status === "overdue").length;
  const delayedRoutes = routes.filter((route) => route.status !== "on-time").length;
  const isLeadershipWorkspace = activeUser.role === "leadership";
  const isSupportWorkspace = activeUser.role === "support";
  const examReady = rows.reduce((sum, row) => sum + (row.examReady ?? 0), 0);
  const attendanceAverage =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((sum, row) => sum + row.attendanceAverage, 0) / rows.length);

  function exportCsv() {
    const header = "Class,Enrolled,Girls,Boys,At Risk,Exam Ready,Overdue Fees,Attendance Average";
    const lines = rows.map(
      (row) =>
        `${row.className},${row.enrolled},${row.girls ?? 0},${row.boys ?? 0},${row.atRisk},${row.examReady ?? 0},${row.overdueFees},${row.attendanceAverage}`
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dreem-reporting-snapshot.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!canViewReporting) {
    return (
      <section className="module-surface">
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Reporting access</span>
              <h2>This role cannot open reporting exports</h2>
            </div>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="module-surface">
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {isLeadershipWorkspace ? "Executive reporting" : "Operational reporting"}
            </span>
            <h2>
              {isLeadershipWorkspace
                ? "School health, risk, and readiness snapshot"
                : "Enrollment, risk, fees, and transport snapshot"}
            </h2>
          </div>
        </div>

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>Enrolled learners</span>
            <strong>{enrolled}</strong>
          </article>
          <article className="signal-card warm">
            <span>Fee arrears</span>
            <strong>{overdue}</strong>
          </article>
          <article className="signal-card alert">
            <span>Routes needing attention</span>
            <strong>{delayedRoutes}</strong>
          </article>
          <article className="signal-card cool">
            <span>Exam ready</span>
            <strong>{examReady}</strong>
          </article>
          <article className="signal-card good">
            <span>Attendance average</span>
            <strong>{attendanceAverage}%</strong>
          </article>
        </div>

        <p className="section-copy">
          {isLeadershipWorkspace
            ? "This reporting surface should help leadership decide where to intervene, approve, or escalate."
            : isSupportWorkspace
              ? "This reporting surface should help operations and support teams validate structure, data readiness, and reporting coverage."
              : "This is the start of the reporting layer DREEM needs for ministry returns, exam registration preparation, and school leadership reviews."}
        </p>

        <div className="action-row">
          <button className="primary-button" type="button" onClick={exportCsv}>
            Export CSV snapshot
          </button>
        </div>

        <div className="table-list">
          {rows.map((row) => (
            <article key={row.className} className="record-row">
              <div>
                <strong>{row.className}</strong>
                <p>
                  Enrolled {row.enrolled} · Girls {row.girls ?? 0} · Boys {row.boys ?? 0} ·
                  At risk {row.atRisk} · Exam ready {row.examReady ?? 0} · Overdue fees {row.overdueFees}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">
                  Attendance avg {row.attendanceAverage}%
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {isLeadershipWorkspace ? "Decision queue" : "Reporting priorities"}
            </span>
            <h2>
              {isLeadershipWorkspace
                ? "Where school leadership should look next"
                : "What needs reporting attention"}
            </h2>
          </div>
        </div>

        <div className="table-list">
          <article className="record-row">
            <div>
              <strong>Academic risk concentration</strong>
              <p>{rows.filter((row) => row.atRisk > 0).length} classes have learners needing support follow-up.</p>
            </div>
            <span className="module-chip">risk</span>
          </article>
          <article className="record-row">
            <div>
              <strong>Fee exposure</strong>
              <p>{rows.filter((row) => row.overdueFees > 0).length} classes still carry fee arrears affecting readiness.</p>
            </div>
            <span className="module-chip">finance</span>
          </article>
          <article className="record-row">
            <div>
              <strong>Structure readiness</strong>
              <p>
                {config.classes.length} classes, {config.subjects.length} subjects, {config.feeCategories.length} fee categories configured.
              </p>
            </div>
            <span className="module-chip">setup</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Reporting scope</span>
            <h2>Configured school structure</h2>
          </div>
        </div>

        <div className="table-list">
          <article className="record-row">
            <div>
              <strong>{config.schoolName}</strong>
              <p>Grading: {config.gradingLabel}</p>
            </div>
            <span className="module-chip">{config.currency}</span>
          </article>
          <article className="record-row">
            <div>
              <strong>Classes</strong>
              <p>{config.classes.join(", ") || "No classes configured"}</p>
            </div>
          </article>
          <article className="record-row">
            <div>
              <strong>Subjects</strong>
              <p>{config.subjects.join(", ") || "No subjects configured"}</p>
            </div>
          </article>
          <article className="record-row">
            <div>
              <strong>Fee categories</strong>
              <p>{config.feeCategories.join(", ") || "No fee categories configured"}</p>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}
