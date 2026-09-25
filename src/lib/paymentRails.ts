import { resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

export type PaymentRailConfig={
  id:string;
  code:"cash"|"wave"|"mtn_momo"|"orange_money"|"bank"|"card"|"cheque"|"other";
  name:string;
  type:string;
  merchantReference:string;
  enabled:boolean;
  priority:number;
};

export async function loadPaymentRails():Promise<PaymentRailConfig[]>{
  if(!isSupabaseConfigured||!supabase)return[];
  const{schoolId}=await resolveActiveSchoolContext();
  const{data,error}=await supabase.from("dreem_payment_rails")
    .select("id,rail_code,display_name,rail_type,merchant_reference,enabled,priority")
    .eq("school_id",schoolId).order("priority").order("display_name");
  if(error)throw error;
  return(data??[]).map(row=>({
    id:String(row.id),code:String(row.rail_code) as PaymentRailConfig["code"],name:String(row.display_name),
    type:String(row.rail_type),merchantReference:row.merchant_reference?String(row.merchant_reference):"",
    enabled:Boolean(row.enabled),priority:Number(row.priority??100)
  }));
}

export async function savePaymentRail(input:Omit<PaymentRailConfig,"id"|"type">){
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM payment configuration is unavailable.");
  const{schoolId}=await resolveActiveSchoolContext();
  const{data,error}=await supabase.rpc("dreem_configure_payment_rail",{
    p_school_id:schoolId,p_rail_code:input.code,p_display_name:input.name,
    p_merchant_reference:input.merchantReference||null,p_enabled:input.enabled,p_priority:input.priority
  });
  if(error)throw error;
  return String(data);
}
