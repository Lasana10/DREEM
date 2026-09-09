import { BadgeCheck, CircleDollarSign, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Role, SchoolSetup } from "../domain/types";
import { activateFeePlan, createFeePlan, loadFeePlans, type FeePlanItem, type FeePlanSummary } from "../lib/feePlans";

const money = (value: number) => new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
const blankItem = (): FeePlanItem => ({ code: "", label: "", amount: 0, required: true });

function errorText(reason: unknown) {
  return reason instanceof Error ? reason.message : "The fee-plan action could not be completed.";
}

export default function FeePlanStudio({ setup, role, onChanged }: { setup: SchoolSetup; role: Role; onChanged: () => Promise<void> }) {
  const canManage = ["platform_founder", "school_owner", "principal"].includes(role);
  const [plans, setPlans] = useState<FeePlanSummary[]>([]);
  const [items, setItems] = useState<FeePlanItem[]>([blankItem(), blankItem()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const classIds = useMemo(() => setup.classes.map((item) => item.id), [setup.classes]);
  const refresh = useCallback(async () => {
    setPlans(await loadFeePlans(classIds));
  }, [classIds]);

  useEffect(() => { void refresh().catch((reason) => setError(errorText(reason))); }, [refresh]);

  function updateItem(index: number, patch: Partial<FeePlanItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await createFeePlan({
        academicYearId: String(data.get("academicYearId") || "") || undefined,
        classId: String(data.get("classId")),
        name: String(data.get("name")),
        currency: "XAF",
        items,
      });
      form.reset();
      setItems([blankItem(), blankItem()]);
      await refresh();
      setMessage(`Draft fee plan created for ${money(result.totalAmount)}. Review it, then activate it to charge the class.`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  async function activate(plan: FeePlanSummary) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await activateFeePlan(plan.id);
      await Promise.all([refresh(), onChanged()]);
      setMessage(`${plan.name} activated. ${result.learnersCharged} existing learner account(s) received ${money(result.totalCharged)} in verified charges; future enrolled learners in the class will inherit the active plan automatically.`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  const className = (id: string) => setup.classes.find((item) => item.id === id)?.name ?? "Class";
  const yearName = (id?: string) => setup.academicYears.find((item) => item.id === id)?.name ?? "No year selected";

  return <section className="panel">
    <div className="panel-title"><CircleDollarSign /><div><span>FEE STRUCTURE STUDIO</span><h3>Class plans that generate real learner charges</h3></div></div>
    <div className="care-assurance"><ShieldCheck /><span><strong>Leadership-controlled activation</strong><small>Bursars collect against the resulting accounts; they cannot silently rewrite the fee structure.</small></span></div>
    {error ? <div className="form-status error" role="alert">{error}</div> : null}
    {message ? <div className="form-status success" role="status"><BadgeCheck />{message}</div> : null}

    {canManage ? <form className="settings-form" onSubmit={create}>
      <div className="form-grid">
        <label>Academic year<select name="academicYearId"><option value="">Choose academic year</option>{setup.academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
        <label>Class<select name="classId" required><option value="">Choose class</option>{setup.classes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.sectionName ? ` · ${entry.sectionName}` : ""}</option>)}</select></label>
        <label>Plan name<input name="name" placeholder="2026/27 Form 1 tuition & services" required minLength={3} /></label>
      </div>
      <div className="document-row"><strong>Fee items</strong><small>Each code becomes a distinct auditable charge. Use due dates when the school wants debtor ageing by instalment.</small></div>
      {items.map((item, index) => <div className="form-grid" key={index}>
        <label>Code<input aria-label={`Fee code ${index + 1}`} value={item.code} onChange={(event) => updateItem(index, { code: event.target.value })} placeholder="TUITION" /></label>
        <label>Label<input aria-label={`Fee label ${index + 1}`} value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} placeholder="Tuition" /></label>
        <label>Amount (FCFA)<input aria-label={`Fee amount ${index + 1}`} type="number" min="0" step="1" value={item.amount || ""} onChange={(event) => updateItem(index, { amount: Number(event.target.value) })} /></label>
        <label>Due date<input aria-label={`Fee due date ${index + 1}`} type="date" value={item.dueOn ?? ""} onChange={(event) => updateItem(index, { dueOn: event.target.value || undefined })} /></label>
        <label><input type="checkbox" checked={item.required} onChange={(event) => updateItem(index, { required: event.target.checked })} /> Required charge</label>
        {items.length > 1 ? <button type="button" aria-label={`Remove fee item ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /> Remove</button> : null}
      </div>)}
      <div className="mobile-submit-bar"><button type="button" onClick={() => setItems((current) => [...current, blankItem()])}><Plus size={16} /> Add fee item</button><button className="primary" disabled={busy || !setup.classes.length}>{busy ? "Saving…" : "Create draft fee plan"}</button></div>
    </form> : <p>Fee structures are visible here for assurance. Only founder, school owner or principal can create or activate them.</p>}

    <div className="academic-grid">
      {plans.map((plan) => <article className="document-row" key={plan.id}>
        <strong>{plan.name}</strong>
        <span>{className(plan.classId)} · {yearName(plan.academicYearId)} · {money(plan.totalAmount)} · {plan.status}</span>
        <small>{plan.items.map((item) => `${item.label}: ${money(item.amount)}`).join(" · ")}</small>
        {canManage && plan.status === "draft" ? <button disabled={busy} onClick={() => void activate(plan)}>Activate and charge class</button> : null}
      </article>)}
      {!plans.length ? <p>No class fee plan has been created yet.</p> : null}
    </div>
  </section>;
}
