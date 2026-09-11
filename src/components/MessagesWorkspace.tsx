import { AlertTriangle, BellRing, CheckCircle2, MessageSquareMore, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CommunitySignal, Role } from "../domain/types";
import { loadAnnouncements, publishAnnouncement, type AnnouncementAudience, type AnnouncementPriority, type SchoolAnnouncement } from "../lib/announcements";

const canPublish=(role:Role)=>["platform_founder","school_owner","principal","administrator","academic_head"].includes(role);
const friendlyStatus=(value:string)=>value.replaceAll("_"," ");

export default function MessagesWorkspace({role,signals,onFeedback,onStatus}:{role:Role;signals:CommunitySignal[];onFeedback:()=>void;onStatus:(id:string,status:CommunitySignal["status"])=>Promise<void>}){
  const [announcements,setAnnouncements]=useState<SchoolAnnouncement[]>([]);
  const [announcementState,setAnnouncementState]=useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const publisher=canPublish(role);
  const openSignals=useMemo(()=>signals.filter(item=>item.status!=="closed"&&item.status!=="resolved"),[signals]);

  async function refreshAnnouncements(){
    try{const rows=await loadAnnouncements();setAnnouncements(rows);setAnnouncementState("ready");setError("");}
    catch(reason){setAnnouncementState("error");setError(reason instanceof Error?reason.message:"School notices could not be loaded.");}
  }
  useEffect(()=>{void refreshAnnouncements();},[]);

  async function publish(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget,data=new FormData(form);
    setBusy(true);setError("");setMessage("");
    try{
      await publishAnnouncement({
        title:String(data.get("title")||""),
        body:String(data.get("body")||""),
        audience:String(data.get("audience")||"all") as AnnouncementAudience,
        priority:String(data.get("priority")||"normal") as AnnouncementPriority,
        expiresAt:String(data.get("expiresAt")||"")||undefined,
      });
      form.reset();
      await refreshAnnouncements();
      setMessage("Notice published to the selected DREEM audience.");
    }catch(reason){setError(reason instanceof Error?reason.message:"The notice could not be published.");}
    finally{setBusy(false);}
  }

  async function moveSignal(id:string,status:CommunitySignal["status"]){
    setBusy(true);setError("");setMessage("");
    try{await onStatus(id,status);setMessage("Follow-up status updated.");}
    catch(reason){setError(reason instanceof Error?reason.message:"The follow-up status could not be updated.");}
    finally{setBusy(false);}
  }

  return <div className="content communications-workspace role-workspace">
    <section className="page-intro"><div><span>DREEM COMMUNICATIONS</span><h2>Official notices and feedback that lead to action.</h2><p>Announcements are school-owned records with audience boundaries. Feedback remains a tracked signal with an owner and status rather than disappearing into a chat thread.</p></div><button className="primary" onClick={onFeedback}><MessageSquareMore/>Give feedback</button></section>
    {error&&<div className="form-status error"><AlertTriangle/>{error}</div>}{message&&<div className="form-status success"><CheckCircle2/>{message}</div>}

    <div className="communications-grid">
      <section className="panel notices-panel"><div className="panel-title"><BellRing/><div><span>OFFICIAL SCHOOL NOTICES</span><h3>Published announcements</h3></div></div>
        {announcementState==="loading"?<p>Loading notices…</p>:null}
        {announcementState==="ready"&&!announcements.length?<p>No active notice has been published for your audience.</p>:null}
        {announcements.map(item=><article className={`notice-row priority-${item.priority}`} key={item.id}><header><strong>{item.title}</strong><span>{item.priority}</span></header><p>{item.body}</p><footer><span>{item.audience==="all"?"Whole school":friendlyStatus(item.audience)}</span><span>{new Date(item.publishedAt).toLocaleString()}</span>{item.expiresAt?<span>Expires {new Date(item.expiresAt).toLocaleString()}</span>:null}</footer></article>)}
      </section>

      {publisher?<section className="panel publish-notice"><div className="panel-title"><Send/><div><span>PUBLISH NOTICE</span><h3>Choose exactly who should receive it</h3></div></div><form className="settings-form" onSubmit={publish}><label>Title<input name="title" minLength={3} maxLength={160} required placeholder="e.g. Parent meeting on Friday"/></label><label>Message<textarea name="body" rows={5} minLength={3} maxLength={4000} required placeholder="State what people need to know or do."/></label><div className="form-grid"><label>Audience<select name="audience" defaultValue="all"><option value="all">Whole school</option><option value="staff">Staff only</option><option value="families">Families only</option><option value="students">Students only</option></select></label><label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label>Expires (optional)<input name="expiresAt" type="datetime-local"/></label></div><button className="primary" disabled={busy}><Send/>{busy?"Publishing…":"Publish notice"}</button></form></section>:null}
    </div>

    <section className="panel"><div className="panel-title"><ShieldCheck/><div><span>FEEDBACK → FOLLOW-UP</span><h3>{openSignals.length} item{openSignals.length===1?"":"s"} still need action</h3><p>Feedback is separate from official announcements. It moves through a follow-up status until resolved.</p></div></div>
      {!signals.length?<p>No feedback or operational signal is visible to this role.</p>:signals.map(item=><article className="signal" key={item.id}><span className={`signal-dot ${item.severity}`}/><div><header><strong>{item.category}</strong> · <em>{item.severity}</em> <span>{item.sourceName}</span></header><p>{item.message}</p><footer><span>{item.subjectName}</span><span>Status: {friendlyStatus(item.status)}</span></footer></div>{publisher?<aside><select aria-label={`Status for ${item.category}`} value={item.status} disabled={busy} onChange={event=>void moveSignal(item.id,event.target.value as CommunitySignal["status"])}><option value="new">New</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></aside>:null}</article>)}
    </section>
  </div>;
}
