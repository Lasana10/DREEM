import { resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

export type FinanceControlSnapshot={receivables:number;grossCollections:number;confirmedDeposits:number;pendingReconciliations:number;pendingRefunds:number;pendingDeposits:number};
export type RefundRequestRow={id:string;paymentId:string;studentId:string;amount:number;reason:string;status:string;requestedAt:string;reviewNote?:string};
export type RefundablePayment={id:string;studentId:string;receiptNumber:string;amount:number;method:string;receivedAt:string;payerName:string};
export type JournalEntry={id:string;entryNumber:number;entryType:string;referenceType:string;amount:number;debitAccount:string;creditAccount:string;description:string;postedAt:string};

export async function loadInstitutionFinance(){
  if(!isSupabaseConfigured||!supabase)return {snapshot:null as FinanceControlSnapshot|null,refunds:[] as RefundRequestRow[],payments:[] as RefundablePayment[],journal:[] as JournalEntry[]};
  const context=await resolveActiveSchoolContext();
  const [control,refunds,payments,journal]=await Promise.all([
    supabase.from("dreem_finance_control_read_model").select("*").eq("school_id",context.schoolId).maybeSingle(),
    supabase.from("dreem_refund_requests").select("id,payment_id,student_id,amount,reason,status,requested_at,review_note").eq("school_id",context.schoolId).order("requested_at",{ascending:false}).limit(50),
    supabase.from("dreem_financial_payments").select("id,student_id,receipt_number,amount,method,received_at,payer_name,reverses_payment_id").eq("school_id",context.schoolId).is("reverses_payment_id",null).order("received_at",{ascending:false}).limit(100),
    supabase.from("dreem_finance_journal_entries").select("id,entry_number,entry_type,reference_type,amount,debit_account,credit_account,description,posted_at").eq("school_id",context.schoolId).order("posted_at",{ascending:false}).limit(100),
  ]);
  for(const result of [control,refunds,payments,journal])if(result.error)throw result.error;
  const c=control.data;
  return {
    snapshot:c?{receivables:Number(c.receivables),grossCollections:Number(c.gross_collections),confirmedDeposits:Number(c.confirmed_deposits),pendingReconciliations:Number(c.pending_reconciliations),pendingRefunds:Number(c.pending_refunds),pendingDeposits:Number(c.pending_deposits)}:null,
    refunds:(refunds.data??[]).map(row=>({id:String(row.id),paymentId:String(row.payment_id),studentId:String(row.student_id),amount:Number(row.amount),reason:String(row.reason),status:String(row.status),requestedAt:String(row.requested_at),reviewNote:row.review_note?String(row.review_note):undefined})),
    payments:(payments.data??[]).map(row=>({id:String(row.id),studentId:String(row.student_id),receiptNumber:String(row.receipt_number),amount:Number(row.amount),method:String(row.method),receivedAt:String(row.received_at),payerName:String(row.payer_name)})),
    journal:(journal.data??[]).map(row=>({id:String(row.id),entryNumber:Number(row.entry_number),entryType:String(row.entry_type),referenceType:String(row.reference_type),amount:Number(row.amount),debitAccount:String(row.debit_account),creditAccount:String(row.credit_account),description:String(row.description),postedAt:String(row.posted_at)})),
  };
}

export async function requestRefund(input:{paymentId:string;amount:number;reason:string;idempotencyKey:string}){
  if(!isSupabaseConfigured||!supabase)return crypto.randomUUID();
  const {data,error}=await supabase.rpc("dreem_request_refund",{p_payment_id:input.paymentId,p_amount:input.amount,p_reason:input.reason,p_idempotency_key:input.idempotencyKey});
  if(error)throw error;return String(data);
}
export async function reviewRefund(input:{refundId:string;decision:"approve"|"reject";note:string}){
  if(!isSupabaseConfigured||!supabase)return input.decision==="approve"?"approved":"rejected";
  const {data,error}=await supabase.rpc("dreem_review_refund",{p_refund_id:input.refundId,p_decision:input.decision,p_note:input.note});
  if(error)throw error;return String(data);
}
export async function postJournalEntry(input:{entryType:"charge"|"payment"|"allocation"|"waiver"|"refund"|"reversal"|"deposit"|"reconciliation"|"adjustment";referenceType:string;referenceId?:string;studentId?:string;debitAccount:string;creditAccount:string;amount:number;description:string;idempotencyKey:string;reversesEntryId?:string}){
  if(!isSupabaseConfigured||!supabase)return crypto.randomUUID();
  const context=await resolveActiveSchoolContext();
  const {data,error}=await supabase.rpc("dreem_post_finance_journal",{p_school_id:context.schoolId,p_entry_type:input.entryType,p_reference_type:input.referenceType,p_reference_id:input.referenceId||null,p_student_id:input.studentId||null,p_debit_account:input.debitAccount,p_credit_account:input.creditAccount,p_amount:input.amount,p_description:input.description,p_idempotency_key:input.idempotencyKey,p_reverses_entry_id:input.reversesEntryId||null});
  if(error)throw error;return String(data);
}
