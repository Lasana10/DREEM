import { useEffect, useState } from "react";
import type {
  AttendanceRecord,
  AuditEvent,
  BursarLiabilityRecord,
  BursarSettlementRecord,
  FeePaymentRecord,
  FeeRecord,
  FeeReminderRecord,
  PaymentMethod,
  StudentRecord,
  SyncMutation,
  TransportRoute,
  UserProfile,
  WorkflowCorrection
} from "../../shared/types";
import {
  createStudentRecord,
  adjustFeeAccount,
  changeStudentPlacement,
  mergeStudentRecords,
  linkParentToStudent,
  loadOperationsSnapshot,
  queueFeeReminder,
  saveAttendanceRecord,
  saveBursarSettlement,
  saveFeePayment,
  reverseFeePayment,
  saveRouteStatus
} from "./repositories/operationsRepository";

type OperationsSnapshot = Awaited<ReturnType<typeof loadOperationsSnapshot>>;

export function useOperationsData(activeUser: UserProfile | null) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [payments, setPayments] = useState<FeePaymentRecord[]>([]);
  const [liabilities, setLiabilities] = useState<BursarLiabilityRecord[]>([]);
  const [settlements, setSettlements] = useState<BursarSettlementRecord[]>([]);
  const [reminders, setReminders] = useState<FeeReminderRecord[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [corrections, setCorrections] = useState<WorkflowCorrection[]>([]);
  const [syncMutations, setSyncMutations] = useState<SyncMutation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  function applySnapshot(snapshot: OperationsSnapshot) {
    setStudents(snapshot.students);
    setAttendance(snapshot.attendance);
    setFees(snapshot.fees);
    setPayments(snapshot.payments);
    setLiabilities(snapshot.liabilities);
    setSettlements(snapshot.settlements);
    setReminders(snapshot.reminders);
    setRoutes(snapshot.routes);
    setAuditEvents(snapshot.auditEvents);
    setCorrections(snapshot.corrections);
    setSyncMutations(snapshot.syncMutations);
  }

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const snapshot = await loadOperationsSnapshot(activeUser?.schoolId ?? null);

        if (active) {
          applySnapshot(snapshot);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load operational data."
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [activeUser?.schoolId]);

  async function recordAttendance(
    studentId: string,
    status: AttendanceRecord["status"]
  ) {
    setError("");

    try {
      const snapshot = await saveAttendanceRecord(
        activeUser?.schoolId ?? null,
        studentId,
        status,
        `Marked by ${activeUser?.name ?? "staff"}`
      );

      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not update attendance."
      );
    }
  }

  async function postPayment(studentId: string, amount: number, method: PaymentMethod) {
    setError("");

    try {
      const snapshot = await saveFeePayment(
        activeUser?.schoolId ?? null,
        studentId,
        amount,
        method,
        activeUser?.name ?? "Finance Desk"
      );

      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not record payment."
      );
    }
  }

  async function settleBursarCash(
    amount: number,
    channel: BursarSettlementRecord["channel"],
    reference: string
  ) {
    setError("");

    try {
      const snapshot = await saveBursarSettlement(
        activeUser?.schoolId ?? null,
        activeUser?.name ?? "Finance Desk",
        amount,
        channel,
        reference
      );

      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not record bursar settlement."
      );
    }
  }

  async function reversePayment(paymentId: string, reason: string) {
    setError("");

    try {
      const snapshot = await reverseFeePayment(
        activeUser?.schoolId ?? null,
        paymentId,
        reason,
        activeUser?.name ?? "Finance Desk"
      );
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not reverse payment."
      );
    }
  }

  async function updateRouteStatus(
    routeId: string,
    status: TransportRoute["status"]
  ) {
    setError("");

    try {
      const snapshot = await saveRouteStatus(activeUser?.schoolId ?? null, routeId, status);
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not update route status."
      );
    }
  }

  async function sendFeeReminder(studentId: string) {
    setError("");

    try {
      const snapshot = await queueFeeReminder(
        activeUser?.schoolId ?? null,
        studentId,
        activeUser?.name ?? "Finance Desk"
      );

      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not queue fee reminder."
      );
    }
  }

  async function createStudent(student: Omit<StudentRecord, "id">) {
    setError("");

    try {
      const snapshot = await createStudentRecord(activeUser?.schoolId ?? null, student);
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not create student record."
      );
    }
  }

  async function changePlacement(studentId: string, nextClassName: string, reason: string) {
    setError("");

    try {
      const snapshot = await changeStudentPlacement(
        activeUser?.schoolId ?? null,
        studentId,
        nextClassName,
        reason,
        activeUser?.name ?? "School Admin"
      );
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not change student placement."
      );
    }
  }

  async function adjustFee(feeId: string, nextAmountDue: number, reason: string) {
    setError("");

    try {
      const snapshot = await adjustFeeAccount(
        activeUser?.schoolId ?? null,
        feeId,
        nextAmountDue,
        reason,
        activeUser?.name ?? "Finance Desk"
      );
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not adjust fee account."
      );
    }
  }

  async function mergeStudents(sourceStudentId: string, targetStudentId: string, reason: string) {
    setError("");

    try {
      const snapshot = await mergeStudentRecords(
        activeUser?.schoolId ?? null,
        sourceStudentId,
        targetStudentId,
        reason,
        activeUser?.name ?? "School Admin"
      );
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not merge duplicate student records."
      );
    }
  }

  async function linkParent(studentId: string, parentUserId: string, parentName: string) {
    setError("");

    try {
      const snapshot = await linkParentToStudent(
        activeUser?.schoolId ?? null,
        studentId,
        parentUserId,
        parentName,
        activeUser?.name ?? "School Admin"
      );
      applySnapshot(snapshot);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Could not link parent to learner."
      );
    }
  }

  return {
    students,
    attendance,
    fees,
    payments,
    liabilities,
    settlements,
    reminders,
    routes,
    auditEvents,
    corrections,
    syncMutations,
    recordAttendance,
    postPayment,
    settleBursarCash,
    reversePayment,
    sendFeeReminder,
    updateRouteStatus,
    createStudent,
    linkParent,
    changePlacement,
    adjustFee,
    mergeStudents,
    isLoading,
    error
  };
}
