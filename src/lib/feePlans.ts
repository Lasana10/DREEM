import { createIdempotencyKey } from "../domain/rules";
import { isDemoMode, isSupabaseConfigured, supabase } from "./supabase";

export interface FeePlanItem {
  id?: string;
  code: string;
  label: string;
  amount: number;
  dueOn?: string;
  required: boolean;
}

export interface FeePlanSummary {
  id: string;
  academicYearId?: string;
  classId: string;
  name: string;
  currency: string;
  status: "draft" | "active" | "archived";
  activatedAt?: string;
  items: FeePlanItem[];
  totalAmount: number;
}

export async function loadFeePlans(classIds: string[]): Promise<FeePlanSummary[]> {
  if (!classIds.length) return [];
  if (!isSupabaseConfigured || !supabase) {
    if (isDemoMode) return [];
    throw new Error("DREEM finance is not connected to Supabase.");
  }
  const { data, error } = await supabase
    .from("dreem_fee_plans")
    .select("id,academic_year_id,class_id,name,currency,status,activated_at,dreem_fee_plan_items(id,code,label,amount,due_on,required)")
    .in("class_id", classIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const items = ((row.dreem_fee_plan_items ?? []) as Record<string, unknown>[]).map((item) => ({
      id: String(item.id),
      code: String(item.code),
      label: String(item.label),
      amount: Number(item.amount),
      dueOn: item.due_on ? String(item.due_on) : undefined,
      required: Boolean(item.required),
    }));
    return {
      id: String(row.id),
      academicYearId: row.academic_year_id ? String(row.academic_year_id) : undefined,
      classId: String(row.class_id),
      name: String(row.name),
      currency: String(row.currency),
      status: row.status as FeePlanSummary["status"],
      activatedAt: row.activated_at ? String(row.activated_at) : undefined,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      items,
    };
  });
}

export async function createFeePlan(input: {
  academicYearId?: string;
  classId: string;
  name: string;
  currency?: string;
  items: FeePlanItem[];
}) {
  if (!input.classId) throw new Error("Choose a class for this fee plan.");
  if (input.name.trim().length < 3) throw new Error("Enter a clear fee plan name.");
  const items = input.items
    .map((item) => ({ ...item, code: item.code.trim().toUpperCase(), label: item.label.trim() }))
    .filter((item) => item.code && item.label && Number.isFinite(item.amount) && item.amount > 0);
  if (!items.length) throw new Error("Add at least one fee item with a positive amount.");
  if (new Set(items.map((item) => item.code)).size !== items.length) throw new Error("Fee item codes must be unique inside a plan.");
  if (!isSupabaseConfigured || !supabase) {
    if (isDemoMode) return { planId: crypto.randomUUID(), status: "draft", totalAmount: items.reduce((sum, item) => sum + item.amount, 0) };
    throw new Error("DREEM finance is not connected to Supabase.");
  }
  const { data, error } = await supabase.rpc("dreem_create_fee_plan", {
    p_academic_year_id: input.academicYearId || null,
    p_class_id: input.classId,
    p_name: input.name.trim(),
    p_currency: input.currency?.trim() || "XAF",
    p_items: items.map((item) => ({ code: item.code, label: item.label, amount: item.amount, due_on: item.dueOn || null, required: item.required })),
    p_idempotency_key: createIdempotencyKey("fee-plan"),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { planId: String(row.plan_id), status: String(row.plan_status), totalAmount: Number(row.total_amount) };
}

export async function activateFeePlan(planId: string) {
  if (!planId) throw new Error("Choose a draft fee plan to activate.");
  if (!isSupabaseConfigured || !supabase) {
    if (isDemoMode) return { planId, status: "active", learnersCharged: 0, totalCharged: 0 };
    throw new Error("DREEM finance is not connected to Supabase.");
  }
  const { data, error } = await supabase.rpc("dreem_activate_fee_plan", {
    p_plan_id: planId,
    p_idempotency_key: createIdempotencyKey("fee-plan-activate"),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    planId: String(row.plan_id),
    status: String(row.plan_status),
    learnersCharged: Number(row.learners_charged),
    totalCharged: Number(row.total_charged),
  };
}
