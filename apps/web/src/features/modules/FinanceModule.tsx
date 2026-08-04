import { useState } from "react";
import { hasUserPermission } from "../../lib/permissions";
import type {
  BursarLiabilityRecord,
  BursarSettlementRecord,
  WorkflowCorrection,
  FeePaymentRecord,
  FeeRecord,
  FeeReminderRecord,
  PaymentMethod,
  StudentRecord
} from "../../shared/types";
import type { UserProfile } from "../../shared/types";

interface FinanceModuleProps {
  activeUser: UserProfile;
  students: StudentRecord[];
  fees: FeeRecord[];
  payments: FeePaymentRecord[];
  liabilities: BursarLiabilityRecord[];
  settlements: BursarSettlementRecord[];
  corrections: WorkflowCorrection[];
  reminders: FeeReminderRecord[];
  onPostPayment: (studentId: string, amount: number, method: PaymentMethod) => void;
  onSettleCash: (
    amount: number,
    channel: BursarSettlementRecord["channel"],
    reference: string
  ) => void;
  onAdjustFee: (feeId: string, nextAmountDue: number, reason: string) => void;
  onReversePayment: (paymentId: string, reason: string) => void;
  onSendReminder: (studentId: string) => void;
}

export function FinanceModule({
  activeUser,
  students,
  fees,
  payments,
  liabilities,
  settlements,
  corrections,
  reminders,
  onPostPayment,
  onSettleCash,
  onAdjustFee,
  onReversePayment,
  onSendReminder
}: FinanceModuleProps) {
  const [paymentAmount, setPaymentAmount] = useState("50000");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [settlementAmount, setSettlementAmount] = useState("50000");
  const [settlementChannel, setSettlementChannel] =
    useState<BursarSettlementRecord["channel"]>("cash-handover");
  const [settlementReference, setSettlementReference] = useState("");
  const [settlementMessage, setSettlementMessage] = useState("");
  const [reversalReason, setReversalReason] = useState("Incorrect payment entry");
  const [adjustmentDraft, setAdjustmentDraft] = useState({
    feeId: "",
    amountDue: "",
    reason: "Corrected invoice amount"
  });
  const overdueCount = fees.filter((fee) => fee.status === "overdue").length;
  const partialCount = fees.filter((fee) => fee.status === "partial").length;
  const totalDue = fees.reduce((sum, fee) => sum + fee.amountDue, 0);
  const totalPaid = fees.reduce((sum, fee) => sum + fee.amountPaid, 0);
  const isParentWorkspace = activeUser.role === "parent";
  const isLeadershipWorkspace = activeUser.role === "leadership";
  const canPostPayments = hasUserPermission(activeUser, "finance.payments.write");
  const canSendReminders = hasUserPermission(activeUser, "finance.reminders.write");
  const postedPayments = payments.filter((payment) => payment.status !== "reversed");
  const collectedToday = postedPayments
    .filter((payment) => payment.paidAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const methodTotals = postedPayments.reduce<Record<PaymentMethod, number>>(
    (totals, payment) => ({
      ...totals,
      [payment.method]: totals[payment.method] + payment.amount
    }),
    { cash: 0, transfer: 0, "mobile-money": 0, "orange-money": 0 }
  );
  const outstandingLiabilities = liabilities.filter(
    (liability) => liability.status !== "settled"
  );
  const outstandingCash = outstandingLiabilities.reduce(
    (sum, liability) => sum + liability.amount,
    0
  );
  const bursarOutstanding = outstandingLiabilities
    .filter((liability) => liability.bursarName === activeUser.name)
    .reduce((sum, liability) => sum + liability.amount, 0);
  const linkedStudents = students.filter((student) =>
    student.parentUserIds?.includes(activeUser.id) || student.guardian === activeUser.name
  );
  const linkedStudentIds = new Set(linkedStudents.map((student) => student.id));
  const visibleFees = isParentWorkspace
    ? fees.filter((fee) => linkedStudentIds.has(fee.studentId))
    : fees;
  const visiblePayments = isParentWorkspace
    ? payments.filter((payment) => linkedStudentIds.has(payment.studentId))
    : payments;
  const visibleReminders = isParentWorkspace
    ? reminders.filter((reminder) => linkedStudentIds.has(reminder.studentId))
    : reminders;
  const visibleTotalDue = visibleFees.reduce((sum, fee) => sum + fee.amountDue, 0);
  const visibleTotalPaid = visibleFees.reduce((sum, fee) => sum + fee.amountPaid, 0);
  const visibleOutstanding = visibleFees.reduce(
    (sum, fee) => sum + (fee.amountDue - fee.amountPaid),
    0
  );
  const pendingSettlements = settlements.filter((settlement) => settlement.status === "pending-review");
  const disputedLiabilities = liabilities.filter((liability) => liability.status === "disputed");
  const criticalCorrections = corrections.filter(
    (correction) =>
      correction.type === "payment-reversal" ||
      correction.type === "invoice-adjustment"
  );

  function exportReceipt(payment: FeePaymentRecord) {
    const receipt = [
      "DREEM SCHOOL RECEIPT",
      `Receipt: ${payment.receiptNumber}`,
      `Student: ${payment.studentName}`,
      `Amount: ${payment.amount.toLocaleString()}`,
      `Method: ${payment.method}`,
      `Paid at: ${payment.paidAt}`,
      `Recorded by: ${payment.recordedBy}`
    ].join("\n");
    const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${payment.receiptNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function submitSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettlementMessage("");

    const amount = Number(settlementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSettlementMessage("Enter a valid settlement amount.");
      return;
    }

    onSettleCash(amount, settlementChannel, settlementReference);
    setSettlementMessage("Settlement recorded for leadership review.");
    setSettlementReference("");
  }

  function submitFeeAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountDue = Number(adjustmentDraft.amountDue);
    if (!adjustmentDraft.feeId || !Number.isFinite(amountDue) || amountDue < 0) {
      return;
    }

    onAdjustFee(adjustmentDraft.feeId, amountDue, adjustmentDraft.reason);
    setAdjustmentDraft({
      feeId: "",
      amountDue: "",
      reason: "Corrected invoice amount"
    });
  }

  return (
    <section className="module-surface">
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {isParentWorkspace
                ? "Family finance"
                : isLeadershipWorkspace
                  ? "Finance oversight"
                  : "Bursar workflow"}
            </span>
            <h2>
              {isParentWorkspace
                ? "Child fees, balances, and reminder follow-up"
                : isLeadershipWorkspace
                  ? "Collections, liabilities, and correction control"
                  : "Fee accounts and collections"}
            </h2>
          </div>
        </div>

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>{isParentWorkspace ? "Family paid" : "Total paid"}</span>
            <strong>{(isParentWorkspace ? visibleTotalPaid : totalPaid).toLocaleString()}</strong>
          </article>
          <article className="signal-card warm">
            <span>{isParentWorkspace ? "Open balance" : "Partial"}</span>
            <strong>{isParentWorkspace ? visibleOutstanding.toLocaleString() : partialCount}</strong>
          </article>
          <article className="signal-card alert">
            <span>{isParentWorkspace ? "Linked learners" : "Overdue"}</span>
            <strong>{isParentWorkspace ? linkedStudents.length : overdueCount}</strong>
          </article>
          <article className="signal-card cool">
            <span>Collected today</span>
            <strong>{collectedToday.toLocaleString()}</strong>
          </article>
          <article className="signal-card alert">
            <span>Cash in custody</span>
            <strong>{outstandingCash.toLocaleString()}</strong>
          </article>
        </div>

        <p className="section-copy">
          {isParentWorkspace
            ? `Family due ${visibleTotalDue.toLocaleString()} · This view should help families understand what is outstanding and what has already been paid.`
            : `Total due ${totalDue.toLocaleString()} · These records are structured so the UI can move cleanly to Supabase-backed fee accounts.`}
        </p>

        <div className="table-list">
          {visibleFees.map((record) => {
            const balance = record.amountDue - record.amountPaid;
            return (
              <article key={record.id} className="record-row">
                <div>
                  <strong>{record.studentName}</strong>
                  <p>
                    {record.className} · Paid {record.amountPaid.toLocaleString()} / {record.amountDue.toLocaleString()} · Due {record.dueDate}
                  </p>
                </div>
                <div className="action-row">
                  <span className="module-chip">{record.status}</span>
                  <span className="module-chip">Balance {balance.toLocaleString()}</span>
                  {canPostPayments ? (
                    <button
                      className="module-chip"
                      disabled={!canPostPayments}
                      onClick={() =>
                        onPostPayment(record.studentId, Number(paymentAmount), paymentMethod)
                      }
                    >
                      Post {paymentMethod}
                    </button>
                  ) : null}
                  {canSendReminders ? (
                    <button
                      className="module-chip"
                      disabled={!canSendReminders}
                      onClick={() => onSendReminder(record.studentId)}
                    >
                      Queue SMS reminder
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {isParentWorkspace && visibleFees.length === 0 ? (
            <article className="record-row">
              <div>
                <strong>No linked fee accounts found.</strong>
                <p>This parent workspace needs a real parent-child link in the school identity model.</p>
              </div>
              <span className="module-chip">setup needed</span>
            </article>
          ) : null}
        </div>
      </section>

      {isLeadershipWorkspace ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Leadership finance watch</span>
              <h2>Oversight queue for liabilities, settlements, and corrections</h2>
            </div>
          </div>

          <div className="announcement-stats">
            <article className="signal-card warm">
              <span>Pending settlements</span>
              <strong>{pendingSettlements.length}</strong>
            </article>
            <article className="signal-card alert">
              <span>Disputed liabilities</span>
              <strong>{disputedLiabilities.length}</strong>
            </article>
            <article className="signal-card cool">
              <span>Critical corrections</span>
              <strong>{criticalCorrections.length}</strong>
            </article>
          </div>

          <div className="table-list">
            {pendingSettlements.slice(0, 4).map((settlement) => (
              <article key={settlement.id} className="record-row">
                <div>
                  <strong>{settlement.bursarName}</strong>
                  <p>
                    {settlement.channel} · {settlement.reference} · {settlement.settledAt}
                  </p>
                  <p>{settlement.amount.toLocaleString()} awaiting leadership review.</p>
                </div>
                <span className="module-chip">{settlement.status}</span>
              </article>
            ))}
            {disputedLiabilities.slice(0, 4).map((liability) => (
              <article key={liability.id} className="record-row">
                <div>
                  <strong>{liability.studentName}</strong>
                  <p>
                    {liability.receiptNumber} · {liability.bursarName} · {liability.collectedAt}
                  </p>
                  <p>{liability.amount.toLocaleString()} is marked disputed and needs review.</p>
                </div>
                <span className="module-chip">{liability.status}</span>
              </article>
            ))}
            {criticalCorrections.slice(0, 4).map((correction) => (
              <article key={correction.id} className="record-row">
                <div>
                  <strong>{correction.type}</strong>
                  <p>
                    {correction.originalRecordId}
                    {correction.replacementRecordId ? ` -> ${correction.replacementRecordId}` : ""}
                  </p>
                  <p>{correction.reason}</p>
                </div>
                <span className="module-chip">{correction.status}</span>
              </article>
            ))}
            {pendingSettlements.length === 0 &&
            disputedLiabilities.length === 0 &&
            criticalCorrections.length === 0 ? (
              <article className="record-row">
                <div>
                  <strong>No finance oversight queue right now.</strong>
                  <p>Leadership review items for settlements and corrections will surface here.</p>
                </div>
                <span className="module-chip">clear</span>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isParentWorkspace ? (
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Invoice corrections</span>
            <h2>Adjust a fee account without deleting history</h2>
          </div>
        </div>

        <form className="composer" onSubmit={submitFeeAdjustment}>
          <div className="composer-grid">
            <label>
              <span>Fee account</span>
              <select
                disabled={!canPostPayments}
                value={adjustmentDraft.feeId}
                onChange={(event) =>
                  setAdjustmentDraft((current) => ({ ...current, feeId: event.target.value }))
                }
              >
                <option value="">Choose student account</option>
                {fees.map((fee) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.studentName} - current due {fee.amountDue.toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Correct amount due</span>
              <input
                disabled={!canPostPayments}
                value={adjustmentDraft.amountDue}
                onChange={(event) =>
                  setAdjustmentDraft((current) => ({ ...current, amountDue: event.target.value }))
                }
                placeholder="250000"
              />
            </label>
            <label>
              <span>Reason</span>
              <input
                disabled={!canPostPayments}
                value={adjustmentDraft.reason}
                onChange={(event) =>
                  setAdjustmentDraft((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </label>
          </div>
          <button className="primary-button" disabled={!canPostPayments} type="submit">
            Apply audited adjustment
          </button>
        </form>
      </section>) : null}

      {!isParentWorkspace ? (
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Agency accounting</span>
            <h2>Bursar cash custody and settlement</h2>
          </div>
        </div>

        <div className="announcement-stats">
          <article className="signal-card alert">
            <span>My outstanding cash</span>
            <strong>{bursarOutstanding.toLocaleString()}</strong>
          </article>
          <article className="signal-card warm">
            <span>Open receipts</span>
            <strong>{outstandingLiabilities.length}</strong>
          </article>
          <article className="signal-card good">
            <span>Settlements logged</span>
            <strong>{settlements.length}</strong>
          </article>
        </div>

        <form className="composer settlement-form" onSubmit={submitSettlement}>
          <div className="composer-grid">
            <label>
              <span>Settlement amount</span>
              <input
                value={settlementAmount}
                disabled={!canPostPayments}
                onChange={(event) => setSettlementAmount(event.target.value)}
              />
            </label>
            <label>
              <span>Settlement channel</span>
              <select
                value={settlementChannel}
                disabled={!canPostPayments}
                onChange={(event) =>
                  setSettlementChannel(event.target.value as BursarSettlementRecord["channel"])
                }
              >
                <option value="cash-handover">Cash handover</option>
                <option value="bank-deposit">Bank deposit</option>
                <option value="mobile-money">Mobile Money</option>
                <option value="orange-money">Orange Money</option>
              </select>
            </label>
            <label>
              <span>Reference / note</span>
              <input
                value={settlementReference}
                disabled={!canPostPayments}
                onChange={(event) => setSettlementReference(event.target.value)}
                placeholder="Deposit slip, proprietor sign-off, MoMo ref..."
              />
            </label>
          </div>

          <button className="primary-button" disabled={!canPostPayments} type="submit">
            Record settlement
          </button>
          {settlementMessage ? <p className="loading-note">{settlementMessage}</p> : null}
        </form>

        <div className="table-list">
          {outstandingLiabilities.slice(0, 6).map((liability) => (
            <article key={liability.id} className="record-row">
              <div>
                <strong>{liability.studentName}</strong>
                <p>
                  {liability.receiptNumber} · {liability.bursarName} holds {liability.amount.toLocaleString()}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{liability.status}</span>
                <span className="module-chip">{liability.collectedAt}</span>
              </div>
            </article>
          ))}
        </div>
      </section>) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">{isParentWorkspace ? "Payment history" : "Payment ledger"}</span>
            <h2>{isParentWorkspace ? "Recent family payments" : "Recent collections"}</h2>
          </div>
        </div>

        {!isParentWorkspace ? (<label className="composer">
          <span>Quick amount</span>
          <input
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
          />
        </label>) : null}

        {!isParentWorkspace ? (<label className="composer">
          <span>Payment method</span>
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
          >
            <option value="cash">Cash</option>
            <option value="mobile-money">Mobile Money</option>
            <option value="orange-money">Orange Money</option>
            <option value="transfer">Bank transfer</option>
          </select>
        </label>) : null}

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>Cash</span>
            <strong>{methodTotals.cash.toLocaleString()}</strong>
          </article>
          <article className="signal-card warm">
            <span>MoMo</span>
            <strong>{methodTotals["mobile-money"].toLocaleString()}</strong>
          </article>
          <article className="signal-card cool">
            <span>Orange Money</span>
            <strong>{methodTotals["orange-money"].toLocaleString()}</strong>
          </article>
        </div>

        <div className="table-list">
          {visiblePayments.slice(0, 6).map((payment) => (
            <article key={payment.id} className="record-row">
              <div>
                <strong>{payment.studentName}</strong>
                <p>
                  {payment.receiptNumber} · {payment.method} · {payment.paidAt}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{payment.recordedBy}</span>
                <span className="module-chip">{payment.amount.toLocaleString()}</span>
                <button
                  className="module-chip"
                  type="button"
                  onClick={() => exportReceipt(payment)}
                >
                  Receipt
                </button>
                {canPostPayments ? (
                  <button
                    className="module-chip"
                    type="button"
                    disabled={!canPostPayments || payment.status === "reversed"}
                    onClick={() => onReversePayment(payment.id, reversalReason)}
                  >
                    Reverse
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {!isParentWorkspace ? (<label className="composer">
          <span>Correction reason used for reversals</span>
          <input
            value={reversalReason}
            disabled={!canPostPayments}
            onChange={(event) => setReversalReason(event.target.value)}
          />
        </label>) : null}
        <p className="section-copy">
          Reversals preserve the original receipt, create a traceable counter-entry,
          and record who corrected it. They never silently delete payment history.
          {corrections.length ? ` ${corrections.length} correction(s) recorded.` : ""}
        </p>
      </section>

      {!isParentWorkspace ? (
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Settlement history</span>
            <h2>Cash remittance log</h2>
          </div>
        </div>

        <div className="table-list">
          {settlements.slice(0, 6).map((settlement) => (
            <article key={settlement.id} className="record-row">
              <div>
                <strong>{settlement.bursarName}</strong>
                <p>
                  {settlement.channel} · {settlement.reference} · {settlement.settledAt}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{settlement.amount.toLocaleString()}</span>
                <span className="module-chip">{settlement.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">{isParentWorkspace ? "School reminders" : "Parent follow-up"}</span>
            <h2>{isParentWorkspace ? "Messages affecting this family" : "Reminder queue"}</h2>
          </div>
        </div>

        <div className="table-list">
          {visibleReminders.slice(0, 6).map((reminder) => (
            <article key={reminder.id} className="record-row">
              <div>
                <strong>{reminder.studentName}</strong>
                <p>
                  {reminder.channel} · {reminder.message}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{reminder.status}</span>
                <span className="module-chip">{reminder.createdBy}</span>
              </div>
            </article>
          ))}
          {isParentWorkspace && visibleReminders.length === 0 ? (
            <article className="record-row">
              <div>
                <strong>No family reminders queued.</strong>
                <p>When the school follows up on balances or notices, those messages will appear here.</p>
              </div>
              <span className="module-chip">clear</span>
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}
