import type {
  Announcement,
  AttendanceRecord,
  AuditEvent,
  BursarLiabilityRecord,
  BursarSettlementRecord,
  ClassroomItem,
  FeeRecord,
  FeePaymentRecord,
  FeeReminderRecord,
  GovernmentReportRow,
  PermissionId,
  RoleId,
  SchoolConfig,
  SyncEvent,
  StudentRecord,
  TransportRoute,
  UserProfile
} from "./types";
import type { WorkspaceView } from "./types";

export const demoUsers: UserProfile[] = [
  {
    id: "u1",
    name: "Mrs. Nji",
    role: "leadership",
    department: "Administration",
    matricule: "DRM-ADM-001",
    schoolId: "demo-school"
  },
  {
    id: "u2",
    name: "Mr. Tabe",
    role: "teacher",
    department: "Sciences",
    matricule: "DRM-TCH-014",
    schoolId: "demo-school"
  },
  {
    id: "u3",
    name: "Joy A.",
    role: "student",
    department: "Form 4",
    matricule: "DRM-STD-221",
    schoolId: "demo-school"
  },
  {
    id: "u4",
    name: "Mrs. Manka",
    role: "parent",
    department: "Family",
    matricule: "DRM-PRT-110",
    schoolId: "demo-school"
  },
  {
    id: "u5",
    name: "Mrs. Epie",
    role: "bursar",
    department: "Finance",
    matricule: "DRM-BUR-004",
    schoolId: "demo-school"
  },
  {
    id: "u6",
    name: "Driver Elias",
    role: "transport",
    department: "Transport",
    matricule: "DRM-TRN-019",
    schoolId: "demo-school"
  },
  {
    id: "u7",
    name: "IT Support",
    role: "support",
    department: "Operations",
    matricule: "DRM-SUP-002",
    schoolId: "demo-school"
  }
];

export const roleLabels: Record<RoleId, string> = {
  leadership: "Leadership",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  bursar: "Bursar",
  transport: "Transport",
  support: "Support"
};

export const roleProfiles: Record<
  RoleId,
  {
    title: string;
    mandate: string;
    focus: string;
    authority: string;
    workstyle: string;
    primaryActions: string[];
  }
> = {
  leadership: {
    title: "School leadership",
    mandate: "Own school direction, policy, approvals, and institutional health.",
    focus: "Risk, reporting, communications, and cross-department accountability.",
    authority: "Full school oversight",
    workstyle: "Executive command view",
    primaryActions: ["Review risk", "Approve notices", "Inspect operations"]
  },
  teacher: {
    title: "Teaching staff",
    mandate: "Deliver learning, maintain class records, and support student progress.",
    focus: "Attendance, assignments, notes, and follow-up learning continuity.",
    authority: "Classroom and academic actions",
    workstyle: "Fast daily class workflow",
    primaryActions: ["Mark attendance", "Publish work", "Review notices"]
  },
  student: {
    title: "Learner workspace",
    mandate: "Track assignments, classroom continuity, and school notices.",
    focus: "Personal learning tasks, follow-up materials, and recognition.",
    authority: "Personal learning access",
    workstyle: "Simple guided dashboard",
    primaryActions: ["Open assignments", "Read notices", "Follow class work"]
  },
  parent: {
    title: "Parent workspace",
    mandate: "Follow child progress, notices, payments, and home learning support.",
    focus: "Child updates, school communication, and continuity materials.",
    authority: "Family-facing visibility",
    workstyle: "Clear follow-up and support view",
    primaryActions: ["Check child updates", "Read notices", "Support home learning"]
  },
  bursar: {
    title: "Bursar office",
    mandate: "Control collections, liabilities, corrections, reminders, and settlements.",
    focus: "Fee accounts, cash custody, reversals, and payment follow-up.",
    authority: "Finance operations authority",
    workstyle: "Transaction-heavy workbench",
    primaryActions: ["Post collections", "Queue reminders", "Adjust fee accounts"]
  },
  transport: {
    title: "Transport operations",
    mandate: "Track routes, exceptions, delays, and family transport communication.",
    focus: "Vehicle state, route updates, and pickup visibility.",
    authority: "Transport status control",
    workstyle: "Exception-driven route desk",
    primaryActions: ["Update routes", "Send alerts", "Track next stop"]
  },
  support: {
    title: "Operations support",
    mandate: "Maintain platform readiness, sync integrity, and school setup support.",
    focus: "Sync health, storage, access support, and operational continuity.",
    authority: "Platform support control",
    workstyle: "Reliability and admin support view",
    primaryActions: ["Check sync", "Review storage", "Support setup"]
  }
};

export const rolePermissions: Record<RoleId, PermissionId[]> = {
  leadership: [
    "overview.view",
    "academics.view",
    "academics.attendance.write",
    "finance.view",
    "finance.payments.write",
    "finance.structure.manage",
    "finance.reminders.write",
    "transport.view",
    "transport.status.write",
    "communications.view",
    "communications.publish",
    "operations.view",
    "operations.users.manage",
    "operations.school.configure",
    "operations.sync.manage",
    "reporting.view"
  ],
  teacher: [
    "overview.view",
    "academics.view",
    "academics.attendance.write",
    "communications.view"
  ],
  student: ["overview.view", "academics.view", "communications.view"],
  parent: ["overview.view", "academics.view", "finance.view", "communications.view"],
  bursar: [
    "overview.view",
    "finance.view",
    "finance.payments.write",
    "finance.structure.manage",
    "finance.reminders.write",
    "communications.view",
    "operations.view",
    "operations.sync.manage",
    "reporting.view"
  ],
  transport: [
    "overview.view",
    "transport.view",
    "transport.status.write",
    "communications.view"
  ],
  support: [
    "overview.view",
    "transport.view",
    "communications.view",
    "operations.view",
    "operations.users.manage",
    "operations.school.configure",
    "operations.sync.manage",
    "reporting.view"
  ]
};

export const roleWorkspaceAccess: Record<RoleId, WorkspaceView[]> = {
  leadership: ["overview", "academics", "finance", "transport", "communications", "operations", "reporting"],
  teacher: ["overview", "academics", "communications"],
  student: ["overview", "academics", "communications"],
  parent: ["overview", "academics", "finance", "communications"],
  bursar: ["overview", "finance", "communications", "operations", "reporting"],
  transport: ["overview", "transport", "communications"],
  support: ["overview", "operations", "communications", "transport", "reporting"]
};

export const starterAnnouncements: Announcement[] = [
  {
    id: "a1",
    title: "Monday assembly time update",
    body: "Assembly begins at 7:30 AM this week because of the inter-house rehearsal block.",
    audience: "everyone",
    category: "announcement",
    author: "Administration",
    createdAt: "07:10",
    status: "published",
    priority: "important",
    requiresAck: true,
    channels: ["app", "noticeboard"],
    targetCount: 1248,
    pinned: true
  },
  {
    id: "a2",
    title: "Best student of the week",
    body: "Naomi B. is recognized this week for consistency, leadership, and peer support.",
    audience: "everyone",
    category: "recognition",
    author: "Student Affairs",
    createdAt: "08:20",
    status: "published",
    priority: "routine",
    requiresAck: false,
    channels: ["app", "noticeboard"],
    targetCount: 1248
  },
  {
    id: "a3",
    title: "Bus route 3 delayed",
    body: "Route 3 is running 15 minutes late because of road maintenance near Mile 4 junction.",
    audience: "transport",
    category: "transport",
    author: "Transport Office",
    createdAt: "06:45",
    status: "published",
    priority: "urgent",
    requiresAck: true,
    channels: ["app", "sms"],
    targetCount: 94
  },
  {
    id: "a4",
    title: "Continuous assessment week reminder",
    body: "All subject heads should upload assessment plans before 16:00 today for moderation review.",
    audience: "teacher",
    category: "announcement",
    author: "Academics Office",
    createdAt: "09:05",
    status: "published",
    priority: "important",
    requiresAck: true,
    channels: ["app", "email"],
    targetCount: 58
  },
  {
    id: "a5",
    title: "Parent digital orientation this Friday",
    body: "A guided session for parents on fee tracking, assignments, and home learning support is scheduled for Friday at 17:00.",
    audience: "parent",
    category: "campus-news",
    author: "Parent Desk",
    createdAt: "10:30",
    status: "scheduled",
    priority: "routine",
    requiresAck: false,
    channels: ["app", "email", "sms"],
    targetCount: 610
  }
];

export const classroomItems: ClassroomItem[] = [
  {
    id: "c1",
    title: "Quadratic equations recovery pack",
    subject: "Mathematics",
    className: "Form 4B",
    delivery: "follow-up",
    audience: "student",
    summary: "Used when students are at home or need revision after missing class.",
    publishedBy: "Mr. Tabe",
    status: "published",
    storageProvider: "supabase"
  },
  {
    id: "c2",
    title: "Photosynthesis note sheet",
    subject: "Biology",
    className: "Form 3A",
    delivery: "notes",
    audience: "parent",
    summary: "A simple parent-visible note so home support stays aligned with classroom work.",
    publishedBy: "Science Department",
    status: "published",
    storageProvider: "onedrive"
  },
  {
    id: "c3",
    title: "Continuous assessment essay",
    subject: "English",
    className: "Form 5A",
    delivery: "assignment",
    audience: "student",
    summary: "Draft the essay and submit before Friday afternoon prep.",
    dueDate: "2026-07-11",
    publishedBy: "Mrs. Nji",
    status: "published",
    storageProvider: "local-node"
  },
  {
    id: "c4",
    title: "Teacher reflection prompt bank",
    subject: "Professional Growth",
    delivery: "follow-up",
    audience: "teacher",
    summary: "Coaching prompts and lesson follow-up support for improving teaching quality.",
    publishedBy: "Academic Office",
    status: "published",
    storageProvider: "local-node"
  }
];

export const storageConnections = [
  {
    provider: "supabase",
    label: "Supabase Storage",
    status: "active",
    purpose: "Cloud-accessible files for assignments, notes, and public school content."
  },
  {
    provider: "onedrive",
    label: "School OneDrive",
    status: "planned",
    purpose: "School-owned document backup, controlled file sharing, and disaster recovery."
  },
  {
    provider: "cloudflare-r2",
    label: "DREEM Cloudflare R2",
    status: "planned",
    purpose: "Fast S3-compatible object backup and public/static asset mirror for DREEM-owned buckets."
  },
  {
    provider: "backblaze-b2",
    label: "DREEM Backblaze B2",
    status: "planned",
    purpose: "Independent cold backup so one cloud provider outage does not threaten school files."
  },
  {
    provider: "local-node",
    label: "Local School Node",
    status: "planned",
    purpose: "Offline-sensitive files kept on a school machine or Raspberry Pi."
  }
] satisfies import("./types").StorageConnection[];

export const starterStudents: StudentRecord[] = [
  {
    id: "s1",
    fullName: "Naomi B.",
    className: "Form 5A",
    guardian: "Mrs. Bih",
    guardianRelation: "Mother",
    guardianPhone: "+237670000001",
    guardianEmail: "bih.family@example.com",
    matricule: "STD-2026-0001",
    feeStatus: "clear",
    attendanceRate: 96,
    riskLevel: "low"
  },
  {
    id: "s2",
    fullName: "Peter A.",
    className: "Form 4B",
    guardian: "Mr. Akono",
    guardianRelation: "Father",
    guardianPhone: "+237670000002",
    guardianEmail: "akono.family@example.com",
    matricule: "STD-2026-0002",
    feeStatus: "partial",
    attendanceRate: 81,
    riskLevel: "medium"
  },
  {
    id: "s3",
    fullName: "Ruth M.",
    className: "Form 3A",
    guardian: "Mrs. Manka",
    guardianRelation: "Aunt",
    guardianPhone: "+237670000003",
    guardianEmail: "manka.family@example.com",
    matricule: "STD-2026-0003",
    feeStatus: "overdue",
    attendanceRate: 68,
    riskLevel: "high"
  }
];

export const starterAttendance: AttendanceRecord[] = [
  {
    id: "at1",
    studentId: "s1",
    studentName: "Naomi B.",
    className: "Form 5A",
    date: "2026-06-20",
    status: "present",
    note: "On time"
  },
  {
    id: "at2",
    studentId: "s2",
    studentName: "Peter A.",
    className: "Form 4B",
    date: "2026-06-20",
    status: "late",
    note: "Arrived after assembly"
  },
  {
    id: "at3",
    studentId: "s3",
    studentName: "Ruth M.",
    className: "Form 3A",
    date: "2026-06-20",
    status: "absent",
    note: "Parent follow-up required"
  }
];

export const starterFees: FeeRecord[] = [
  {
    id: "f1",
    studentId: "s1",
    studentName: "Naomi B.",
    className: "Form 5A",
    amountDue: 250000,
    amountPaid: 250000,
    dueDate: "2026-06-30",
    status: "clear"
  },
  {
    id: "f2",
    studentId: "s2",
    studentName: "Peter A.",
    className: "Form 4B",
    amountDue: 250000,
    amountPaid: 150000,
    dueDate: "2026-06-30",
    status: "partial"
  },
  {
    id: "f3",
    studentId: "s3",
    studentName: "Ruth M.",
    className: "Form 3A",
    amountDue: 250000,
    amountPaid: 50000,
    dueDate: "2026-06-25",
    status: "overdue"
  }
];

export const starterFeePayments: FeePaymentRecord[] = [
  {
    id: "fp1",
    feeId: "f1",
    studentId: "s1",
    studentName: "Naomi B.",
    amount: 250000,
    paidAt: "2026-06-18 09:14",
    method: "transfer",
    recordedBy: "Mrs. Epie",
    receiptNumber: "DRM-RCPT-1001"
  },
  {
    id: "fp2",
    feeId: "f2",
    studentId: "s2",
    studentName: "Peter A.",
    amount: 150000,
    paidAt: "2026-06-19 11:05",
    method: "mobile-money",
    recordedBy: "Mrs. Epie",
    receiptNumber: "DRM-RCPT-1002"
  },
  {
    id: "fp3",
    feeId: "f3",
    studentId: "s3",
    studentName: "Ruth M.",
    amount: 50000,
    paidAt: "2026-06-17 08:42",
    method: "cash",
    recordedBy: "Mrs. Epie",
    receiptNumber: "DRM-RCPT-1003"
  }
];

export const starterBursarLiabilities: BursarLiabilityRecord[] = [
  {
    id: "bl1",
    bursarName: "Mrs. Epie",
    studentId: "s3",
    studentName: "Ruth M.",
    receiptNumber: "DRM-RCPT-1003",
    amount: 50000,
    collectedAt: "2026-06-17 08:42",
    status: "outstanding"
  }
];

export const starterBursarSettlements: BursarSettlementRecord[] = [
  {
    id: "bs1",
    bursarName: "Mrs. Epie",
    amount: 150000,
    settledAt: "2026-06-18 16:15",
    channel: "bank-deposit",
    reference: "AFRILAND-DEP-0618",
    status: "accepted"
  }
];

export const starterAuditEvents: AuditEvent[] = [
  {
    id: "audit-1",
    actor: "Mrs. Epie",
    action: "Cash receipt created",
    target: "Ruth M.",
    detail: "Receipt DRM-RCPT-1003 created a bursar liability of 50,000 XAF.",
    createdAt: "2026-06-17 08:42",
    severity: "attention"
  },
  {
    id: "audit-2",
    actor: "System",
    action: "School configuration loaded",
    target: "DREEM Demonstration School",
    detail: "Classes, subjects, fee categories, and storage layers are ready for operations.",
    createdAt: "2026-07-13 07:35",
    severity: "info"
  }
];

export const starterSyncEvents: SyncEvent[] = [
  {
    id: "sync-1",
    label: "Supabase operational data",
    target: "supabase",
    status: "healthy",
    detail: "Auth, RLS, announcements, classroom, finance, and reporting tables are the cloud authority.",
    updatedAt: "Today 07:35"
  },
  {
    id: "sync-2",
    label: "School OneDrive backup",
    target: "onedrive",
    status: "queued",
    detail: "Receipts, report exports, and classroom files should mirror to school-owned storage.",
    updatedAt: "Waiting for admin connection"
  },
  {
    id: "sync-3",
    label: "Local school node",
    target: "local-node",
    status: "blocked",
    detail: "Pi/local machine agent is planned for offline bursar, attendance, and sensitive records.",
    updatedAt: "Hardware not installed"
  }
];

export const starterFeeReminders: FeeReminderRecord[] = [
  {
    id: "fr1",
    studentId: "s3",
    studentName: "Ruth M.",
    channel: "sms",
    message: "Reminder: Form 3A balance is overdue. Please pay before Friday.",
    status: "queued",
    createdAt: "2026-07-06 07:10",
    createdBy: "Mrs. Epie"
  },
  {
    id: "fr2",
    studentId: "s2",
    studentName: "Peter A.",
    channel: "sms",
    message: "Reminder: partial fee balance is due before the end of term.",
    status: "sent",
    createdAt: "2026-07-05 16:32",
    createdBy: "Mrs. Epie"
  }
];

export const starterRoutes: TransportRoute[] = [
  {
    id: "r1",
    routeName: "Route 1 - Bastos",
    driver: "Driver Elias",
    vehicle: "BUS-04",
    studentsAssigned: 34,
    status: "on-time",
    nextStop: "Hospital Junction"
  },
  {
    id: "r2",
    routeName: "Route 2 - Biyem-Assi",
    driver: "Driver Joel",
    vehicle: "BUS-07",
    studentsAssigned: 29,
    status: "delayed",
    nextStop: "Melen Market"
  },
  {
    id: "r3",
    routeName: "Route 3 - Simbock",
    driver: "Driver Solange",
    vehicle: "BUS-02",
    studentsAssigned: 31,
    status: "maintenance",
    nextStop: "Depot review"
  }
];

export const defaultSchoolConfig: SchoolConfig = {
  schoolName: "DREEM Demonstration School",
  campusName: "Main Campus",
  academicYear: "2026/2027",
  activeTerm: "Term 1",
  classes: ["Form 1A", "Form 2A", "Form 3A", "Form 4B", "Form 5A"],
  subjects: ["Mathematics", "English", "Biology", "Chemistry", "History"],
  terms: ["Term 1", "Term 2", "Term 3"],
  feeCategories: ["Tuition", "Transport", "Exams", "Meals", "ICT Levy"],
  gradingLabel: "20-point scale",
  currency: "XAF",
  matriculePrefix: "DRM",
  institutionEdition: "bilingual-k12",
  countryPack: "cameroon-bilingual",
  enabledModules: ["academics", "finance", "communications", "transport", "reporting"],
  languages: ["en", "fr"],
  terminology: {
    student: "Learner",
    class: "Class",
    guardian: "Parent / guardian"
  }
};

export const starterGovernmentRows: GovernmentReportRow[] = [
  {
    className: "Form 3A",
    enrolled: 1,
    atRisk: 1,
    overdueFees: 1,
    attendanceAverage: 68
  },
  {
    className: "Form 4B",
    enrolled: 1,
    atRisk: 1,
    overdueFees: 0,
    attendanceAverage: 81
  },
  {
    className: "Form 5A",
    enrolled: 1,
    atRisk: 0,
    overdueFees: 0,
    attendanceAverage: 96
  }
];
