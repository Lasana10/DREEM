import { Megaphone, MessageSquareMore, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { CommunitySignal, Role } from "../domain/types";
import { loadAnnouncements, publishAnnouncement, type AnnouncementAudience, type AnnouncementPriority, type SchoolAnnouncement } from "../lib/announcements";
import { SignalsView } from "./Views";

const publisherRoles:Role[]=["platform_founder","school_owner","principal","administrator","academic_head"];
function errorText(reason:unknown){return reason instanceof Error?reason.message:reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"?reason.message:"The notice operation could not be completed.";}

export default function CommunicationsWorkspace({role,signals,onFeedback,onStatus}:{role:Role;signals:CommunitySignal[];onFeedback:()=>void;onStatus:(id:string,status:CommunitySignal["status"])=>Promise<void>}){
  const [announcements,setAnnouncements]=useState<SchoolAnnouncement[]|null>(null);
  const [announcementError,setAnnouncementError]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const canPublish=publisherRoles.includes(role);

  async function refresh(){
    try{setAnnouncements(await loadAnnouncements());setAnnouncementError("");}
    catch(reason){setAnnouncements([]);setAnnouncementError(errorText(reason));}
  }
  useEffect(()=>{let active=true;loadAnnouncements().then(items=>{if(active)setAnnouncements(items);}).catch(reason=>{if(active){setAnnouncements([]);setAnnouncementError(errorText(reason));}});return()=>{active=false;};},[]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget,data=new FormData(form),expires=String(data.get("expiresAt")||"");
    setBusy(true);setAnnouncementError("");setMessage("");
    try{
      await publishAnnouncement({
        title:String(data.get("title")||""),body:String(data.get("body")||""),
        audience:String(data.get("audience")||"all") as AnnouncementAudience,
        priority:String(data.get("priority")||"normal") as AnnouncementPriority,
        expiresAt:expires?new Date(`${expires}T23:59:59`).toISOString():undefined,
      });
      form.reset();
      setMessage("Notice published to the selected audience.");
      await refresh();
    }catch(reason){setAnnouncementError(errorText(reason));}
    finally{setBusy(false);}
  }

  return <div className="communications-workspace">
    <div className="content role-workspace">
      <section className="page-intro"><div><span>SCHOOL COMMUNICATIONS</span><h2>Notices people can trust, feedback the school can follow through.</h2><p>Official notices are audience-scoped by school membership. Feedback remains a separate follow-up workflow so announcements are not confused with cases or complaints.</p></div><div className="care-assurance"><ShieldCheck/><span><strong>Audience boundaries enforced</strong><small>Staff, family and student notices are filtered by the database—not by a hidden frontend card.</small></span></div></section>
      {announcementError?<div className="form-status error" role="alert">{announcementError}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}
      <section className="panel"><div className="panel-title"><Megaphone/><div><span>OFFICIAL NOTICES</span><h3>{announcements===null?"Loading school notices…":`${announcements.length} current notice${announcements.length===1?"":"s"}`}</h3></div></div>
        {announcements?.map(item=><article className={`announcement-row priority-${item.priority}`} key={item.id}><header><strong>{item.title}</strong><span>{item.priority}{item.audience!=="all"?` · ${item.audience}`:" · whole school"}</span></header><p>{item.body}</p><footer>Published {new Date(item.publishedAt).toLocaleString()}{item.expiresAt?` · expires ${new Date(item.expiresAt).toLocaleDateString()}`:""}</footer></article>)}
        {announcements!==null&&announcements.length===0?<p>No current school notice is visible to this account.</p>:null}
      </section>
      {canPublish?<section className="panel"><div className="panel-title"><Megaphone/><div><span>PUBLISH NOTICE</span><h3>Choose who needs this information</h3><p>Publish only institutional information. Safeguarding or individual learner matters belong in protected workflows, not announcements.</p></div></div><form className="settings-form" onSubmit={submit}><div className="form-grid"><label>Title<input name="title" required minLength={3} maxLength={160}/></label><label>Audience<select name="audience" defaultValue="all"><option value="all">Whole school</option><option value="staff">Staff only</option><option value="families">Families only</option><option value="students">Students only</option></select></label><label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label>Expires on (optional)<input name="expiresAt" type="date"/></label></div><label>Notice<textarea name="body" rows={5} required minLength={3} maxLength={4000}/></label><button className="primary" disabled={busy} type="submit"><Megaphone/>{busy?"Publishing…":"Publish notice"}</button></form></section>:null}
      <section className="panel communications-divider"><div className="panel-title"><MessageSquareMore/><div><span>FEEDBACK & FOLLOW-UP</span><h3>Community voice stays actionable</h3><p>Feedback has an owner and status; it is not an announcement feed.</p></div></div><button className="primary" onClick={onFeedback}><MessageSquareMore/>Give feedback</button></section>
    </div>
    <SignalsView signals={signals} onFeedback={onFeedback} onStatus={onStatus}/>
  </div>;
}
