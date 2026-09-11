import { Megaphone, MessageSquareMore, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CommunitySignal, Role } from "../domain/types";
import { loadAnnouncementReviewQueue, loadAnnouncements, publishAnnouncement, reviewAnnouncement, type AnnouncementAudience, type AnnouncementCategory, type AnnouncementPriority, type AnnouncementReviewItem, type SchoolAnnouncement } from "../lib/announcements";
import { SignalsView } from "./Views";

const leadership:Role[]=["platform_founder","school_owner","principal"];
const publisherRoles:Role[]=[...leadership,"administrator","academic_head","transport_manager"];
function errorText(reason:unknown){return reason instanceof Error?reason.message:reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"?reason.message:"The notice operation could not be completed.";}

function categoriesFor(role:Role):AnnouncementCategory[]{
  if(leadership.includes(role))return ["general","administrative","academic","event","transport","finance","emergency"];
  if(role==="administrator")return ["general","administrative","event","transport"];
  if(role==="academic_head")return ["general","academic","event"];
  if(role==="transport_manager")return ["transport"];
  return [];
}
function audiencesFor(role:Role):AnnouncementAudience[]{
  if(leadership.includes(role)||role==="administrator"||role==="academic_head")return ["all","staff","families","students"];
  if(role==="transport_manager")return ["staff","families","students"];
  return [];
}

export default function CommunicationsWorkspace({role,signals,onFeedback,onStatus}:{role:Role;signals:CommunitySignal[];onFeedback:()=>void;onStatus:(id:string,status:CommunitySignal["status"])=>Promise<void>}){
  const [announcements,setAnnouncements]=useState<SchoolAnnouncement[]|null>(null);
  const [reviewQueue,setReviewQueue]=useState<AnnouncementReviewItem[]>([]);
  const [announcementError,setAnnouncementError]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const canPublish=publisherRoles.includes(role),canApprove=leadership.includes(role);
  const allowedCategories=useMemo(()=>categoriesFor(role),[role]),allowedAudiences=useMemo(()=>audiencesFor(role),[role]);

  async function refresh(){
    try{
      const notices=await loadAnnouncements();
      setAnnouncements(notices);setAnnouncementError("");
      if(canApprove)setReviewQueue(await loadAnnouncementReviewQueue());
    }catch(reason){setAnnouncements([]);setAnnouncementError(errorText(reason));}
  }
  useEffect(()=>{let active=true;Promise.all([loadAnnouncements(),canApprove?loadAnnouncementReviewQueue():Promise.resolve([])]).then(([items,pending])=>{if(active){setAnnouncements(items);setReviewQueue(pending);}}).catch(reason=>{if(active){setAnnouncements([]);setAnnouncementError(errorText(reason));}});return()=>{active=false;};},[canApprove]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget,data=new FormData(form),expires=String(data.get("expiresAt")||"");
    setBusy(true);setAnnouncementError("");setMessage("");
    try{
      const result=await publishAnnouncement({
        title:String(data.get("title")||""),body:String(data.get("body")||""),
        audience:String(data.get("audience")||allowedAudiences[0]||"staff") as AnnouncementAudience,
        priority:String(data.get("priority")||"normal") as AnnouncementPriority,
        category:String(data.get("category")||allowedCategories[0]||"general") as AnnouncementCategory,
        expiresAt:expires?new Date(`${expires}T23:59:59`).toISOString():undefined,
      });
      form.reset();
      setMessage(result.status==="pending_approval"?"Notice submitted for leadership approval.":"Notice published to the selected audience.");
      await refresh();
    }catch(reason){setAnnouncementError(errorText(reason));}
    finally{setBusy(false);}
  }

  async function decide(id:string,decision:"approve"|"reject"){
    setBusy(true);setAnnouncementError("");setMessage("");
    try{await reviewAnnouncement(id,decision);setMessage(decision==="approve"?"Notice approved and published.":"Notice rejected and kept out of the audience feed.");await refresh();}
    catch(reason){setAnnouncementError(errorText(reason));}
    finally{setBusy(false);}
  }

  return <div className="communications-workspace">
    <div className="content role-workspace">
      <section className="page-intro"><div><span>SCHOOL COMMUNICATIONS</span><h2>Publish by authority, audience and purpose.</h2><p>Official communication is scoped by role, audience, category and priority. Feedback stays separate so individual concerns never become public notices.</p></div><div className="care-assurance"><ShieldCheck/><span><strong>Publishing authority enforced</strong><small>The database validates the school, role, audience, category and approval requirement.</small></span></div></section>
      {announcementError?<div className="form-status error" role="alert">{announcementError}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}

      {canApprove&&reviewQueue.length>0?<section className="panel"><div className="panel-title"><ShieldCheck/><div><span>LEADERSHIP APPROVAL</span><h3>{reviewQueue.length} urgent notice{reviewQueue.length===1?"":"s"} awaiting decision</h3><p>Urgent notices raised by delegated roles do not reach the audience until leadership approves them.</p></div></div>{reviewQueue.map(item=><article className="announcement-row priority-urgent" key={item.id}><header><strong>{item.title}</strong><span>{item.category} · {item.audience} · {item.priority}</span></header><p>{item.body}</p><div className="card-actions"><button className="primary" disabled={busy} onClick={()=>void decide(item.id,"approve")}>Approve & publish</button><button disabled={busy} onClick={()=>void decide(item.id,"reject")}>Reject</button></div></article>)}</section>:null}

      <section className="panel"><div className="panel-title"><Megaphone/><div><span>OFFICIAL NOTICES</span><h3>{announcements===null?"Loading school notices…":`${announcements.length} current notice${announcements.length===1?"":"s"}`}</h3></div></div>
        {announcements?.map(item=><article className={`announcement-row priority-${item.priority}`} key={item.id}><header><strong>{item.title}</strong><span>{item.category} · {item.priority}{item.audience!=="all"?` · ${item.audience}`:" · whole school"}</span></header><p>{item.body}</p><footer>{item.publishedAt?`Published ${new Date(item.publishedAt).toLocaleString()}`:"Not yet published"}{item.expiresAt?` · expires ${new Date(item.expiresAt).toLocaleDateString()}`:""}</footer></article>)}
        {announcements!==null&&announcements.length===0?<p>No current school notice is visible to this account.</p>:null}
      </section>

      {canPublish?<section className="panel"><div className="panel-title"><Megaphone/><div><span>PUBLISH NOTICE</span><h3>Publish only within your authorized scope</h3><p>Individual learner, finance dispute or safeguarding matters belong in their protected workflows. Urgent delegated notices require leadership approval.</p></div></div><form className="settings-form" onSubmit={submit}><div className="form-grid"><label>Title<input name="title" required minLength={3} maxLength={160}/></label><label>Category<select name="category" defaultValue={allowedCategories[0]}>{allowedCategories.map(item=><option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}</select></label><label>Audience<select name="audience" defaultValue={allowedAudiences[0]}>{allowedAudiences.map(item=><option key={item} value={item}>{item==="all"?"Whole school":item}</option>)}</select></label><label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label>Expires on (optional)<input name="expiresAt" type="date"/></label></div><label>Notice<textarea name="body" rows={5} required minLength={3} maxLength={4000}/></label><button className="primary" disabled={busy} type="submit"><Megaphone/>{busy?"Submitting…":leadership.includes(role)?"Publish notice":"Publish / request approval"}</button></form></section>:null}

      <section className="panel communications-divider"><div className="panel-title"><MessageSquareMore/><div><span>FEEDBACK & FOLLOW-UP</span><h3>Community voice stays actionable</h3><p>Feedback has an owner and status; it is not an announcement feed.</p></div></div><button className="primary" onClick={onFeedback}><MessageSquareMore/>Give feedback</button></section>
    </div>
    <SignalsView signals={signals} onFeedback={onFeedback} onStatus={onStatus}/>
  </div>;
}
