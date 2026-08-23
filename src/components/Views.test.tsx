// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinanceSummary, LearnerSummary } from "../domain/types";
import { FinanceView } from "./Views";

const createPaymentIntent = vi.fn();
const openCashierSession = vi.fn();
const recordPayment = vi.fn();

vi.mock("../lib/repository", () => ({
  createPaymentIntent: (...args: unknown[]) => createPaymentIntent(...args),
  openCashierSession: (...args: unknown[]) => openCashierSession(...args),
  recordPayment: (...args: unknown[]) => recordPayment(...args),
}));

const finance: FinanceSummary = {
  expectedToday: 100_000,
  collectedToday: 25_000,
  reconciledToday: 25_000,
  openExceptions: 0,
  openExceptionValue: 0,
  nextDeposit: 0,
  cashCollected: 25_000,
  cashAwaitingDeposit: 0,
  digitalConfirmed: 0,
  parentConfirmationsPending: 1,
};

const learner: LearnerSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  matricule: "DRM-001",
  name: "Test Learner",
  className: "Form 1",
  mastery: 0,
  attendance: 0,
  engagement: 0,
  wellbeing: 0,
  trend: 0,
  nextAction: "Begin evidence",
  idStatus: "active",
  feeAccountId: "22222222-2222-4222-8222-222222222222",
  feeBalance: 100_000,
};

describe("Verified Money Trail UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPaymentIntent.mockResolvedValue({ intentId:"intent-1", paymentReference:"DRM-PAY-ABC123" });
    openCashierSession.mockResolvedValue({ id:"session-1", status:"open" });
    recordPayment.mockResolvedValue({ paymentId:"payment-1", receiptNumber:"DRM-20260823-001", confirmationToken:"token-1" });
  });

  it("creates a learner payment reference before recording cash", async () => {
    const onRecorded = vi.fn().mockResolvedValue(undefined);
    render(<FinanceView finance={finance} learners={[learner]} onRecorded={onRecorded} />);

    fireEvent.click(screen.getByRole("button", { name:/collect payment/i }));
    expect(screen.getByRole("option", { name:/Test Learner/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Student UUID/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Payer name"), { target:{ value:"Test Parent" } });
    fireEvent.change(screen.getByLabelText("Payer phone"), { target:{ value:"+237600000000" } });
    fireEvent.change(screen.getByLabelText("Amount (FCFA)"), { target:{ value:"25000" } });
    fireEvent.click(screen.getByRole("button", { name:/create payment reference/i }));

    await waitFor(() => expect(createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      studentId:learner.id,
      feeAccountId:learner.feeAccountId,
      amountExpected:25_000,
      allowedRails:["cash"],
    })));
    expect(await screen.findByText("DRM-PAY-ABC123")).toBeInTheDocument();
    await waitFor(() => expect(openCashierSession).toHaveBeenCalledWith(0));

    fireEvent.change(screen.getByLabelText("Amount received (FCFA)"), { target:{ value:"25000" } });
    fireEvent.click(screen.getByRole("button", { name:/record protected payment/i }));

    await waitFor(() => expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentIntentId:"intent-1",
      cashierSessionId:"session-1",
      method:"cash",
      railCode:"cash",
      amount:25_000,
    })));
    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
  });
});
