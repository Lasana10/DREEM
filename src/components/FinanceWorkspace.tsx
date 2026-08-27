import type { FinanceSummary, LearnerSummary, Role } from "../domain/types";
import FinanceControlDesk from "./FinanceControlDesk";
import { FinanceView, Metric } from "./Views";

const money=(value:number)=>new Intl.NumberFormat("fr-FR").format(value)+" FCFA";

export default function FinanceWorkspace({finance,learners,role,onRecorded}:{finance:FinanceSummary;learners:LearnerSummary[];role:Role;onRecorded:()=>Promise<void>}){
  if(role==="bursar")return <><FinanceView finance={finance} learners={learners} onRecorded={onRecorded}/><div className="content"><FinanceControlDesk role={role} onChanged={onRecorded}/></div></>;
  const reviewer=["platform_founder","school_owner","principal","accountant"].includes(role);
  return <div className="content"><section className="page-intro"><div><span>DREEM TRUSTLEDGER</span><h2>{reviewer?"Independent financial control":"Read-only financial assurance"}</h2><p>{reviewer?"Review evidence and confirm institutional settlement without collecting or approving your own money.":"Inspect the verified money trail without changing operational records."}</p></div></section><div className="metrics"><Metric label="Open fee balance" value={money(finance.expectedToday)} detail="Across learner accounts" tone="blue"/><Metric label="Cash awaiting deposit" value={money(finance.cashAwaitingDeposit)} detail={`${money(finance.cashCollected)} collected`} tone="amber"/><Metric label="Digital confirmed" value={money(finance.digitalConfirmed)} detail="Provider references captured"/><Metric label="Open exceptions" value={String(finance.openExceptions)} detail={money(finance.openExceptionValue)} tone={finance.openExceptions?"red":"green"}/></div><FinanceControlDesk role={role} onChanged={onRecorded}/></div>;
}
