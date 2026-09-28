import type { CommunitySignal, FinanceSummary, LearnerSummary, PaymentCommand, PaymentMethod, PulseAction, Role, StudentCaseSummary } from "./types";

export function routeSignal(category: string): Role {
  if (category === "Finance") return "accountant";
  if (category === "Safeguarding") return "principal";
  if (category === "Teaching" || category === "Learning support") return "academic_head";
  return "administrator";
}

export function cashVariance(collected: number, reconciled: number): number {
  if (!Number.isFinite(collected) || !Number.isFinite(reconciled)) throw new Error("Amounts must be finite numbers.");
  return Math.round((collected - reconciled) * 100) / 100;
}

export function canApproveClosure(submittedBy: string, reviewedBy: string, roles: Role[]): boolean {
  return submittedBy !== reviewedBy && roles.some((role) => role === "accountant" || role === "principal" || role === "school_owner");
}

export function requirePositiveAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive number.");
  return Math.round(amount * 100) / 100;
}

export function paymentMethodForRail(rail: PaymentCommand["railCode"]): PaymentMethod {
  if (["wave","mtn_momo","orange_money","other"].includes(rail)) return "momo";
  if (rail === "bank") return "bank_transfer";
  if (rail === "card") return "card";
  if (rail === "cheque") return "cheque";
  return "cash";
}

export function createIdempotencyKey(scope: string): string {
  return `${scope}:${crypto.randomUUID()}`;
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function derivePrefix(value: string, fallback: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned.slice(0, 4) || fallback).toUpperCase();
}

export function buildOperationalPulse(
  learners: LearnerSummary[],
  finance: FinanceSummary,
  signals: CommunitySignal[],
  cases: StudentCaseSummary[] = [],
): PulseAction[] {
  const actions: PulseAction[] = [];
  const criticalCases=cases.filter((item)=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority));
  if(criticalCases.length>0) actions.push({
    id:"critical-care-cases",category:"care",title:`${criticalCases.length} urgent learner care case${criticalCases.length===1?"":"s"}`,
    explanation:"A serious learner concern needs leadership attention now.",owner:"Principal",dueLabel:"Immediate review",severity:"critical",evidenceCount:criticalCases.length,
  });
  if (finance.openExceptions > 0) actions.push({
    id:"finance-exceptions", category:"finance",
    title:`${finance.openExceptions} payment difference to check${finance.openExceptions === 1 ? "" : "s"}`,
    explanation:`${finance.openExceptionValue.toLocaleString("fr-FR")} FCFA needs an accountant to check it.`,
    owner:"Accountant", dueLabel:"Review required", severity:"critical", evidenceCount:finance.openExceptions,
  });
  const atRisk = learners.filter((learner)=>learner.mastery < 60 || learner.attendance < 80);
  if (atRisk.length > 0) actions.push({
    id:"learner-risk", category:"learning",
    title:`${atRisk.length} learner${atRisk.length === 1 ? "" : "s"} need support review`,
    explanation:"Recent learning or attendance records show these learners may need support.",
    owner:"Academic Head", dueLabel:"Assign intervention", severity:"warning", evidenceCount:atRisk.length,
  });
  const openSignals = signals.filter((signal)=>!['resolved','closed'].includes(signal.status));
  if (openSignals.length > 0) actions.push({
    id:"community-signals", category:"feedback",
    title:`${openSignals.length} message or concern${openSignals.length === 1 ? "" : "s"} awaiting action`,
    explanation:"A parent, learner or staff message still needs someone to follow up.",
    owner:"Administrator", dueLabel:"Follow up", severity:"info", evidenceCount:openSignals.length,
  });
  if (actions.length === 0) actions.push({
    id:"operating-clear", category:"operations", title:"Nothing urgent detected",
    explanation:"DREEM has not found an urgent money, learner-support or school-message issue in the current records.",
    owner:"Leadership", dueLabel:"No action needed", severity:"positive", evidenceCount:learners.length + signals.length,
  });
  return actions;
}


export interface SchoolTodayInsight {
  id:string;
  title:string;
  explanation:string;
  owner:string;
  action:string;
  severity:"critical"|"warning"|"info"|"positive";
  evidenceCount:number;
}

export function buildSchoolTodayInsights(
  learners:LearnerSummary[],
  finance:FinanceSummary,
  signals:CommunitySignal[],
  cases:StudentCaseSummary[]=[],
):SchoolTodayInsight[]{
  const insights:SchoolTodayInsight[]=[];
  const urgentCare=cases.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority));
  if(urgentCare.length)insights.push({id:"care-now",title:urgentCare.length+" serious learner concern"+(urgentCare.length===1?"":"s"),explanation:"These cases need leadership attention now.",owner:"Principal",action:"Open learner care",severity:"critical",evidenceCount:urgentCare.length});
  const attendance=learners.filter(item=>item.attendance<80);
  const learning=learners.filter(item=>item.mastery<60);
  const combined=learners.filter(item=>item.attendance<80&&item.mastery<60);
  if(combined.length)insights.push({id:"attendance-learning",title:combined.length+" learner"+(combined.length===1?"":"s")+" need a closer look",explanation:"Both attendance and learning results are low for the same learners.",owner:"Academic team",action:"Review learners",severity:"warning",evidenceCount:combined.length});
  else if(attendance.length)insights.push({id:"attendance",title:attendance.length+" learner"+(attendance.length===1?"":"s")+" have low attendance",explanation:"Recent attendance is below the school attention level.",owner:"Student affairs",action:"Check attendance",severity:"warning",evidenceCount:attendance.length});
  else if(learning.length)insights.push({id:"learning",title:learning.length+" learner"+(learning.length===1?"":"s")+" may need learning support",explanation:"Recent learning results are below the school attention level.",owner:"Academic team",action:"Review learning",severity:"warning",evidenceCount:learning.length});
  if(finance.openExceptions>0)insights.push({id:"money-check",title:finance.openExceptions+" payment difference"+(finance.openExceptions===1?"":"s")+" to check",explanation:finance.openExceptionValue.toLocaleString("fr-FR")+" FCFA needs an accountant to verify.",owner:"Accountant",action:"Check payments",severity:"critical",evidenceCount:finance.openExceptions});
  if(finance.cashAwaitingDeposit>0)insights.push({id:"money-confirm",title:finance.cashAwaitingDeposit.toLocaleString("fr-FR")+" FCFA not yet confirmed by the school",explanation:"This money has been collected but the final school confirmation is still pending.",owner:"Finance",action:"Confirm money received",severity:"warning",evidenceCount:1});
  const urgentMessages=signals.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","safeguarding"].includes(item.severity));
  if(urgentMessages.length)insights.push({id:"urgent-messages",title:urgentMessages.length+" urgent school message"+(urgentMessages.length===1?"":"s"),explanation:"A parent, learner or staff message needs prompt follow-up.",owner:"School office",action:"Open messages",severity:"critical",evidenceCount:urgentMessages.length});
  if(!insights.length)insights.push({id:"all-clear",title:"Nothing urgent needs attention",explanation:"Current school records do not show an urgent learner, money or communication issue.",owner:"Leadership",action:"Continue school day",severity:"positive",evidenceCount:learners.length});
  return insights;
}
