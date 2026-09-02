export type Role =
  | "platform_founder"
  | "school_owner"
  | "principal"
  | "administrator"
  | "academic_head"
  | "bursar"
  | "accountant"
  | "teacher"
  | "tutor"
  | "transport_manager"
  | "driver"
  | "security_guard"
  | "parent"
  | "student"
  | "auditor";

export type SignalSeverity = "normal" | "important" | "urgent" | "safeguarding";
export type SignalStatus =
  "new" | "triaged" | "assigned" | "in_progress" | "resolved" | "closed";

export interface SchoolBrand {
  name: string;
  shortName: string;
  motto: string;
  address: string;
  city: string;
  subsystem: "anglophone" | "francophone" | "bilingual";
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  receiptPrefix: string;
  studentIdPrefix: string;
  timezone: string;
  currency: string;
}

export interface AcademicYearConfig {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "planning" | "active" | "closed";
}

export interface TermConfig {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  orderIndex: number;
}

export interface ClassConfig {
  id: string;
  academicYearId?: string;
  name: string;
  sectionName: string;
  streamName: string;
  levelName: string;
}

export interface SubjectConfig {
  id: string;
  name: string;
  code: string;
  subsystem: "anglophone" | "francophone" | "bilingual";
  gradingWeight: number;
}

export interface SchoolSetup {
  academicYears: AcademicYearConfig[];
  terms: TermConfig[];
  classes: ClassConfig[];
  subjects: SubjectConfig[];
}

export interface BootstrapStatus {
  mode:
    "ready" | "claimed" | "pending" | "rejected" | "approved" | "restricted";
  canBootstrap: boolean;
  schoolId?: string;
  role?: string;
  status?: string;
}

export interface BootstrapPayload {
  schoolName: string;
  schoolSlug: string;
  shortName: string;
  motto: string;
  city: string;
  subsystem: "anglophone" | "francophone" | "bilingual";
  receiptPrefix: string;
  studentIdPrefix: string;
  primaryColor: string;
  accentColor: string;
}

export interface LearnerSummary {
  id: string;
  matricule: string;
  name: string;
  className: string;
  photoUrl?: string;
  mastery: number;
  attendance: number;
  engagement: number;
  wellbeing: number;
  trend: number;
  nextAction: string;
  interventionOwner?: string;
  idStatus: "active" | "expired" | "revoked";
  feeAccountId?: string;
  feeBalance?: number;
}

export interface StaffInvitation {
  id: string;
  email: string;
  fullName: string;
  role: Exclude<Role, "platform_founder" | "parent" | "student">;
  status: "pending" | "accepted" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface AccessMembership {
  id: string;
  profileId: string;
  name: string;
  role: Role;
  status: "pending" | "approved" | "suspended" | "rejected";
}

export interface EnrollmentPayload {
  fullName: string;
  className: string;
  dateOfBirth?: string;
  sex?: "female" | "male" | "other";
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  relationship: string;
  openingBalance: number;
  idempotencyKey: string;
}

export interface EnrollmentResult {
  studentId: string;
  matricule: string;
}

export interface CredentialIssueResult {
  credentialId: string;
  verificationToken: string;
}

export interface AttendanceMarkInput {
  studentId: string;
  status: "present" | "late" | "absent" | "excused";
  note?: string;
}

export interface AttendanceCommand {
  className: string;
  sessionDate: string;
  periodLabel: string;
  marks: AttendanceMarkInput[];
  idempotencyKey: string;
}

export interface AssessmentMarkInput {
  studentId: string;
  score: number;
  comment?: string;
}

export interface AssessmentCommand {
  subjectId?: string;
  className: string;
  title: string;
  assessmentType?:
    | "quiz"
    | "assignment"
    | "test"
    | "exam"
    | "mock"
    | "practical"
    | "project"
    | "oral"
    | "observation";
  durationMinutes?: number;
  paperReference?: string;
  questionSummary?: string;
  markingGuide?: string;
  syllabusObjectives?: string;
  maxScore: number;
  assessmentDate: string;
  marks: AssessmentMarkInput[];
  idempotencyKey: string;
}

export interface AcademicDocumentSummary {
  id: string;
  title: string;
  documentType:
    | "syllabus"
    | "assessment_paper"
    | "marking_guide"
    | "past_paper"
    | "lesson_resource"
    | "learner_evidence";
  language: "english" | "french" | "bilingual" | "other";
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "draft" | "submitted" | "approved" | "rejected" | "archived";
  subjectId?: string;
  classId?: string;
  assessmentId?: string;
  createdAt: string;
}
export interface AcademicDocumentUpload {
  file: File;
  title: string;
  documentType: AcademicDocumentSummary["documentType"];
  language: AcademicDocumentSummary["language"];
  academicYearId?: string;
  termId?: string;
  classId?: string;
  subjectId?: string;
  assessmentId?: string;
}

export interface OperationalSummary {
  invitations: StaffInvitation[];
  memberships: AccessMembership[];
  recentAttendance: number;
  recentAssessments: number;
}

export interface TeachingAssignmentSummary {
  id: string;
  academicYearId: string;
  termId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherUserId: string;
  teacherName: string;
  weeklyPeriods: number;
  status: "planned" | "active" | "completed" | "cancelled";
}

export interface TimetableEntrySummary {
  id: string;
  assignmentId: string;
  className: string;
  subjectName: string;
  teacherName: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  room?: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: "planned" | "active" | "cancelled";
}

export interface AssessmentSummary {
  id: string;
  title: string;
  className: string;
  subjectName: string;
  assessmentDate: string;
  maxScore: number;
  status:
    "draft" | "submitted" | "approved" | "rejected" | "published" | "cancelled";
  createdBy: string;
  creatorName: string;
  marksCount: number;
  averagePercent?: number;
}

export interface ReportCardSummary {
  id: string;
  studentId: string;
  studentName: string;
  termId: string;
  termName: string;
  status: "draft" | "published" | "superseded";
  revision: number;
  overallAverage?: number;
  evidenceCount: number;
  generatedBy: string;
  generatedAt: string;
  publishedAt?: string;
}

export interface AcademicOperations {
  assignments: TeachingAssignmentSummary[];
  timetable: TimetableEntrySummary[];
  assessments: AssessmentSummary[];
  reportCards: ReportCardSummary[];
  documents: AcademicDocumentSummary[];
}

export interface TransportStopSummary {
  id: string;
  routeId: string;
  order: number;
  name: string;
  landmark?: string;
  pickupTime?: string;
  dropoffTime?: string;
}
export interface TransportRouteSummary {
  id: string;
  code: string;
  name: string;
  direction: "inbound" | "outbound" | "both";
  status: "planning" | "active" | "paused" | "retired";
  stops: TransportStopSummary[];
}
export interface TransportVehicleSummary {
  id: string;
  code: string;
  registrationNumber: string;
  vehicleType: string;
  capacity: number;
  status: "available" | "assigned" | "maintenance" | "retired";
  inspectionDueOn?: string;
  insuranceDueOn?: string;
}
export interface TransportDriverSummary {
  id: string;
  userId: string;
  name: string;
  licenseReference: string;
  licenseExpiresOn: string;
  status: "active" | "suspended" | "expired" | "inactive";
}
export interface TransportAssignmentSummary {
  id: string;
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  pickupStopId: string;
  pickupStopName: string;
  dropoffStopId: string;
  dropoffStopName: string;
  status: "active" | "paused" | "ended";
}
export interface TransportTripSummary {
  id: string;
  routeId: string;
  routeName: string;
  vehicleId: string;
  vehicleCode: string;
  driverId: string;
  driverName: string;
  serviceDate: string;
  direction: "inbound" | "outbound";
  status: "dispatched" | "in_progress" | "delayed" | "completed" | "cancelled";
  assignedStudents: number;
  scheduledDeparture?: string;
}
export interface TransportOperations {
  routes: TransportRouteSummary[];
  vehicles: TransportVehicleSummary[];
  drivers: TransportDriverSummary[];
  assignments: TransportAssignmentSummary[];
  trips: TransportTripSummary[];
}

export interface AssignTeacherCommand {
  academicYearId: string;
  termId: string;
  classId: string;
  subjectId: string;
  teacherUserId: string;
  weeklyPeriods: number;
  idempotencyKey: string;
}
export interface SchedulePeriodCommand {
  assignmentId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  room?: string;
  effectiveFrom: string;
  effectiveTo: string;
  idempotencyKey: string;
}
export interface ReviewAssessmentCommand {
  assessmentId: string;
  decision: "approved" | "rejected";
  note: string;
  idempotencyKey: string;
}

export type StudentCaseCategory =
  | "learning_support"
  | "attendance"
  | "wellbeing"
  | "safeguarding"
  | "discipline"
  | "health"
  | "financial_support"
  | "other";

export type StudentCaseStatus =
  "open" | "triaged" | "assigned" | "in_progress" | "resolved" | "closed";

export interface StudentCaseSummary {
  id: string;
  caseNumber: string;
  studentId: string;
  studentName: string;
  category: StudentCaseCategory;
  priority: "normal" | "important" | "urgent" | "critical";
  confidentiality: "standard" | "restricted";
  status: StudentCaseStatus;
  title: string;
  summary: string;
  openedBy: string;
  assignedTo?: string;
  reviewDueOn?: string;
  closureOutcome?: string;
  openedAt: string;
  updatedAt: string;
}

export interface OpenStudentCaseCommand {
  studentId: string;
  category: StudentCaseCategory;
  priority: StudentCaseSummary["priority"];
  title: string;
  summary: string;
  reviewDueOn?: string;
  assignedTo?: string;
  idempotencyKey: string;
}

export interface ProgressStudentCaseCommand {
  caseId: string;
  targetStatus: StudentCaseStatus;
  note: string;
  assignedTo?: string;
  reviewDueOn?: string;
  idempotencyKey: string;
}

export type AdmissionStatus =
  | "submitted"
  | "under_review"
  | "documents_pending"
  | "interview"
  | "offered"
  | "accepted"
  | "waitlisted"
  | "rejected"
  | "withdrawn"
  | "enrolled";

export interface AdmissionSummary {
  id: string;
  applicationNumber: string;
  learnerName: string;
  dateOfBirth?: string;
  sex?: "female" | "male" | "other";
  targetClassName: string;
  guardianName: string;
  guardianPhone?: string;
  guardianEmail?: string;
  status: AdmissionStatus;
  source:
    "school_desk" | "referral" | "website" | "campaign" | "transfer" | "other";
  assignedTo?: string;
  enrolledStudentId?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface RecordAdmissionCommand {
  learnerFullName: string;
  dateOfBirth?: string;
  sex?: "female" | "male" | "other";
  targetClassName: string;
  previousSchool?: string;
  supportNotes?: string;
  guardianFullName: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship: string;
  source: AdmissionSummary["source"];
  assignedTo?: string;
  consentAccuracy: boolean;
  consentDataProcessing: boolean;
  idempotencyKey: string;
}

export interface ProgressAdmissionCommand {
  applicationId: string;
  targetStatus: Exclude<AdmissionStatus, "submitted">;
  note: string;
  assignedTo?: string;
  openingBalance: number;
  idempotencyKey: string;
}

export interface TeacherSummary {
  id: string;
  name: string;
  subject: string;
  learnerGrowth: number;
  coverage: number;
  mastery: number;
  workload: "balanced" | "high" | "critical";
  nextSupport: string;
}

export interface FinanceSummary {
  expectedToday: number;
  collectedToday: number;
  reconciledToday: number;
  openExceptions: number;
  openExceptionValue: number;
  nextDeposit: number;
  cashCollected: number;
  cashAwaitingDeposit: number;
  digitalConfirmed: number;
  parentConfirmationsPending: number;
}

export type PaymentMethod =
  "cash" | "momo" | "bank_transfer" | "card" | "cheque";

export interface PaymentCommand {
  paymentIntentId: string;
  cashierSessionId?: string;
  method: PaymentMethod;
  railCode:
    | "cash"
    | "wave"
    | "mtn_momo"
    | "orange_money"
    | "bank"
    | "card"
    | "cheque"
    | "other";
  amount: number;
  externalReference?: string;
  idempotencyKey: string;
}

export interface PaymentReceipt {
  paymentId: string;
  receiptNumber: string;
  confirmationToken: string;
}

export interface PaymentIntentCommand {
  studentId: string;
  feeAccountId: string;
  amountExpected: number;
  payerName: string;
  payerPhone?: string;
  allowedRails: PaymentCommand["railCode"][];
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  intentId: string;
  paymentReference: string;
}

export interface CommunitySignal {
  id: string;
  sourceRole: "parent" | "student" | "teacher" | "staff";
  sourceName: string;
  subjectType: "student" | "teacher" | "school" | "service";
  subjectName: string;
  category: string;
  message: string;
  severity: SignalSeverity;
  status: SignalStatus;
  assignedRole: Role;
  createdAt: string;
}

export interface PulseAction {
  id: string;
  category:
    "finance" | "learning" | "attendance" | "feedback" | "care" | "operations";
  title: string;
  explanation: string;
  owner: string;
  dueLabel: string;
  severity: "positive" | "info" | "warning" | "critical";
  evidenceCount: number;
}
