import { isSupabaseConfigured, supabase } from "./supabase";

export type LearnerFeeStatementRow = {
  entryType: "charge" | "payment" | "adjustment";
  entryId: string;
  label: string;
  occurredOn: string;
  dueOn: string;
  amount: number;
  status: string;
  receiptNumber: string;
  note: string;
};

export async function loadLearnerFeeStatement(studentId: string): Promise<LearnerFeeStatementRow[]> {
  if (!studentId || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("dreem_get_learner_fee_statement", {
    p_student_id: studentId,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    entryType: String(row.entry_type) as LearnerFeeStatementRow["entryType"],
    entryId: String(row.entry_id),
    label: String(row.label ?? "School fee entry"),
    occurredOn: String(row.occurred_on ?? ""),
    dueOn: String(row.due_on ?? ""),
    amount: Number(row.amount ?? 0),
    status: String(row.status ?? ""),
    receiptNumber: String(row.receipt_number ?? ""),
    note: String(row.note ?? ""),
  }));
}
