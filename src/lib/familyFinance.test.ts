import { beforeEach, expect, it, vi } from "vitest";
import { loadLearnerFeeStatement } from "./familyFinance";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ isSupabaseConfigured: true, supabase: { rpc } }));
beforeEach(() => rpc.mockReset());

it("maps the SQL statement contract into visible charges, receipts and adjustment reasons", async () => {
  rpc.mockResolvedValue({ error: null, data: [
    { row_kind: "charge", row_id: "c1", label: "Tuition", amount: "50000", status: "due" },
    { row_kind: "payment", row_id: "p1", amount: "-20000", reference: "REC-001", status: "received" },
    { row_kind: "adjustment", row_id: "a1", amount: "-5000", reference: "Sibling concession", status: "approved" },
  ] });
  const rows = await loadLearnerFeeStatement("learner-1");
  expect(rpc).toHaveBeenCalledWith("dreem_get_learner_fee_statement", { p_student_id: "learner-1" });
  expect(rows[0]).toMatchObject({ entryType: "charge", entryId: "c1", amount: 50000 });
  expect(rows[1]).toMatchObject({ entryType: "payment", entryId: "p1", receiptNumber: "REC-001", note: "" });
  expect(rows[2]).toMatchObject({ entryType: "adjustment", entryId: "a1", note: "Sibling concession", receiptNumber: "" });
});

it("propagates access failures instead of showing an empty successful statement", async () => {
  const error = { message: "Fee statement access is not authorized." };
  rpc.mockResolvedValue({ data: null, error });
  await expect(loadLearnerFeeStatement("unlinked-learner")).rejects.toEqual(error);
});
