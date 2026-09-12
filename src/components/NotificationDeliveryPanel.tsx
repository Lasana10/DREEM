import { useEffect, useState } from "react";
import { BellRing, Mail, MessageSquareText, Send } from "lucide-react";
import type { Role } from "../domain/types";
import { disableNotificationChannel, dispatchQueuedNotifications, enableVerifiedAuthChannel, loadDeliverySummary, loadMyNotificationEndpoints, type DeliverySummary, type NotificationEndpoint } from "../lib/notificationChannels";

const admins:Role[]=["platform_founder","school_owner","principal","administrator"];
const errorText=(reason:unknown)=>reason instanceof Error?reason.message:"Notification control could not be completed.";
export default function NotificationDeliveryPanel({role}:{role:Role}){
 const [endpoints,setEndpoints]=useState<NotificationEndpoint[]>([]),[summary,setSummary]=useState<DeliverySummary[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const canDispatch=admins.includes(role);
 async function reload(){const [mine,delivery]=await Promise.all([loadMyNotificationEndpoints(),canDispatch?loadDeliverySummary():Promise.resolve([])]);setEndpoints(mine);setSummary(delivery);}
 useEffect(()=>{reload().catch(reason=>setError(errorText(reason)));},[canDispatch]);
 async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setError("");setMessage("");try{await action();await reload();setMessage(success);}catch(reason){setError(errorText(reason));}finally{setBusy(false);}}
 const active=(channel:string)=>endpoints.some(item=>item.channel===channel&&item.enabled&&item.verified);
 return <section className="panel notification-delivery-panel"><div className="panel-title"><BellRing/><div><span>DELIVERY CHANNELS</span><h3>In-app first, verified external channels when enabled</h3><p>DREEM never marks an external message as sent unless the provider accepts it.</p></div></div>{error?<div className="form-status error" role="alert">{error}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}
   <div className="prereq-grid"><article className="ready"><strong>In-app</strong><p>Always available for approved school accounts.</p></article>{(["email","sms","whatsapp"] as const).map(channel=><article className={active(channel)?"ready":"missing"} key={channel}><strong>{channel==="email"?<Mail/>:<MessageSquareText/>}{channel.toUpperCase()}</strong><p>{active(channel)?"Verified account contact enabled.":"Uses your verified DREEM account contact."}</p>{active(channel)?<button disabled={busy} onClick={()=>void run(()=>disableNotificationChannel(channel),`${channel} notifications disabled.`)}>Disable</button>:<button disabled={busy} onClick={()=>void run(()=>enableVerifiedAuthChannel(channel),`${channel} notifications enabled from your verified account contact.`)}>Enable verified {channel}</button>}</article>)}</div>
   {canDispatch?<><div className="card-actions"><button className="primary" disabled={busy} onClick={()=>void run(async()=>{const result=await dispatchQueuedNotifications();return result;},"Queued external notifications processed. Provider failures remain visible for retry.")}><Send/>Dispatch queued external delivery</button></div><div className="compact-table">{summary.slice(0,20).map((item,index)=><div className="document-row" key={`${item.announcementId}-${item.channel}-${item.status}-${index}`}><strong>{item.channel} · {item.status}</strong><span>{item.deliveries} delivery record{item.deliveries===1?"":"s"}</span><small>{new Date(item.lastUpdatedAt).toLocaleString()}</small></div>)}{!summary.length?<p>No external delivery activity yet.</p>:null}</div></>:null}
 </section>;
}
