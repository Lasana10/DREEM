import { useState } from "react";
import { hasUserPermission } from "../../lib/permissions";
import { rolePermissions, starterSyncEvents } from "../../shared/data";
import type {
  AccessIdentityDraft,
  AuditEvent,
  RoleId,
  SchoolConfig,
  StorageConnection,
  StudentRecord,
  WorkflowCorrection,
  SyncMutation,
  UserProfile,
  WorkspaceView
} from "../../shared/types";

interface OperationsModuleProps {
  activeUser: UserProfile;
  users: UserProfile[];
  students: StudentRecord[];
  auditEvents: AuditEvent[];
  syncMutations: SyncMutation[];
  corrections: WorkflowCorrection[];
  storageConnections: StorageConnection[];
  schoolConfig: SchoolConfig;
  onAddClass: (value: string) => void;
  onRemoveClass: (value: string) => void;
  onAddSubject: (value: string) => void;
  onRemoveSubject: (value: string) => void;
  onAddFeeCategory: (value: string) => void;
  onRemoveFeeCategory: (value: string) => void;
  onUpdateSchoolName: (value: string) => void;
  onUpdateGradingLabel: (value: string) => void;
  onUpdateCurrency: (value: string) => void;
  onUpdateCampusName: (value: string) => void;
  onUpdateAcademicYear: (value: string) => void;
  onUpdateActiveTerm: (value: string) => void;
  onUpdateMatriculePrefix: (value: string) => void;
  onUpdateInstitutionEdition: (value: NonNullable<SchoolConfig["institutionEdition"]>) => void;
  onUpdateCountryPack: (value: NonNullable<SchoolConfig["countryPack"]>) => void;
  onUpdateEnabledModules: (values: WorkspaceView[]) => void;
  onUpdateLanguages: (values: NonNullable<SchoolConfig["languages"]>) => void;
  onUpdateTerminology: (key: string, value: string) => void;
  onProvisionAccess: (draft: AccessIdentityDraft) => Promise<{ ok: boolean; error?: string }>;
  onUpdateAccessStatus: (
    userId: string,
    status: NonNullable<UserProfile["status"]>
  ) => Promise<{ ok: boolean; error?: string }>;
  onCreateStudent: (student: Omit<StudentRecord, "id">) => Promise<void>;
  onLinkParent: (studentId: string, parentUserId: string, parentName: string) => void;
  onChangePlacement: (studentId: string, nextClassName: string, reason: string) => void;
  onMergeStudents: (sourceStudentId: string, targetStudentId: string, reason: string) => void;
}

const configurableModules: WorkspaceView[] = [
  "academics",
  "finance",
  "communications",
  "transport",
  "reporting"
];

const cameroonBilingualStarter = {
  classes: [
    "Nursery 1",
    "Nursery 2",
    "Class 1",
    "Class 2",
    "Class 3",
    "Class 4",
    "Class 5",
    "Class 6",
    "Form 1",
    "Form 2",
    "Form 3",
    "Form 4",
    "Form 5",
    "Lower Sixth",
    "Upper Sixth"
  ],
  subjects: [
    "English Language",
    "French",
    "Mathematics",
    "Science",
    "ICT",
    "History",
    "Geography",
    "Citizenship",
    "Religious Studies",
    "Physical Education"
  ],
  feeCategories: [
    "Registration",
    "Tuition",
    "PTA",
    "Exams",
    "Transport",
    "Uniform",
    "Books",
    "ICT Levy",
    "Meals"
  ]
};

export function OperationsModule({
  activeUser,
  users,
  students,
  auditEvents,
  syncMutations,
  corrections,
  storageConnections,
  schoolConfig,
  onAddClass,
  onRemoveClass,
  onAddSubject,
  onRemoveSubject,
  onAddFeeCategory,
  onRemoveFeeCategory,
  onUpdateSchoolName,
  onUpdateGradingLabel,
  onUpdateCurrency,
  onUpdateCampusName,
  onUpdateAcademicYear,
  onUpdateActiveTerm,
  onUpdateMatriculePrefix,
  onUpdateInstitutionEdition,
  onUpdateCountryPack,
  onUpdateEnabledModules,
  onUpdateLanguages,
  onUpdateTerminology,
  onProvisionAccess,
  onUpdateAccessStatus,
  onCreateStudent,
  onLinkParent,
  onChangePlacement,
  onMergeStudents
}: OperationsModuleProps) {
  const [classDraft, setClassDraft] = useState("");
  const [subjectDraft, setSubjectDraft] = useState("");
  const [feeDraft, setFeeDraft] = useState("");
  const [accessDraft, setAccessDraft] = useState<AccessIdentityDraft>({
    fullName: "",
    role: "student",
    department: "",
    matricule: "",
    email: "",
    phone: ""
  });
  const [accessMessage, setAccessMessage] = useState("");
  const [studentDraft, setStudentDraft] = useState<Omit<StudentRecord, "id">>({
    fullName: "",
    className: "",
    guardian: "",
    guardianRelation: "Parent",
    guardianPhone: "",
    guardianEmail: "",
    matricule: "",
    feeStatus: "partial",
    attendanceRate: 100,
    riskLevel: "low"
  });
  const [studentMessage, setStudentMessage] = useState("");
  const [placementDraft, setPlacementDraft] = useState({
    studentId: "",
    nextClassName: "",
    reason: "Corrected class placement"
  });
  const [mergeDraft, setMergeDraft] = useState({
    sourceStudentId: "",
    targetStudentId: "",
    reason: "Duplicate learner registry entry"
  });
  const [parentLinkDraft, setParentLinkDraft] = useState({
    studentId: "",
    parentUserId: ""
  });
  const activeUsers = users.filter((user) => user.status !== "suspended").length;
  const activeStorage = storageConnections.filter(
    (connection) => connection.status === "active"
  ).length;
  const canConfigureSchool = hasUserPermission(activeUser, "operations.school.configure");
  const canManageUsers = hasUserPermission(activeUser, "operations.users.manage");
  const canManageSync = hasUserPermission(activeUser, "operations.sync.manage");
  const enabledModules = schoolConfig.enabledModules ?? [];
  const activeLanguages = schoolConfig.languages ?? ["en"];
  const terminology = schoolConfig.terminology ?? {};
  const pendingSync = syncMutations.filter((mutation) => mutation.status === "pending");
  const blockedSync = syncMutations.filter((mutation) => mutation.status === "blocked");
  const parentUsers = users.filter((user) => user.role === "parent");
  const approvedUsers = users.filter((user) => user.status !== "suspended");
  const staffUsers = users.filter((user) =>
    ["leadership", "teacher", "bursar", "transport", "support"].includes(user.role)
  );
  const launchChecks = [
    {
      label: "School identity",
      complete: Boolean(schoolConfig.schoolName && schoolConfig.campusName && schoolConfig.matriculePrefix),
      detail: "Name, campus, and matricule prefix"
    },
    {
      label: "Academic year",
      complete: Boolean(schoolConfig.academicYear && schoolConfig.activeTerm),
      detail: "Year and current term"
    },
    {
      label: "Academic structure",
      complete: schoolConfig.classes.length >= 3 && schoolConfig.subjects.length >= 5,
      detail: `${schoolConfig.classes.length} classes · ${schoolConfig.subjects.length} subjects`
    },
    {
      label: "Finance structure",
      complete: schoolConfig.feeCategories.length >= 3,
      detail: `${schoolConfig.feeCategories.length} fee categories`
    },
    {
      label: "Staff access",
      complete: staffUsers.length >= 3,
      detail: `${staffUsers.length} staff accounts`
    },
    {
      label: "Learner registry",
      complete: students.length >= 1,
      detail: `${students.length} learner records`
    },
    {
      label: "Family links",
      complete: students.some((student) => (student.parentUserIds ?? []).length > 0),
      detail: "At least one parent-to-learner link"
    },
    {
      label: "Sync readiness",
      complete: blockedSync.length === 0,
      detail: `${pendingSync.length} pending · ${blockedSync.length} blocked`
    }
  ];
  const completedLaunchChecks = launchChecks.filter((check) => check.complete).length;
  const launchReadiness = Math.round((completedLaunchChecks / launchChecks.length) * 100);

  function updateAccessDraft<K extends keyof AccessIdentityDraft>(
    key: K,
    value: AccessIdentityDraft[K]
  ) {
    setAccessDraft((current) => ({ ...current, [key]: value }));
  }

  function updateStudentDraft<K extends keyof Omit<StudentRecord, "id">>(
    key: K,
    value: Omit<StudentRecord, "id">[K]
  ) {
    setStudentDraft((current) => ({ ...current, [key]: value }));
  }

  async function submitAccessDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessMessage("");

    const result = await onProvisionAccess(accessDraft);
    if (!result.ok) {
      setAccessMessage(result.error ?? "Could not stage access.");
      return;
    }

    setAccessMessage("Access identity staged. In live mode, the backend invite function creates the Supabase Auth user.");
    setAccessDraft({
      fullName: "",
      role: "student",
      department: "",
      matricule: "",
      email: "",
      phone: ""
    });
  }

  async function changeAccessStatus(
    user: UserProfile,
    status: NonNullable<UserProfile["status"]>
  ) {
    setAccessMessage("");
    const result = await onUpdateAccessStatus(user.id, status);

    if (!result.ok) {
      setAccessMessage(result.error ?? "Could not update access status.");
      return;
    }

    setAccessMessage(
      `${user.name} is now ${status === "suspended" ? "suspended" : "active"} in this school.`
    );
  }

  async function submitStudentDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStudentMessage("");

    if (!studentDraft.fullName.trim() || !studentDraft.className.trim() || !studentDraft.guardian.trim()) {
      setStudentMessage("Learner name, class, and guardian are required.");
      return;
    }

    await onCreateStudent({
      ...studentDraft,
      fullName: studentDraft.fullName.trim(),
      className: studentDraft.className.trim(),
      guardian: studentDraft.guardian.trim(),
      guardianRelation: studentDraft.guardianRelation?.trim(),
      guardianPhone: studentDraft.guardianPhone?.trim(),
      guardianEmail: studentDraft.guardianEmail?.trim(),
      matricule: studentDraft.matricule?.trim()
    });

    setStudentMessage("Learner record created.");
    setStudentDraft({
      fullName: "",
      className: "",
      guardian: "",
      guardianRelation: "Parent",
      guardianPhone: "",
      guardianEmail: "",
      matricule: "",
      feeStatus: "partial",
      attendanceRate: 100,
      riskLevel: "low"
    });
  }

  function toggleModule(module: WorkspaceView) {
    if (!canConfigureSchool) {
      return;
    }

    const nextModules = enabledModules.includes(module)
      ? enabledModules.filter((item) => item !== module)
      : [...enabledModules, module];

    onUpdateEnabledModules(nextModules);
  }

  function toggleLanguage(language: "en" | "fr") {
    if (!canConfigureSchool) {
      return;
    }

    const nextLanguages = activeLanguages.includes(language)
      ? activeLanguages.filter((item) => item !== language)
      : [...activeLanguages, language];

    onUpdateLanguages(nextLanguages.length > 0 ? nextLanguages : [language]);
  }

  function submitPlacementChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placementDraft.studentId || !placementDraft.nextClassName.trim()) {
      return;
    }

    onChangePlacement(
      placementDraft.studentId,
      placementDraft.nextClassName,
      placementDraft.reason
    );
    setPlacementDraft({
      studentId: "",
      nextClassName: "",
      reason: "Corrected class placement"
    });
  }

  function submitMerge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !mergeDraft.sourceStudentId ||
      !mergeDraft.targetStudentId ||
      mergeDraft.sourceStudentId === mergeDraft.targetStudentId
    ) {
      return;
    }

    onMergeStudents(mergeDraft.sourceStudentId, mergeDraft.targetStudentId, mergeDraft.reason);
    setMergeDraft({
      sourceStudentId: "",
      targetStudentId: "",
      reason: "Duplicate learner registry entry"
    });
  }

  function submitParentLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parent = parentUsers.find((user) => user.id === parentLinkDraft.parentUserId);
    if (!parent || !parentLinkDraft.studentId) {
      return;
    }

    onLinkParent(parentLinkDraft.studentId, parent.id, parent.name);
    setParentLinkDraft({
      studentId: "",
      parentUserId: ""
    });
  }

  function applyCameroonBilingualBlueprint() {
    if (!canConfigureSchool) {
      return;
    }

    onUpdateInstitutionEdition("bilingual-k12");
    onUpdateCountryPack("cameroon-bilingual");
    onUpdateEnabledModules(["academics", "finance", "communications", "transport", "reporting"]);
    onUpdateLanguages(["en", "fr"]);
    onUpdateMatriculePrefix(schoolConfig.matriculePrefix || "DRM");
    onUpdateAcademicYear(schoolConfig.academicYear || "2026/2027");
    onUpdateActiveTerm(schoolConfig.activeTerm || "Term 1");
    onUpdateTerminology("student", "Learner");
    onUpdateTerminology("class", "Class");
    onUpdateTerminology("guardian", "Parent / guardian");
    cameroonBilingualStarter.classes.forEach(onAddClass);
    cameroonBilingualStarter.subjects.forEach(onAddSubject);
    cameroonBilingualStarter.feeCategories.forEach(onAddFeeCategory);
  }

  return (
    <section className="module-surface">
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">DREEM platform model</span>
            <h2>One engine, this school’s own operating system</h2>
          </div>
          <span className="module-chip">No code fork</span>
        </div>
        <p className="section-copy">
          Core controls stay protected while the school owns its identity,
          terminology, enabled modules, academic structure, fees, and approval
          rules. This is the boundary that makes every institution unique without
          making upgrades unsafe.
        </p>
        <div className="announcement-stats">
          <article className="signal-card cool">
            <span>Institution edition</span>
            <strong>{schoolConfig.institutionEdition ?? "bilingual-k12"}</strong>
          </article>
          <article className="signal-card warm">
            <span>Country pack</span>
            <strong>{schoolConfig.countryPack ?? "cameroon-bilingual"}</strong>
          </article>
          <article className="signal-card good">
            <span>Personalised modules</span>
            <strong>{schoolConfig.enabledModules?.length ?? 0}</strong>
          </article>
        </div>
        <div className="table-list">
          <article className="record-row">
            <div>
              <strong>DREEM Core</strong>
              <p>Identity, permissions, transaction integrity, audit, sync, documents.</p>
            </div>
            <span className="module-chip">protected</span>
          </article>
          <article className="record-row">
            <div>
              <strong>School configuration</strong>
              <p>{schoolConfig.schoolName} · {schoolConfig.campusName ?? "Main Campus"} · {schoolConfig.languages?.join(" / ") ?? "en"}</p>
            </div>
            <span className="module-chip">editable by admin</span>
          </article>
          <article className="record-row">
            <div>
              <strong>Enabled capabilities</strong>
              <p>{schoolConfig.enabledModules?.join(" · ") ?? "Configure modules in this workspace"}</p>
            </div>
            <span className="module-chip">school-owned</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">School launch engine</span>
            <h2>Repeatable onboarding, not custom setup chaos</h2>
          </div>
          <span className={launchReadiness >= 75 ? "status-pill good" : "status-pill warm"}>
            {launchReadiness}% ready
          </span>
        </div>

        <p className="section-copy">
          This is the operator checklist that makes DREEM scalable: every school can
          become unique through configuration while the protected core stays stable.
        </p>

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>Setup checks done</span>
            <strong>{completedLaunchChecks}/{launchChecks.length}</strong>
          </article>
          <article className="signal-card cool">
            <span>Approved users</span>
            <strong>{approvedUsers.length}</strong>
          </article>
          <article className="signal-card warm">
            <span>Classes / subjects</span>
            <strong>{schoolConfig.classes.length}/{schoolConfig.subjects.length}</strong>
          </article>
          <article className="signal-card alert">
            <span>Blocked sync</span>
            <strong>{blockedSync.length}</strong>
          </article>
        </div>

        <div className="config-band">
          <div>
            <strong>Cameroon bilingual private K-12 starter</strong>
            <p>
              Applies a serious first structure for classes, subjects, fee categories,
              modules, bilingual language mode, and matricule defaults.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={!canConfigureSchool}
            onClick={applyCameroonBilingualBlueprint}
          >
            Apply launch blueprint
          </button>
        </div>

        <div className="table-list">
          {launchChecks.map((check) => (
            <article key={check.label} className="record-row">
              <div>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
              <span className={check.complete ? "module-chip active-chip" : "module-chip"}>
                {check.complete ? "ready" : "missing"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel setup-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Institution blueprint</span>
            <h2>Edition, country pack, modules, and terminology</h2>
          </div>
        </div>

        <div className="setup-grid">
          <label className="composer">
            <span>Institution edition</span>
            <select
              value={schoolConfig.institutionEdition ?? "bilingual-k12"}
              disabled={!canConfigureSchool}
              onChange={(event) =>
                onUpdateInstitutionEdition(
                  event.target.value as NonNullable<SchoolConfig["institutionEdition"]>
                )
              }
            >
              <option value="bilingual-k12">Bilingual K-12</option>
              <option value="tvET">TVET / professional school</option>
              <option value="higher-education">Higher education</option>
            </select>
          </label>

          <label className="composer">
            <span>Country pack</span>
            <select
              value={schoolConfig.countryPack ?? "cameroon-bilingual"}
              disabled={!canConfigureSchool}
              onChange={(event) =>
                onUpdateCountryPack(event.target.value as NonNullable<SchoolConfig["countryPack"]>)
              }
            >
              <option value="cameroon-bilingual">Cameroon bilingual</option>
              <option value="custom">Custom country pack</option>
            </select>
          </label>
        </div>

        <div className="config-band">
          <div>
            <strong>Enabled modules</strong>
            <p>Admins choose the school operating surface without changing code.</p>
          </div>
          <div className="module-chip-row">
            {configurableModules.map((module) => (
              <button
                key={module}
                type="button"
                className={enabledModules.includes(module) ? "module-chip active-chip" : "module-chip"}
                disabled={!canConfigureSchool}
                onClick={() => toggleModule(module)}
              >
                {module}
              </button>
            ))}
          </div>
        </div>

        <div className="config-band">
          <div>
            <strong>Languages</strong>
            <p>Run English, French, or bilingual school operations.</p>
          </div>
          <div className="module-chip-row">
            {(["en", "fr"] as const).map((language) => (
              <button
                key={language}
                type="button"
                className={activeLanguages.includes(language) ? "module-chip active-chip" : "module-chip"}
                disabled={!canConfigureSchool}
                onClick={() => toggleLanguage(language)}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-grid">
          <label className="composer">
            <span>Student label</span>
            <input
              value={terminology.student ?? "Learner"}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateTerminology("student", event.target.value)}
            />
          </label>
          <label className="composer">
            <span>Class label</span>
            <input
              value={terminology.class ?? "Class"}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateTerminology("class", event.target.value)}
            />
          </label>
          <label className="composer">
            <span>Guardian label</span>
            <input
              value={terminology.guardian ?? "Parent / guardian"}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateTerminology("guardian", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Placement correction</span>
            <h2>Transfer or correct a learner class</h2>
          </div>
        </div>

        <form className="composer" onSubmit={submitPlacementChange}>
          <div className="composer-grid">
            <label>
              <span>Learner</span>
              <select
                disabled={!canConfigureSchool}
                value={placementDraft.studentId}
                onChange={(event) =>
                  setPlacementDraft((current) => ({ ...current, studentId: event.target.value }))
                }
              >
                <option value="">Choose learner</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} - {student.className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>New class</span>
              <select
                disabled={!canConfigureSchool}
                value={placementDraft.nextClassName}
                onChange={(event) =>
                  setPlacementDraft((current) => ({ ...current, nextClassName: event.target.value }))
                }
              >
                <option value="">Choose class</option>
                {schoolConfig.classes.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Reason</span>
              <input
                disabled={!canConfigureSchool}
                value={placementDraft.reason}
                onChange={(event) =>
                  setPlacementDraft((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
          </div>
          <button className="primary-button" disabled={!canConfigureSchool} type="submit">
            Apply audited placement change
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Duplicate correction</span>
            <h2>Merge duplicate learner records</h2>
          </div>
        </div>

        <form className="composer" onSubmit={submitMerge}>
          <div className="composer-grid">
            <label>
              <span>Duplicate record</span>
              <select
                disabled={!canConfigureSchool}
                value={mergeDraft.sourceStudentId}
                onChange={(event) =>
                  setMergeDraft((current) => ({ ...current, sourceStudentId: event.target.value }))
                }
              >
                <option value="">Choose source record</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} - {student.className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Keep as primary</span>
              <select
                disabled={!canConfigureSchool}
                value={mergeDraft.targetStudentId}
                onChange={(event) =>
                  setMergeDraft((current) => ({ ...current, targetStudentId: event.target.value }))
                }
              >
                <option value="">Choose target record</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} - {student.className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Reason</span>
              <input
                disabled={!canConfigureSchool}
                value={mergeDraft.reason}
                onChange={(event) =>
                  setMergeDraft((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
          </div>
          <button className="primary-button" disabled={!canConfigureSchool} type="submit">
            Apply audited merge
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Institution control</span>
            <h2>Users and access</h2>
          </div>
        </div>

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>Active users</span>
            <strong>{activeUsers}</strong>
          </article>
          <article className="signal-card warm">
            <span>Storage links</span>
            <strong>{activeStorage}</strong>
          </article>
          <article className="signal-card cool">
            <span>School-owned controls</span>
            <strong>3</strong>
          </article>
        </div>

        <div className="table-list">
          {users.map((user) => (
            <article key={user.id} className="record-row">
              <div>
                <strong>{user.name}</strong>
                <p>
                  {user.role} · {user.department} · {user.matricule}
                </p>
                <p>
                  Permissions {rolePermissions[user.role].length}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{user.status ?? "active"}</span>
                {user.email ? <span className="module-chip">{user.email}</span> : null}
                {user.phone ? <span className="module-chip">{user.phone}</span> : null}
                {canManageUsers && user.id !== activeUser.id ? (
                  user.status === "suspended" ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void changeAccessStatus(user, "active")}
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() => void changeAccessStatus(user, "suspended")}
                    >
                      Suspend
                    </button>
                  )
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Controlled onboarding</span>
            <h2>Issue matricules and access identities</h2>
          </div>
        </div>

        <p className="section-copy">
          Schools should not have open signup. Admins create the person, role,
          matricule, and OTP/password channel; production should complete this via
          a Supabase Edge Function with service credentials.
        </p>

        <form className="composer" onSubmit={submitAccessDraft}>
          <div className="composer-grid">
            <label>
              <span>Full name</span>
              <input
                disabled={!canManageUsers}
                value={accessDraft.fullName}
                onChange={(event) => updateAccessDraft("fullName", event.target.value)}
                placeholder="Student, parent, teacher, bursar..."
              />
            </label>
            <label>
              <span>Role</span>
              <select
                disabled={!canManageUsers}
                value={accessDraft.role}
                onChange={(event) => updateAccessDraft("role", event.target.value as RoleId)}
              >
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="teacher">Teacher</option>
                <option value="bursar">Bursar</option>
                <option value="transport">Transport</option>
                <option value="support">Support</option>
                <option value="leadership">Leadership</option>
              </select>
            </label>
            <label>
              <span>Department / class</span>
              <input
                disabled={!canManageUsers}
                value={accessDraft.department}
                onChange={(event) => updateAccessDraft("department", event.target.value)}
                placeholder="Form 2A, Finance, Transport..."
              />
            </label>
            <label>
              <span>Matricule</span>
              <input
                disabled={!canManageUsers}
                value={accessDraft.matricule}
                onChange={(event) => updateAccessDraft("matricule", event.target.value)}
                placeholder="DRM-STD-0004"
              />
            </label>
            <label>
              <span>Email</span>
              <input
                disabled={!canManageUsers}
                value={accessDraft.email}
                onChange={(event) => updateAccessDraft("email", event.target.value)}
                placeholder="optional for OTP/password"
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                disabled={!canManageUsers}
                value={accessDraft.phone}
                onChange={(event) => updateAccessDraft("phone", event.target.value)}
                placeholder="+237..."
              />
            </label>
          </div>

          <button className="primary-button" disabled={!canManageUsers} type="submit">
            Stage controlled access
          </button>
          {accessMessage ? <p className="loading-note">{accessMessage}</p> : null}
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">School configuration</span>
            <h2>Admin-owned structure</h2>
          </div>
        </div>

        <div className="table-list">
          <label className="composer">
            <span>School name</span>
            <input
              value={schoolConfig.schoolName}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateSchoolName(event.target.value)}
            />
          </label>

          <label className="composer">
            <span>Campus</span>
            <input
              value={schoolConfig.campusName ?? ""}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateCampusName(event.target.value)}
            />
          </label>

          <label className="composer">
            <span>Academic year</span>
            <input
              value={schoolConfig.academicYear ?? ""}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateAcademicYear(event.target.value)}
            />
          </label>

          <label className="composer">
            <span>Active term</span>
            <input
              value={schoolConfig.activeTerm ?? ""}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateActiveTerm(event.target.value)}
            />
          </label>

          <label className="composer">
            <span>Grading system</span>
            <input
              value={schoolConfig.gradingLabel}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateGradingLabel(event.target.value)}
            />
          </label>

          <label className="composer">
            <span>Currency</span>
            <input
              value={schoolConfig.currency}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateCurrency(event.target.value)}
            />
          </label>

          <label className="composer">
            <span>Matricule prefix</span>
            <input
              value={schoolConfig.matriculePrefix ?? ""}
              disabled={!canConfigureSchool}
              onChange={(event) => onUpdateMatriculePrefix(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Audit trail</span>
            <h2>Accountability activity</h2>
          </div>
        </div>

        <div className="table-list">
          {auditEvents.slice(0, 8).map((event) => (
            <article key={event.id} className="record-row">
              <div>
                <strong>{event.action}</strong>
                <p>
                  {event.actor} · {event.target} · {event.createdAt}
                </p>
                <p>{event.detail}</p>
              </div>
              <span className="module-chip">{event.severity}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Correction ledger</span>
            <h2>Operational fixes with history</h2>
          </div>
        </div>

        <div className="table-list">
          {corrections.slice(0, 10).map((correction) => (
            <article key={correction.id} className="record-row">
              <div>
                <strong>{correction.type}</strong>
                <p>
                  {correction.originalRecordId}
                  {correction.replacementRecordId ? ` -> ${correction.replacementRecordId}` : ""}
                </p>
                <p>{correction.reason}</p>
              </div>
              <div className="action-row">
                <span className="module-chip">{correction.status}</span>
                <span className="module-chip">{correction.requestedBy}</span>
              </div>
            </article>
          ))}
          {corrections.length === 0 ? (
            <article className="record-row">
              <div>
                <strong>No correction history yet.</strong>
                <p>Reversals, placements, invoice changes, and duplicate merges will appear here.</p>
              </div>
              <span className="module-chip">empty</span>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Offline sync outbox</span>
            <h2>Pending operational mutations</h2>
          </div>
          <div className="action-row">
            <span className="module-chip">{pendingSync.length} pending</span>
            <span className="module-chip">{blockedSync.length} blocked</span>
          </div>
        </div>

        <div className="table-list">
          {syncMutations.slice(0, 8).map((mutation) => (
            <article key={mutation.id} className="record-row">
              <div>
                <strong>{mutation.entity}</strong>
                <p>
                  {mutation.operation} · {mutation.targetId} · {mutation.createdAt}
                </p>
                {mutation.lastError ? <p>{mutation.lastError}</p> : null}
              </div>
              <div className="action-row">
                <span className="module-chip">{canManageSync ? mutation.status : "view-only"}</span>
                <span className="module-chip">{mutation.schoolId ?? "demo-school"}</span>
              </div>
            </article>
          ))}
          {syncMutations.length === 0 ? (
            <article className="record-row">
              <div>
                <strong>No local mutations waiting.</strong>
                <p>New attendance, finance, student, and transport changes will appear here before cloud sync.</p>
              </div>
              <span className="module-chip">empty</span>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Learner registry</span>
            <h2>Create student and guardian records</h2>
          </div>
        </div>

        <p className="section-copy">
          This is the beginning of the actual school registry layer: learner class,
          matricule, fee posture, risk posture, and guardian contact details.
        </p>

        <form className="composer" onSubmit={submitStudentDraft}>
          <div className="composer-grid">
            <label>
              <span>Learner name</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.fullName}
                onChange={(event) => updateStudentDraft("fullName", event.target.value)}
                placeholder="Full learner name"
              />
            </label>
            <label>
              <span>Class</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.className}
                onChange={(event) => updateStudentDraft("className", event.target.value)}
                placeholder="Form 2A"
              />
            </label>
            <label>
              <span>School matricule</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.matricule ?? ""}
                onChange={(event) => updateStudentDraft("matricule", event.target.value)}
                placeholder="STD-2026-0104"
              />
            </label>
            <label>
              <span>Guardian name</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.guardian}
                onChange={(event) => updateStudentDraft("guardian", event.target.value)}
                placeholder="Parent or guardian"
              />
            </label>
            <label>
              <span>Relation</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.guardianRelation ?? ""}
                onChange={(event) => updateStudentDraft("guardianRelation", event.target.value)}
                placeholder="Mother, Father, Aunt..."
              />
            </label>
            <label>
              <span>Guardian phone</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.guardianPhone ?? ""}
                onChange={(event) => updateStudentDraft("guardianPhone", event.target.value)}
                placeholder="+237..."
              />
            </label>
            <label>
              <span>Guardian email</span>
              <input
                disabled={!canConfigureSchool}
                value={studentDraft.guardianEmail ?? ""}
                onChange={(event) => updateStudentDraft("guardianEmail", event.target.value)}
                placeholder="guardian@example.com"
              />
            </label>
            <label>
              <span>Fee status</span>
              <select
                disabled={!canConfigureSchool}
                value={studentDraft.feeStatus}
                onChange={(event) =>
                  updateStudentDraft("feeStatus", event.target.value as StudentRecord["feeStatus"])
                }
              >
                <option value="clear">Clear</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label>
              <span>Risk level</span>
              <select
                disabled={!canConfigureSchool}
                value={studentDraft.riskLevel}
                onChange={(event) =>
                  updateStudentDraft("riskLevel", event.target.value as StudentRecord["riskLevel"])
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <button className="primary-button" disabled={!canConfigureSchool} type="submit">
            Create learner record
          </button>
          {studentMessage ? <p className="loading-note">{studentMessage}</p> : null}
        </form>

        <div className="table-list">
          {students.slice(0, 8).map((student) => (
            <article key={student.id} className="record-row">
              <div>
                <strong>{student.fullName}</strong>
                <p>
                  {student.className}
                  {student.matricule ? ` · ${student.matricule}` : ""}
                  {student.guardianRelation ? ` · ${student.guardianRelation}` : ""}
                </p>
                <p>
                  {student.guardian}
                  {student.guardianPhone ? ` · ${student.guardianPhone}` : ""}
                  {student.guardianEmail ? ` · ${student.guardianEmail}` : ""}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{student.feeStatus}</span>
                <span className="module-chip">{student.riskLevel}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Family identity linking</span>
            <h2>Attach parent accounts to learners</h2>
          </div>
        </div>

        <form className="composer" onSubmit={submitParentLink}>
          <div className="composer-grid">
            <label>
              <span>Learner</span>
              <select
                disabled={!canManageUsers}
                value={parentLinkDraft.studentId}
                onChange={(event) =>
                  setParentLinkDraft((current) => ({ ...current, studentId: event.target.value }))
                }
              >
                <option value="">Choose learner</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} - {student.className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Parent account</span>
              <select
                disabled={!canManageUsers}
                value={parentLinkDraft.parentUserId}
                onChange={(event) =>
                  setParentLinkDraft((current) => ({ ...current, parentUserId: event.target.value }))
                }
              >
                <option value="">Choose parent</option>
                {parentUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.matricule}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="primary-button" disabled={!canManageUsers} type="submit">
            Link family account
          </button>
        </form>

        <div className="table-list">
          {students.slice(0, 8).map((student) => (
            <article key={student.id} className="record-row">
              <div>
                <strong>{student.fullName}</strong>
                <p>{student.className}{student.matricule ? ` · ${student.matricule}` : ""}</p>
              </div>
              <div className="action-row">
                <span className="module-chip">
                  {student.parentUserIds?.length ? `${student.parentUserIds.length} linked parent(s)` : "no linked parent"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Sync and resilience</span>
            <h2>Cloud, OneDrive, and local node readiness</h2>
          </div>
        </div>

        <div className="table-list">
          {starterSyncEvents.map((event) => (
            <article key={event.id} className="record-row">
              <div>
                <strong>{event.label}</strong>
                <p>{event.detail}</p>
                <p>{event.updatedAt}</p>
              </div>
              <div className="action-row">
                <span className="module-chip">{event.target}</span>
                <span className="module-chip">{canManageSync ? event.status : "view-only"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Academic structure</span>
            <h2>Classes and subjects</h2>
          </div>
        </div>

        <label className="composer">
          <span>Add class</span>
          <input
            value={classDraft}
            disabled={!canConfigureSchool}
            onChange={(event) => setClassDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfigureSchool) {
                onAddClass(classDraft);
                setClassDraft("");
              }
            }}
          />
        </label>

        <div className="action-row">
          {schoolConfig.classes.map((item) => (
            <button
              key={item}
              className="module-chip"
              disabled={!canConfigureSchool}
              onClick={() => onRemoveClass(item)}
            >
              {item} x
            </button>
          ))}
        </div>

        <label className="composer">
          <span>Add subject</span>
          <input
            value={subjectDraft}
            disabled={!canConfigureSchool}
            onChange={(event) => setSubjectDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfigureSchool) {
                onAddSubject(subjectDraft);
                setSubjectDraft("");
              }
            }}
          />
        </label>

        <div className="action-row">
          {schoolConfig.subjects.map((item) => (
            <button
              key={item}
              className="module-chip"
              disabled={!canConfigureSchool}
              onClick={() => onRemoveSubject(item)}
            >
              {item} x
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Bursar structure</span>
            <h2>Fee categories</h2>
          </div>
        </div>

        <label className="composer">
          <span>Add fee category</span>
          <input
            value={feeDraft}
            disabled={!canConfigureSchool}
            onChange={(event) => setFeeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfigureSchool) {
                onAddFeeCategory(feeDraft);
                setFeeDraft("");
              }
            }}
          />
        </label>

        <div className="action-row">
          {schoolConfig.feeCategories.map((item) => (
            <button
              key={item}
              className="module-chip"
              disabled={!canConfigureSchool}
              onClick={() => onRemoveFeeCategory(item)}
            >
              {item} x
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Storage and continuity</span>
            <h2>Connected backends</h2>
          </div>
        </div>

        <div className="table-list">
          {storageConnections.map((connection) => (
            <article key={connection.provider} className="record-row">
              <div>
                <strong>{connection.label}</strong>
                <p>{connection.purpose}</p>
              </div>
              <span className="module-chip">{connection.status}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
