import { resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

export type NotificationChannel="email"|"sms"|"whatsapp"|"push";
export type NotificationEndpoint={id:string;channel:NotificationChannel;endpoint:string;enabled:boolean;verified:boolean};
export type DeliverySummary={announcementId:string;channel:string;status:string;deliveries:number;lastUpdatedAt:string};
export type MyNotificationDelivery={id:string;announcementId:string;channel:string;status:string;title:string;body:string;priority:string;category:string;queuedAt:string;sentAt?:string;deliveredAt?:string;acknowledgedAt?:string};

export async function loadMyNotificationEndpoints():Promise<NotificationEndpoint[]>{
 if(!isSupabaseConfigured||!supabase)return[];const context=await resolveActiveSchoolContext();
 const{data,error}=await supabase.from("dreem_notification_endpoints").select("id,channel,endpoint,enabled,verified").eq("school_id",context.schoolId).eq("user_id",context.userId).order("channel");if(error)throw error;
 return(data??[]).map(row=>({id:String(row.id),channel:row.channel as NotificationChannel,endpoint:String(row.endpoint),enabled:Boolean(row.enabled),verified:Boolean(row.verified)}));
}
export async function enableVerifiedAuthChannel(channel:Exclude<NotificationChannel,"push">){
 if(!isSupabaseConfigured||!supabase)return crypto.randomUUID();const context=await resolveActiveSchoolContext();const{data,error}=await supabase.rpc("dreem_enable_verified_auth_channel",{p_school_id:context.schoolId,p_channel:channel});if(error)throw error;return String(data);
}
export async function disableNotificationChannel(channel:NotificationChannel){
 if(!isSupabaseConfigured||!supabase)return 0;const context=await resolveActiveSchoolContext();const{data,error}=await supabase.rpc("dreem_disable_notification_channel",{p_school_id:context.schoolId,p_channel:channel});if(error)throw error;return Number(data??0);
}
export async function loadDeliverySummary():Promise<DeliverySummary[]>{
 if(!isSupabaseConfigured||!supabase)return[];const context=await resolveActiveSchoolContext();const{data,error}=await supabase.from("dreem_notification_delivery_summary").select("announcement_id,channel,status,deliveries,last_updated_at").eq("school_id",context.schoolId).order("last_updated_at",{ascending:false}).limit(100);if(error)throw error;return(data??[]).map(row=>({announcementId:String(row.announcement_id),channel:String(row.channel),status:String(row.status),deliveries:Number(row.deliveries),lastUpdatedAt:String(row.last_updated_at)}));
}
export async function dispatchQueuedNotifications(){
 if(!isSupabaseConfigured||!supabase)return{processed:0,sent:0,failed:0,waitingForProvider:0};const context=await resolveActiveSchoolContext();const{data,error}=await supabase.functions.invoke("dispatch-notifications",{body:{schoolId:context.schoolId,limit:100}});if(error)throw error;return data as{processed:number;sent:number;failed:number;waitingForProvider:number};
}

export async function loadMyNotificationDeliveries():Promise<MyNotificationDelivery[]>{
 if(!isSupabaseConfigured||!supabase)return[];const context=await resolveActiveSchoolContext();
 const{data,error}=await supabase.from("dreem_my_notification_deliveries").select("*").eq("school_id",context.schoolId).order("queued_at",{ascending:false}).limit(50);
 if(error)throw error;return(data??[]).map(row=>({id:String(row.id),announcementId:String(row.announcement_id),channel:String(row.channel),status:String(row.status),title:String(row.title),body:String(row.body),priority:String(row.priority),category:String(row.category),queuedAt:String(row.queued_at),sentAt:row.sent_at?String(row.sent_at):undefined,deliveredAt:row.delivered_at?String(row.delivered_at):undefined,acknowledgedAt:row.acknowledged_at?String(row.acknowledged_at):undefined}));
}
export async function acknowledgeNotificationDelivery(deliveryId:string){
 if(!deliveryId)throw new Error("Choose a notification delivery.");
 if(!isSupabaseConfigured||!supabase)return"acknowledged";
 const{data,error}=await supabase.rpc("dreem_acknowledge_notification_delivery",{p_delivery_id:deliveryId});
 if(error)throw error;return String(data);
}
