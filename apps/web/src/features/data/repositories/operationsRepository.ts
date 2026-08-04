import {
  starterAuditEvents,
  starterAttendance,
  starterBursarLiabilities,
  starterBursarSettlements,
  starterFeePayments,
  starterFeeReminders,
  starterFees,
  starterRoutes,
  starterStudents
} from "../../../shared/data";
import type {
  AttendanceRecord,
  AuditEvent,
  BursarLiabilityRecord,
  BursarSettlementRecord,
  FeeRecord,
  FeePaymentRecord,
  FeeReminderRecord,
  PaymentMethod,
  StudentRecord,
  SyncMutation,
  TransportRoute,
  WorkflowCorrection
} from "../../../shared/types";
import { env } from "../../../lib/env";
import { supabase } from "../../../lib/supabase";

type OperationsSnapshot = {
  students: StudentRecord[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  payments: FeePaymentRecord[];
  liabilities: BursarLiabilityRecord[];
  settlements: BursarSettlementRecord[];
  reminders: FeeReminderRecord[];
  routes: TransportRoute[];
  auditEvents: AuditEvent[];
  corrections: WorkflowCorrection[];
  syncMutations: SyncMutation[];
};

type StudentRow = {
  id: string;
  full_name: string;
  class_name: string;
  guardian_name: string;
  guardian_relation: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  matricule: string;
  fee_status: StudentRecord["feeStatus"];
  attendance_rate: number;
  risk_level: StudentRecord["riskLevel"];
  enrolment_status: StudentRecord["enrolmentStatus"] | null;
  academic_year: string | null;
  parent_user_ids: string[] | null;
  merged_into_student_id: string | null;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  class_name: string;
  attended_on: string;
  status: AttendanceRecord["status"];
  note: string;
  students?: { full_name: string } | { full_name: string }[] | null;
};

type FeeRow = {
  id: string;
  student_id: string;
  class_name: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: FeeRecord["status"];
  students?: { full_name: string } | { full_name: string }[] | null;
};

type RouteRow = {
  id: string;
  route_name: string;
  driver_name: string;
  vehicle_code: string;
  students_assigned: number;
  status: TransportRoute["status"];
  next_stop: string;
};

type FeePaymentRow = {
  id: string;
  fee_account_id: string;
  student_id: string;
  amount: number;
  method: FeePaymentRecord["method"];
  paid_at: string;
  receipt_number: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
  students?: { full_name: string } | { full_name: string }[] | null;
};

type FeeReminderRow = {
  id: string;
  student_id: string;
  channel: FeeReminderRecord["channel"];
  message: string;
  status: FeeReminderRecord["status"];
  created_at: string;
  students?: { full_name: string } | { full_name: string }[] | null;
  profiles?: { full_name: string } | { full_name: string }[] | null;
};

type WorkflowCorrectionRow = {
  id: string;
  correction_type: WorkflowCorrection["type"];
  original_record_id: string;
  replacement_record_id: string | null;
  status: WorkflowCorrection["status"];
  reason: string;
  created_at: string;
  applied_at: string | null;
};

type BursarLiabilityRow = {
  id: string;
  bursar_name: string;
  student_id: string | null;
  student_name: string;
  receipt_number: string;
  amount: number;
  collected_at: string;
  status: BursarLiabilityRecord["status"];
  settlement_id: string | null;
};

type BursarSettlementRow = {
  id: string;
  bursar_name: string;
  amount: number;
  settled_at: string;
  channel: BursarSettlementRecord["channel"];
  reference: string;
  status: BursarSettlementRecord["status"];
};

const STORAGE_KEY = "dreem:operations";

function isBrowser() {
  return typeof window !== "undefined";
}

function getSchoolKey(schoolId?: string | null) {
  return schoolId ?? "demo-school";
}

function getLocalSnapshot(schoolId?: string | null): OperationsSnapshot | null {
  if (!isBrowser()) {
    return null;
  }

  const storageKey = `${STORAGE_KEY}:${getSchoolKey(schoolId)}`;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return normalizeSnapshot(JSON.parse(raw) as Partial<OperationsSnapshot>);
  } catch {
    return null;
  }
}

function saveLocalSnapshot(schoolId: string | null | undefined, snapshot: OperationsSnapshot) {
  if (!isBrowser()) {
    return;
  }

  const storageKey = `${STORAGE_KEY}:${getSchoolKey(schoolId)}`;
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function starterSnapshot(): OperationsSnapshot {
  return {
    students: starterStudents,
    attendance: starterAttendance,
    fees: starterFees,
    payments: starterFeePayments,
    liabilities: starterBursarLiabilities,
    settlements: starterBursarSettlements,
    reminders: starterFeeReminders,
    routes: starterRoutes,
    auditEvents: starterAuditEvents,
    corrections: [],
    syncMutations: []
  };
}

function normalizeSnapshot(snapshot: Partial<OperationsSnapshot>): OperationsSnapshot {
  return {
    ...starterSnapshot(),
    ...snapshot,
    liabilities: snapshot.liabilities ?? deriveCashLiabilities(snapshot.payments ?? []),
    settlements: snapshot.settlements ?? [],
    auditEvents: snapshot.auditEvents ?? [],
    corrections: snapshot.corrections ?? [],
    syncMutations: snapshot.syncMutations ?? []
  };
}

function createSyncMutation(
  schoolId: string | null | undefined,
  entity: SyncMutation["entity"],
  operation: SyncMutation["operation"],
  targetId: string,
  payload: Record<string, unknown>,
  lastError?: string
): SyncMutation {
  return {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    schoolId: schoolId ?? "demo-school",
    entity,
    operation,
    status: lastError ? "blocked" : "pending",
    targetId,
    payload,
    createdAt: new Date().toISOString(),
    lastError
  };
}

function deriveCashLiabilities(payments: FeePaymentRecord[]): BursarLiabilityRecord[] {
  return payments
    .filter((payment) => payment.method === "cash")
    .map((payment) => ({
      id: `bl-${payment.id}`,
      bursarName: payment.recordedBy,
      studentId: payment.studentId,
      studentName: payment.studentName,
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      collectedAt: payment.paidAt,
      status: "outstanding" as const
    }));
}

async function loadSnapshotFromSupabase(schoolId: string) {
  if (!supabase || env.demoMode) {
    return null;
  }

  const [
    studentsResponse,
    attendanceResponse,
    feesResponse,
    paymentsResponse,
    remindersResponse,
    routesResponse,
    correctionsResponse,
    liabilitiesResponse,
    settlementsResponse
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id,full_name,class_name,guardian_name,guardian_relation,guardian_phone,guardian_email,matricule,fee_status,attendance_rate,risk_level,enrolment_status,academic_year,parent_user_ids,merged_into_student_id")
      .eq("school_id", schoolId)
      .order("full_name"),
    supabase
      .from("attendance")
      .select("id,student_id,class_name,attended_on,status,note,students(full_name)")
      .eq("school_id", schoolId)
      .order("attended_on", { ascending: false }),
    supabase
      .from("fee_accounts")
      .select("id,student_id,class_name,amount_due,amount_paid,due_date,status,students(full_name)")
      .eq("school_id", schoolId)
      .order("due_date"),
    supabase
      .from("fee_payments")
      .select("id,fee_account_id,student_id,amount,method,paid_at,receipt_number,profiles(full_name),students(full_name)")
      .eq("school_id", schoolId)
      .order("paid_at", { ascending: false }),
    supabase
      .from("fee_reminders")
      .select("id,student_id,channel,message,status,created_at,students(full_name),profiles(full_name)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transport_routes")
      .select("id,route_name,driver_name,vehicle_code,students_assigned,status,next_stop")
      .eq("school_id", schoolId)
      .order("route_name"),
    supabase
      .from("workflow_corrections")
      .select("id,correction_type,original_record_id,replacement_record_id,status,reason,created_at,applied_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bursar_liabilities")
      .select("id,bursar_name,student_id,student_name,receipt_number,amount,collected_at,status,settlement_id")
      .eq("school_id", schoolId)
      .order("collected_at", { ascending: false }),
    supabase
      .from("bursar_settlements")
      .select("id,bursar_name,amount,settled_at,channel,reference,status")
      .eq("school_id", schoolId)
      .order("settled_at", { ascending: false })
  ]);

  const errors = [
    studentsResponse.error,
    attendanceResponse.error,
    feesResponse.error,
    paymentsResponse.error,
    remindersResponse.error,
    routesResponse.error,
    correctionsResponse.error,
    liabilitiesResponse.error,
    settlementsResponse.error
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  const mapAttendance = (row: AttendanceRow): AttendanceRecord => ({
    id: row.id,
    studentId: row.student_id,
    studentName: extractRelatedName(row.students),
    className: row.class_name,
    date: row.attended_on,
    status: row.status,
    note: row.note
  });

  const mapFee = (row: FeeRow): FeeRecord => ({
    id: row.id,
    studentId: row.student_id,
    studentName: extractRelatedName(row.students),
    className: row.class_name,
    amountDue: Number(row.amount_due),
    amountPaid: Number(row.amount_paid),
    dueDate: row.due_date,
    status: row.status
  });

  const mapPayment = (row: FeePaymentRow): FeePaymentRecord => ({
    id: row.id,
    feeId: row.fee_account_id,
    studentId: row.student_id,
    studentName: extractRelatedName(row.students),
    amount: Number(row.amount),
    paidAt: row.paid_at,
    method: row.method,
    recordedBy: extractRelatedName(row.profiles),
    receiptNumber: row.receipt_number
  });

  const mapReminder = (row: FeeReminderRow): FeeReminderRecord => ({
    id: row.id,
    studentId: row.student_id,
    studentName: extractRelatedName(row.students),
    channel: row.channel,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    createdBy: extractRelatedName(row.profiles)
  });

  return {
    students: (studentsResponse.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      className: row.class_name,
      guardian: row.guardian_name,
      guardianRelation: row.guardian_relation ?? undefined,
      guardianPhone: row.guardian_phone ?? undefined,
      guardianEmail: row.guardian_email ?? undefined,
      feeStatus: row.fee_status,
      attendanceRate: Number(row.attendance_rate),
      riskLevel: row.risk_level,
      matricule: row.matricule,
      enrolmentStatus: row.enrolment_status ?? undefined,
      academicYear: row.academic_year ?? undefined,
      parentUserIds: row.parent_user_ids ?? [],
      mergedIntoStudentId: row.merged_into_student_id ?? undefined
    })),
    attendance: (attendanceResponse.data ?? []).map(mapAttendance),
    fees: (feesResponse.data ?? []).map(mapFee),
    payments: (paymentsResponse.data ?? []).map(mapPayment),
    liabilities: (liabilitiesResponse.data ?? []).map((row: BursarLiabilityRow) => ({
      id: row.id,
      bursarName: row.bursar_name,
      studentId: row.student_id ?? "",
      studentName: row.student_name,
      receiptNumber: row.receipt_number,
      amount: Number(row.amount),
      collectedAt: row.collected_at,
      status: row.status,
      settlementId: row.settlement_id ?? undefined
    })),
    settlements: (settlementsResponse.data ?? []).map((row: BursarSettlementRow) => ({
      id: row.id,
      bursarName: row.bursar_name,
      amount: Number(row.amount),
      settledAt: row.settled_at,
      channel: row.channel,
      reference: row.reference,
      status: row.status
    })),
    reminders: (remindersResponse.data ?? []).map(mapReminder),
    routes: (routesResponse.data ?? []).map((row: RouteRow) => ({
      id: row.id,
      routeName: row.route_name,
      driver: row.driver_name,
      vehicle: row.vehicle_code,
      studentsAssigned: row.students_assigned,
      status: row.status,
      nextStop: row.next_stop
    })),
    auditEvents: getLocalSnapshot(schoolId)?.auditEvents ?? [],
    corrections: (correctionsResponse.data ?? []).map((row: WorkflowCorrectionRow) => ({
      id: row.id,
      type: row.correction_type,
      originalRecordId: row.original_record_id,
      replacementRecordId: row.replacement_record_id ?? undefined,
      status: row.status,
      reason: row.reason,
      requestedBy: "Recorded in Supabase",
      createdAt: row.created_at,
      appliedAt: row.applied_at ?? undefined
    })),
    syncMutations: getLocalSnapshot(schoolId)?.syncMutations ?? []
  } satisfies OperationsSnapshot;
}

function extractRelatedName(
  value:
    | AttendanceRow["students"]
    | FeeRow["students"]
    | FeePaymentRow["students"]
    | FeePaymentRow["profiles"]
    | FeeReminderRow["students"]
    | FeeReminderRow["profiles"]
) {
  if (Array.isArray(value)) {
    return value[0]?.full_name ?? "Unknown student";
  }

  return value?.full_name ?? "Unknown student";
}

async function insertWorkflowCorrectionRecord(
  schoolId: string | null | undefined,
  correction: WorkflowCorrection
) {
  if (!supabase || env.demoMode) {
    return;
  }

  const { error } = await supabase.from("workflow_corrections").insert({
    school_id: schoolId ?? "demo-school",
    correction_type: correction.type,
    original_record_id: correction.originalRecordId,
    replacement_record_id: correction.replacementRecordId ?? null,
    status: correction.status,
    reason: correction.reason,
    created_at: correction.createdAt,
    applied_at: correction.appliedAt ?? null
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function persistSnapshot(schoolId: string | null | undefined, snapshot: OperationsSnapshot) {
  saveLocalSnapshot(schoolId, snapshot);
}

export async function loadOperationsSnapshot(schoolId?: string | null): Promise<OperationsSnapshot> {
  const key = getSchoolKey(schoolId);
  const localSnapshot = getLocalSnapshot(key);

  if (supabase && !env.demoMode) {
    try {
      const remoteSnapshot = await loadSnapshotFromSupabase(key);
      if (remoteSnapshot) {
        saveLocalSnapshot(key, remoteSnapshot);
        return remoteSnapshot;
      }
    } catch {
      if (localSnapshot) {
        return localSnapshot;
      }
      throw new Error("Supabase sync failed while loading operations data.");
    }
  } else if (localSnapshot) {
    return localSnapshot;
  }

  const snapshot = starterSnapshot();
  saveLocalSnapshot(key, snapshot);
  return snapshot;
}

export async function saveAttendanceRecord(
  schoolId: string | null | undefined,
  studentId: string,
  status: AttendanceRecord["status"],
  note: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const student = snapshot.students.find((item) => item.id === studentId);
  if (!student) {
    return snapshot;
  }

  const updatedAttendance: AttendanceRecord[] = [
    {
      id: `at-${Date.now()}`,
      studentId,
      studentName: student.fullName,
      className: student.className,
      date: new Date().toISOString().slice(0, 10),
      status,
      note
    },
    ...snapshot.attendance
  ];

  const updatedSnapshot = {
    ...snapshot,
    attendance: updatedAttendance,
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: note.replace("Marked by ", ""),
        action: "Attendance marked",
        target: student.fullName,
        detail: `${student.fullName} marked ${status} for ${student.className}.`,
        createdAt: new Date().toISOString(),
        severity: status === "absent" ? "attention" as const : "info" as const
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "attendance", "insert", updatedAttendance[0].id, {
        studentId,
        status,
        note
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error } = await supabase.from("attendance").insert({
      school_id: schoolId,
      student_id: studentId,
      class_name: student.className,
      attended_on: new Date().toISOString().slice(0, 10),
      status,
      note,
      recorded_by: null
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await persistSnapshot(schoolId, updatedSnapshot);

  return updatedSnapshot;
}

export async function saveFeePayment(
  schoolId: string | null | undefined,
  studentId: string,
  amount: number,
  method: PaymentMethod,
  recordedBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const fee = snapshot.fees.find((item) => item.studentId === studentId);
  if (!fee) {
    return snapshot;
  }

  const amountPaid = Math.min(fee.amountPaid + amount, fee.amountDue);
  const balance = fee.amountDue - amountPaid;
  const updatedFee: FeeRecord = {
    ...fee,
    amountPaid,
    status: balance <= 0 ? "clear" : balance < fee.amountDue ? "partial" : fee.status
  };

  const receiptNumber = `DRM-RCPT-${Date.now().toString().slice(-6)}`;
  const paidAt = new Date().toISOString();
  const paymentRecord: FeePaymentRecord = {
    id: `pay-${Date.now()}`,
    feeId: fee.id,
    studentId,
    studentName: fee.studentName,
    amount,
    paidAt,
    method,
    recordedBy,
    receiptNumber
  };
  const liabilityRecord: BursarLiabilityRecord | null =
    method === "cash"
      ? {
          id: `bl-${Date.now()}`,
          bursarName: recordedBy,
          studentId,
          studentName: fee.studentName,
          receiptNumber,
          amount,
          collectedAt: paidAt,
          status: "outstanding"
        }
      : null;

  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    fees: snapshot.fees.map((item) => (item.studentId === studentId ? updatedFee : item)),
    payments: [paymentRecord, ...snapshot.payments],
    liabilities: liabilityRecord
      ? [liabilityRecord, ...snapshot.liabilities]
      : snapshot.liabilities,
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: recordedBy,
        action: method === "cash" ? "Cash received into bursar custody" : "Payment recorded",
        target: fee.studentName,
        detail:
          method === "cash"
            ? `${recordedBy} now owes the school ${amount.toLocaleString()} for receipt ${receiptNumber}.`
            : `${method} payment of ${amount.toLocaleString()} recorded as receipt ${receiptNumber}.`,
        createdAt: paidAt,
        severity: method === "cash" ? "attention" : "info"
      },
      ...snapshot.auditEvents
    ],
    reminders: snapshot.reminders
    ,syncMutations: [
      createSyncMutation(schoolId, "fee-payment", "insert", paymentRecord.id, paymentRecord as unknown as Record<string, unknown>),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error: feeError } = await supabase
      .from("fee_accounts")
      .update({
        amount_paid: amountPaid,
        status: updatedFee.status
      })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("student_id", studentId);

    if (feeError) {
      throw new Error(feeError.message);
    }

    const { error: paymentError } = await supabase.from("fee_payments").insert({
      school_id: schoolId ?? "demo-school",
      fee_account_id: fee.id,
      student_id: studentId,
      amount,
      method: paymentRecord.method,
      receipt_number: paymentRecord.receiptNumber,
      recorded_by: null,
      paid_at: paymentRecord.paidAt
    });

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (liabilityRecord) {
      const { error: liabilityError } = await supabase.from("bursar_liabilities").insert({
        school_id: schoolId ?? "demo-school",
        bursar_name: liabilityRecord.bursarName,
        student_id: liabilityRecord.studentId,
        student_name: liabilityRecord.studentName,
        receipt_number: liabilityRecord.receiptNumber,
        amount: liabilityRecord.amount,
        collected_at: liabilityRecord.collectedAt,
        status: liabilityRecord.status
      });

      if (liabilityError) {
        throw new Error(liabilityError.message);
      }
    }
  }

  await persistSnapshot(schoolId, updatedSnapshot);

  return updatedSnapshot;
}

export async function reverseFeePayment(
  schoolId: string | null | undefined,
  paymentId: string,
  reason: string,
  requestedBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const payment = snapshot.payments.find((item) => item.id === paymentId);
  if (!payment || payment.status === "reversed") {
    return snapshot;
  }

  const reversedAt = new Date().toISOString();
  const correctionId = `corr-${Date.now()}`;
  const paymentReversalCorrection: WorkflowCorrection = {
    id: correctionId,
    type: "payment-reversal",
    originalRecordId: payment.id,
    replacementRecordId: "",
    status: "applied",
    reason: reason.trim(),
    requestedBy,
    approvedBy: requestedBy,
    createdAt: reversedAt,
    appliedAt: reversedAt
  };
  const reversal: FeePaymentRecord = {
    ...payment,
    id: `pay-reversal-${Date.now()}`,
    amount: -payment.amount,
    receiptNumber: `REV-${payment.receiptNumber}`,
    paidAt: reversedAt,
    recordedBy: requestedBy,
    status: "reversed",
    reversalOf: payment.id,
    reversedAt,
    reversalReason: reason.trim()
  };

  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    payments: [
      { ...payment, status: "reversed", reversedAt, reversalReason: reason.trim() },
      reversal,
      ...snapshot.payments.filter((item) => item.id !== payment.id)
    ],
    fees: snapshot.fees.map((fee) =>
      {
        if (fee.id !== payment.feeId) {
          return fee;
        }

        const restoredPaid = Math.max(0, fee.amountPaid - payment.amount);
        const isPastDue = fee.dueDate < new Date().toISOString().slice(0, 10);

        return {
          ...fee,
          amountPaid: restoredPaid,
          status:
            restoredPaid >= fee.amountDue
              ? "clear"
              : isPastDue
                ? "overdue"
                : "partial"
        };
      }
    ),
    liabilities: snapshot.liabilities.map((liability) =>
      liability.receiptNumber === payment.receiptNumber
        ? { ...liability, status: "disputed" as const, settlementId: undefined }
        : liability
    ),
    corrections: [
      { ...paymentReversalCorrection, replacementRecordId: reversal.id },
      ...snapshot.corrections
    ],
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: requestedBy,
        action: "Payment reversed",
        target: payment.receiptNumber,
        detail: `${payment.receiptNumber} was reversed without deleting its original history. Reason: ${reason.trim()}`,
        createdAt: reversedAt,
        severity: "critical"
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "fee-payment", "correction", payment.id, {
        paymentId: payment.id,
        reversalId: reversal.id,
        reason: reason.trim()
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    await insertWorkflowCorrectionRecord(schoolId, {
      ...paymentReversalCorrection,
      replacementRecordId: reversal.id
    });
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}

export async function saveBursarSettlement(
  schoolId: string | null | undefined,
  bursarName: string,
  amount: number,
  channel: BursarSettlementRecord["channel"],
  reference: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const settlementId = `set-${Date.now()}`;
  let remaining = amount;
  const updatedLiabilities = snapshot.liabilities.map((liability) => {
    if (remaining <= 0 || liability.bursarName !== bursarName || liability.status === "settled") {
      return liability;
    }

    remaining -= liability.amount;
    return {
      ...liability,
      status: remaining >= 0 ? "settled" as const : "part-settled" as const,
      settlementId
    };
  });

  const settlement: BursarSettlementRecord = {
    id: settlementId,
    bursarName,
    amount,
    settledAt: new Date().toISOString(),
    channel,
    reference: reference.trim() || `SET-${Date.now().toString().slice(-6)}`,
    status: "pending-review"
  };

  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    liabilities: updatedLiabilities,
    settlements: [settlement, ...snapshot.settlements],
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: bursarName,
        action: "Bursar settlement recorded",
        target: settlement.reference,
        detail: `${amount.toLocaleString()} submitted through ${channel}; awaiting leadership review.`,
        createdAt: settlement.settledAt,
        severity: "attention"
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "bursar-settlement", "insert", settlement.id, settlement as unknown as Record<string, unknown>),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error } = await supabase.from("bursar_settlements").insert({
      school_id: schoolId ?? "demo-school",
      bursar_name: settlement.bursarName,
      amount: settlement.amount,
      settled_at: settlement.settledAt,
      channel: settlement.channel,
      reference: settlement.reference,
      status: settlement.status
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}

export async function saveRouteStatus(
  schoolId: string | null | undefined,
  routeId: string,
  status: TransportRoute["status"]
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const updatedRoutes = snapshot.routes.map((route) =>
    route.id === routeId ? { ...route, status } : route
  );

  const updatedSnapshot = {
    ...snapshot,
    routes: updatedRoutes,
    syncMutations: [
      createSyncMutation(schoolId, "transport-route", "update", routeId, { status }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error } = await supabase
      .from("transport_routes")
      .update({ status })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("id", routeId);

    if (error) {
      throw new Error(error.message);
    }
  }

  await persistSnapshot(schoolId, updatedSnapshot);

  return updatedSnapshot;
}

export async function createStudentRecord(
  schoolId: string | null | undefined,
  student: Omit<StudentRecord, "id">
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const resolvedMatricule = student.matricule?.trim() || `MAT-${Date.now()}`;
  const nextStudent: StudentRecord = {
    id: `st-${Date.now()}`,
    ...student,
    matricule: resolvedMatricule
  };

  const updatedSnapshot = {
    ...snapshot,
    students: [nextStudent, ...snapshot.students],
    syncMutations: [
      createSyncMutation(schoolId, "student-record", "insert", nextStudent.id, nextStudent as unknown as Record<string, unknown>),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error } = await supabase.from("students").insert({
      school_id: schoolId ?? "demo-school",
      full_name: student.fullName,
      class_name: student.className,
      guardian_name: student.guardian,
      guardian_relation: student.guardianRelation ?? "Guardian",
      guardian_phone: student.guardianPhone ?? null,
      guardian_email: student.guardianEmail ?? null,
      matricule: resolvedMatricule,
      fee_status: student.feeStatus,
      attendance_rate: student.attendanceRate,
      risk_level: student.riskLevel,
      enrolment_status: student.enrolmentStatus ?? "active",
      academic_year: student.academicYear ?? null,
      parent_user_ids: student.parentUserIds ?? []
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await persistSnapshot(schoolId, updatedSnapshot);

  return updatedSnapshot;
}

export async function linkParentToStudent(
  schoolId: string | null | undefined,
  studentId: string,
  parentUserId: string,
  parentName: string,
  requestedBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const student = snapshot.students.find((item) => item.id === studentId);

  if (!student || !parentUserId.trim()) {
    return snapshot;
  }

  const currentLinks = student.parentUserIds ?? [];
  if (currentLinks.includes(parentUserId)) {
    return snapshot;
  }

  const linkedAt = new Date().toISOString();
  const parentLinkCorrection: WorkflowCorrection = {
    id: `corr-${Date.now()}`,
    type: "parent-link",
    originalRecordId: studentId,
    replacementRecordId: parentUserId,
    status: "applied",
    reason: `Linked ${parentName} to ${student.fullName}`,
    requestedBy,
    approvedBy: requestedBy,
    createdAt: linkedAt,
    appliedAt: linkedAt
  };
  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    students: snapshot.students.map((item) =>
      item.id === studentId
        ? {
            ...item,
            parentUserIds: [...(item.parentUserIds ?? []), parentUserId]
          }
        : item
    ),
    corrections: [
      parentLinkCorrection,
      ...snapshot.corrections
    ],
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: requestedBy,
        action: "Parent linked to learner",
        target: student.fullName,
        detail: `${parentName} was linked to ${student.fullName} for family-facing workspace access.`,
        createdAt: linkedAt,
        severity: "attention"
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "parent-link", "update", studentId, {
        studentId,
        parentUserId,
        parentName
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error: studentError } = await supabase
      .from("students")
      .update({
        parent_user_ids: [...currentLinks, parentUserId]
      })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("id", studentId);

    if (studentError) {
      throw new Error(studentError.message);
    }

    await insertWorkflowCorrectionRecord(schoolId, parentLinkCorrection);
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}

export async function changeStudentPlacement(
  schoolId: string | null | undefined,
  studentId: string,
  nextClassName: string,
  reason: string,
  requestedBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const student = snapshot.students.find((item) => item.id === studentId);
  const trimmedClass = nextClassName.trim();
  const trimmedReason = reason.trim();

  if (!student || !trimmedClass || student.className === trimmedClass) {
    return snapshot;
  }

  const changedAt = new Date().toISOString();
  const correctionId = `corr-${Date.now()}`;
  const placementCorrection: WorkflowCorrection = {
    id: correctionId,
    type: "placement-change",
    originalRecordId: studentId,
    replacementRecordId: studentId,
    status: "applied",
    reason: trimmedReason || `Moved from ${student.className} to ${trimmedClass}`,
    requestedBy,
    approvedBy: requestedBy,
    createdAt: changedAt,
    appliedAt: changedAt
  };
  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    students: snapshot.students.map((item) =>
      item.id === studentId
        ? {
            ...item,
            className: trimmedClass
          }
        : item
    ),
    fees: snapshot.fees.map((fee) =>
      fee.studentId === studentId
        ? {
            ...fee,
            className: trimmedClass
          }
        : fee
    ),
    attendance: snapshot.attendance.map((entry) =>
      entry.studentId === studentId
        ? {
            ...entry,
            className: trimmedClass
          }
        : entry
    ),
    corrections: [
      placementCorrection,
      ...snapshot.corrections
    ],
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: requestedBy,
        action: "Student placement changed",
        target: student.fullName,
        detail: `${student.fullName} moved from ${student.className} to ${trimmedClass}. Reason: ${trimmedReason || "Administrative correction"}.`,
        createdAt: changedAt,
        severity: "attention"
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "student-placement", "correction", studentId, {
        studentId,
        fromClassName: student.className,
        toClassName: trimmedClass,
        reason: trimmedReason
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error: studentError } = await supabase
      .from("students")
      .update({
        class_name: trimmedClass
      })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("id", studentId);

    if (studentError) {
      throw new Error(studentError.message);
    }

    await insertWorkflowCorrectionRecord(schoolId, placementCorrection);
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}

export async function mergeStudentRecords(
  schoolId: string | null | undefined,
  sourceStudentId: string,
  targetStudentId: string,
  reason: string,
  requestedBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const source = snapshot.students.find((item) => item.id === sourceStudentId);
  const target = snapshot.students.find((item) => item.id === targetStudentId);
  const trimmedReason = reason.trim();

  if (!source || !target || sourceStudentId === targetStudentId) {
    return snapshot;
  }

  const mergedAt = new Date().toISOString();
  const mergedTarget: StudentRecord = {
    ...target,
    guardian: target.guardian || source.guardian,
    guardianRelation: target.guardianRelation || source.guardianRelation,
    guardianPhone: target.guardianPhone || source.guardianPhone,
    guardianEmail: target.guardianEmail || source.guardianEmail,
    matricule: target.matricule || source.matricule,
    feeStatus:
      target.feeStatus === "overdue" || source.feeStatus === "overdue"
        ? "overdue"
        : target.feeStatus === "partial" || source.feeStatus === "partial"
          ? "partial"
          : "clear",
    attendanceRate: Math.round((target.attendanceRate + source.attendanceRate) / 2),
    riskLevel:
      target.riskLevel === "high" || source.riskLevel === "high"
        ? "high"
        : target.riskLevel === "medium" || source.riskLevel === "medium"
          ? "medium"
          : "low",
    parentUserIds: Array.from(
      new Set([...(target.parentUserIds ?? []), ...(source.parentUserIds ?? [])])
    )
  };
  const mergeCorrection: WorkflowCorrection = {
    id: `corr-${Date.now()}`,
    type: "duplicate-merge",
    originalRecordId: sourceStudentId,
    replacementRecordId: targetStudentId,
    status: "applied",
    reason: trimmedReason || `Merged ${source.fullName} into ${target.fullName}`,
    requestedBy,
    approvedBy: requestedBy,
    createdAt: mergedAt,
    appliedAt: mergedAt
  };

  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    students: snapshot.students.map((item) => {
      if (item.id === targetStudentId) {
        return mergedTarget;
      }

      if (item.id === sourceStudentId) {
        return {
          ...item,
          enrolmentStatus: "transferred",
          mergedIntoStudentId: targetStudentId
        };
      }

      return item;
    }),
    attendance: snapshot.attendance.map((entry) =>
      entry.studentId === sourceStudentId
        ? { ...entry, studentId: targetStudentId, studentName: mergedTarget.fullName }
        : entry
    ),
    fees: snapshot.fees.map((fee) =>
      fee.studentId === sourceStudentId
        ? { ...fee, studentId: targetStudentId, studentName: mergedTarget.fullName }
        : fee
    ),
    payments: snapshot.payments.map((payment) =>
      payment.studentId === sourceStudentId
        ? { ...payment, studentId: targetStudentId, studentName: mergedTarget.fullName }
        : payment
    ),
    reminders: snapshot.reminders.map((reminder) =>
      reminder.studentId === sourceStudentId
        ? { ...reminder, studentId: targetStudentId, studentName: mergedTarget.fullName }
        : reminder
    ),
    liabilities: snapshot.liabilities.map((liability) =>
      liability.studentId === sourceStudentId
        ? { ...liability, studentId: targetStudentId, studentName: mergedTarget.fullName }
        : liability
    ),
    corrections: [
      mergeCorrection,
      ...snapshot.corrections
    ],
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: requestedBy,
        action: "Duplicate student merged",
        target: mergedTarget.fullName,
        detail: `${source.fullName} was merged into ${target.fullName}. Reason: ${trimmedReason || "Duplicate registry correction"}.`,
        createdAt: mergedAt,
        severity: "critical"
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "duplicate-merge", "correction", sourceStudentId, {
        sourceStudentId,
        targetStudentId,
        reason: trimmedReason
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error: targetError } = await supabase
      .from("students")
      .update({
        guardian_name: mergedTarget.guardian,
        guardian_relation: mergedTarget.guardianRelation ?? null,
        guardian_phone: mergedTarget.guardianPhone ?? null,
        guardian_email: mergedTarget.guardianEmail ?? null,
        matricule: mergedTarget.matricule ?? source.matricule ?? target.matricule,
        fee_status: mergedTarget.feeStatus,
        attendance_rate: mergedTarget.attendanceRate,
        risk_level: mergedTarget.riskLevel,
        parent_user_ids: mergedTarget.parentUserIds ?? []
      })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("id", targetStudentId);

    if (targetError) {
      throw new Error(targetError.message);
    }

    const { error: sourceError } = await supabase
      .from("students")
      .update({
        enrolment_status: "transferred",
        merged_into_student_id: targetStudentId
      })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("id", sourceStudentId);

    if (sourceError) {
      throw new Error(sourceError.message);
    }

    await insertWorkflowCorrectionRecord(schoolId, mergeCorrection);
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}

export async function adjustFeeAccount(
  schoolId: string | null | undefined,
  feeId: string,
  nextAmountDue: number,
  reason: string,
  requestedBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const fee = snapshot.fees.find((item) => item.id === feeId);
  const trimmedReason = reason.trim();

  if (!fee || !Number.isFinite(nextAmountDue) || nextAmountDue < 0 || fee.amountDue === nextAmountDue) {
    return snapshot;
  }

  const adjustedAt = new Date().toISOString();
  const nextStatus: FeeRecord["status"] =
    fee.amountPaid >= nextAmountDue
      ? "clear"
      : fee.dueDate < new Date().toISOString().slice(0, 10)
        ? "overdue"
        : "partial";
  const feeAdjustmentCorrection: WorkflowCorrection = {
    id: `corr-${Date.now()}`,
    type: "invoice-adjustment",
    originalRecordId: feeId,
    replacementRecordId: feeId,
    status: "applied",
    reason: trimmedReason || `Fee due adjusted from ${fee.amountDue} to ${nextAmountDue}`,
    requestedBy,
    approvedBy: requestedBy,
    createdAt: adjustedAt,
    appliedAt: adjustedAt
  };

  const updatedSnapshot: OperationsSnapshot = {
    ...snapshot,
    fees: snapshot.fees.map((item) =>
      item.id === feeId
        ? {
            ...item,
            amountDue: nextAmountDue,
            status: nextStatus
          }
        : item
    ),
    corrections: [
      feeAdjustmentCorrection,
      ...snapshot.corrections
    ],
    auditEvents: [
      {
        id: `audit-${Date.now()}`,
        actor: requestedBy,
        action: "Fee account adjusted",
        target: fee.studentName,
        detail: `${fee.studentName} fee due changed from ${fee.amountDue.toLocaleString()} to ${nextAmountDue.toLocaleString()}. Reason: ${trimmedReason || "Administrative correction"}.`,
        createdAt: adjustedAt,
        severity: "critical"
      },
      ...snapshot.auditEvents
    ],
    syncMutations: [
      createSyncMutation(schoolId, "fee-adjustment", "correction", feeId, {
        feeId,
        previousAmountDue: fee.amountDue,
        nextAmountDue,
        reason: trimmedReason
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const { error: feeError } = await supabase
      .from("fee_accounts")
      .update({
        amount_due: nextAmountDue,
        status: nextStatus
      })
      .eq("school_id", schoolId ?? "demo-school")
      .eq("id", feeId);

    if (feeError) {
      throw new Error(feeError.message);
    }

    await insertWorkflowCorrectionRecord(schoolId, feeAdjustmentCorrection);
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}

export async function queueFeeReminder(
  schoolId: string | null | undefined,
  studentId: string,
  createdBy: string
) {
  const snapshot = await loadOperationsSnapshot(schoolId);
  const fee = snapshot.fees.find((item) => item.studentId === studentId);
  if (!fee) {
    return snapshot;
  }

  const balance = fee.amountDue - fee.amountPaid;
  const reminderId = `rem-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const updatedSnapshot = {
    ...snapshot,
    reminders: [
      {
        id: reminderId,
        studentId,
        studentName: fee.studentName,
        channel: "sms" as const,
        message: `Reminder: ${fee.studentName} has an outstanding balance of ${balance.toLocaleString()}.`,
        status: "queued" as const,
        createdAt,
        createdBy
      },
      ...snapshot.reminders
    ],
    syncMutations: [
      createSyncMutation(schoolId, "fee-reminder", "insert", reminderId, {
        studentId,
        balance,
        createdBy
      }),
      ...snapshot.syncMutations
    ]
  };

  if (supabase && !env.demoMode) {
    const reminder = updatedSnapshot.reminders[0];
    const { error } = await supabase.from("fee_reminders").insert({
      school_id: schoolId ?? "demo-school",
      student_id: studentId,
      channel: reminder.channel,
      message: reminder.message,
      status: reminder.status,
      created_by: null,
      created_at: reminder.createdAt
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await persistSnapshot(schoolId, updatedSnapshot);
  return updatedSnapshot;
}
