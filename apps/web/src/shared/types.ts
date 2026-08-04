export type RoleId =
  | "leadership"
  | "teacher"
  | "student"
  | "parent"
  | "bursar"
  | "transport"
  | "support";

export type PermissionId =
  | "overview.view"
  | "academics.view"
  | "academics.attendance.write"
  | "finance.view"
  | "finance.payments.write"
  | "finance.structure.manage"
  | "finance.reminders.write"
  | "transport.view"
  | "transport.status.write"
  | "communications.view"
  | "communications.publish"
  | "operations.view"
  | "operations.users.manage"
  | "operations.school.configure"
  | "operations.sync.manage"
  | "reporting.view";

export type StorageProvider =
  | "supabase"
  | "onedrive"
  | "cloudflare-r2"
  | "backblaze-b2"
  | "local-node";
export type WorkspaceView =
  | "overview"
  | "academics"
  | "finance"
  | "transport"
  | "communications"
  | "operations"
  | "reporting";

export interface UserProfile {
  id: string;
  name: string;
  role: RoleId;
  department: string;
  matricule: string;
  schoolId?: string;
  email?: string;
  phone?: string;
  status?: "active" | "invited" | "suspended";
}

export interface AuthDraft {
  identifier: string;
  password: string;
  mode: "password" | "otp";
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: RoleId | "everyone";
  category: "announcement" | "campus-news" | "recognition" | "transport";
  author: string;
  createdAt: string;
  schoolId?: string;
  status?: "draft" | "published" | "scheduled";
  priority?: "routine" | "important" | "urgent";
  requiresAck?: boolean;
  channels?: Array<"app" | "email" | "sms" | "noticeboard">;
  targetCount?: number;
  pinned?: boolean;
}

export interface ClassroomItem {
  id: string;
  title: string;
  subject: string;
  className?: string;
  delivery: "notes" | "assignment" | "follow-up";
  audience: "student" | "parent" | "teacher";
  summary: string;
  dueDate?: string;
  publishedBy?: string;
  status?: "draft" | "published";
  storageProvider?: StorageProvider;
}

export interface AssignmentSubmission {
  id: string;
  classroomItemId: string;
  classroomTitle: string;
  studentId: string;
  studentName: string;
  className?: string;
  submittedBy: string;
  submittedAt: string;
  response: string;
  status: "submitted" | "reviewed" | "needs-revision";
  reviewedBy?: string;
  reviewedAt?: string;
  feedback?: string;
  score?: string;
}

export interface StorageConnection {
  provider: StorageProvider;
  label: string;
  status: "active" | "planned";
  purpose: string;
}

export interface WorkerStorageLane {
  provider: StorageProvider;
  role: string;
  ready: boolean;
  bucket?: string | null;
}

export interface WorkerBackupTopology {
  policy: string;
  ready: boolean;
  jobProtection: "shared-secret-required" | "open-internal-preview";
  lanes: WorkerStorageLane[];
}

export interface BackupJobRecord {
  id: string;
  school_id: string | null;
  provider: StorageProvider;
  job_type: "sync" | "backup" | "restore-test";
  status: "queued" | "running" | "completed" | "failed" | "blocked";
  error_message: string | null;
  requested_by: string | null;
  created_at: string;
  finished_at: string | null;
  manifest?: Record<string, unknown>;
}

export interface StudentRecord {
  id: string;
  fullName: string;
  className: string;
  guardian: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  matricule?: string;
  feeStatus: "clear" | "partial" | "overdue";
  attendanceRate: number;
  riskLevel: "low" | "medium" | "high";
  enrolmentStatus?: "applicant" | "active" | "transferred" | "graduated";
  academicYear?: string;
  parentUserIds?: string[];
  mergedIntoStudentId?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string;
  status: "present" | "late" | "absent";
  note: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: "clear" | "partial" | "overdue";
}

export interface FeePaymentRecord {
  id: string;
  feeId: string;
  studentId: string;
  studentName: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  recordedBy: string;
  receiptNumber: string;
  status?: "posted" | "reversed";
  reversalOf?: string;
  reversedAt?: string;
  reversalReason?: string;
}

export type PaymentMethod = "cash" | "transfer" | "mobile-money" | "orange-money";

export interface BursarLiabilityRecord {
  id: string;
  bursarName: string;
  studentId: string;
  studentName: string;
  receiptNumber: string;
  amount: number;
  collectedAt: string;
  status: "outstanding" | "part-settled" | "settled" | "disputed";
  settlementId?: string;
}

export interface BursarSettlementRecord {
  id: string;
  bursarName: string;
  amount: number;
  settledAt: string;
  channel: "cash-handover" | "bank-deposit" | "mobile-money" | "orange-money";
  reference: string;
  status: "pending-review" | "accepted" | "rejected";
}

export interface FeeReminderRecord {
  id: string;
  studentId: string;
  studentName: string;
  channel: "sms" | "app";
  message: string;
  status: "queued" | "sent";
  createdAt: string;
  createdBy: string;
}

export interface TransportRoute {
  id: string;
  routeName: string;
  driver: string;
  vehicle: string;
  studentsAssigned: number;
  status: "on-time" | "delayed" | "maintenance";
  nextStop: string;
}

export interface SchoolConfig {
  schoolName: string;
  campusName?: string;
  academicYear?: string;
  activeTerm?: string;
  classes: string[];
  subjects: string[];
  terms?: string[];
  feeCategories: string[];
  gradingLabel: string;
  currency: string;
  matriculePrefix?: string;
  institutionEdition?: "bilingual-k12" | "tvET" | "higher-education";
  countryPack?: "cameroon-bilingual" | "custom";
  enabledModules?: string[];
  languages?: Array<"en" | "fr">;
  terminology?: Record<string, string>;
}

export interface WorkflowCorrection {
  id: string;
  type:
    | "payment-reversal"
    | "invoice-adjustment"
    | "student-transfer"
    | "placement-change"
    | "duplicate-merge"
    | "parent-link";
  originalRecordId: string;
  replacementRecordId?: string;
  status: "requested" | "approved" | "rejected" | "applied";
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  appliedAt?: string;
}

export interface SyncMutation {
  id: string;
  schoolId?: string;
  entity:
    | "attendance"
    | "fee-payment"
    | "fee-adjustment"
    | "student-placement"
    | "duplicate-merge"
    | "parent-link"
    | "bursar-settlement"
    | "fee-reminder"
    | "transport-route"
    | "student-record";
  operation: "insert" | "update" | "correction";
  status: "pending" | "synced" | "blocked";
  targetId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  lastError?: string;
}

export interface GovernmentReportRow {
  className: string;
  enrolled: number;
  atRisk: number;
  overdueFees: number;
  attendanceAverage: number;
  girls?: number;
  boys?: number;
  examReady?: number;
}

export interface AccessIdentityDraft {
  fullName: string;
  role: RoleId;
  department: string;
  matricule: string;
  email: string;
  phone: string;
}

export interface SyncEvent {
  id: string;
  label: string;
  target: "supabase" | "onedrive" | "local-node";
  status: "healthy" | "queued" | "blocked";
  detail: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
  severity: "info" | "attention" | "critical";
}
