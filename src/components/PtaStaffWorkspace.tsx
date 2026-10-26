import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { userFacingError } from "../lib/userFacingError";

type Campaign = {id:string;title_en:string;title_fr:string;meeting_date:string|null;published:boolean};
type Entry = {id:string;kind:string;topic:string;language:string;message:string;contact:string|null;status:string;created_at:string};
const statuses=["new","under_review","action_planned","resolved","closed"];
export default function PtaStaffWorkspace(){
 const [items,setItems]=useState<Campaign[]>([]);
 const [selected,setSelected]=useState("");
 const [entries,setEntries]=useState<Entry[]>([]);
 const [en,setEn]=useState("PTA parent consultation"),[fr,setFr]=useState("Consultation des parents APEE");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [meeting,setMeeting]=useState("");
 async function load(){
  if(!supabase)throw new Error("School service unavailable");
  const result=await supabase.rpc("dreem_pta_staff_campaigns");
  if(result.error)throw result.error;
  const rows=(result.data??[]) as Campaign[];
  setItems(rows);setSelected(old=>rows.some(row=>row.id===old)?old:rows[0]?.id??"");
 }
 useEffect(()=>{void load().catch(e=>setError(userFacingError(e,"Could not load PTA consultations.")));},[]);
 useEffect(()=>{if(!selected||!supabase){setEntries([]);return;}let active=true;void supabase.rpc("dreem_pta_staff_submissions",{p_campaign_id:selected}).then(result=>{if(!active)return;if(result.error)setError(userFacingError(result.error,"Could not load submissions."));else setEntries((result.data??[]) as Entry[]);});return()=>{active=false;};},[selected]);
 const campaign=items.find(item=>item.id===selected);
 async function execute(fn:()=>Promise<void>){setBusy(true);setError("");try{await fn();await load();}catch(e){setError(userFacingError(e,"Action could not be completed."));}finally{setBusy(false);}}
 const link=campaign?window.location.origin+"/pta/"+campaign.id:"";
 return <section className="content role-workspace">
  <section className="role-hero"><div><span className="eyebrow">PARENT VOICE · PTA / APEE</span><h2>Parent consultation</h2><p>Collect concerns before the meeting, investigate and prepare solutions. Submissions are private.</p></div></section>
  {error&&<p className="form-status error" role="alert">{error}</p>}
  <section className="message-composer"><h3>Create a meeting consultation</h3>
   <div className="settings-form"><label>English title<input value={en} onChange={e=>setEn(e.target.value)}/></label><label>French title<input value={fr} onChange={e=>setFr(e.target.value)}/></label><label>Meeting date<input type="date" value={meeting} onChange={e=>setMeeting(e.target.value)}/></label>
   <button className="primary" type="button" disabled={busy||en.trim().length<5||fr.trim().length<5} onClick={()=>void execute(async()=>{const r=await supabase!.rpc("dreem_pta_create_campaign",{p_title_en:en,p_title_fr:fr,p_meeting_date:meeting||null});if(r.error)throw r.error;})}>Create draft consultation</button></div>
  </section>
  <section className="message-composer"><h3>Review consultations</h3><label>Consultation<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose consultation</option>{items.map(item=><option key={item.id} value={item.id}>{item.title_en} — {item.published?"Published":"Draft"}</option>)}</select></label>
  {campaign&&<><p>Status: {campaign.published?"Published":"Draft"}</p><button type="button" disabled={busy} onClick={()=>void execute(async()=>{const r=await supabase!.rpc("dreem_pta_set_published",{p_campaign_id:campaign.id,p_published:!campaign.published});if(r.error)throw r.error;})}>{campaign.published?"Close intake":"Publish intake"}</button>{campaign.published&&<p>Parent link: <a href={link} target="_blank" rel="noreferrer">{link}</a></p>}</>}
  <small>Before sharing, verify the live migration, request limits and child-safety response contact.</small></section>
  {campaign&&<section className="message-composer"><h3>Private parent submissions ({entries.length})</h3><p>Do not share names or allegations in public PTA reports. Child safety cases need immediate restricted follow-up.</p>
  {entries.map(entry=><article key={entry.id} className="message-card"><header><strong>{entry.topic} · {entry.kind}</strong><small>{new Date(entry.created_at).toLocaleString()}</small></header><p>{entry.message}</p>{entry.contact&&<small>Private contact: {entry.contact}</small>}
  <label>Resolution status<select value={entry.status} disabled={busy} onChange={e=>void execute(async()=>{const r=await supabase!.rpc("dreem_pta_set_status",{p_submission_id:entry.id,p_status:e.target.value});if(r.error)throw r.error;setEntries(current=>current.map(x=>x.id===entry.id?{...x,status:e.target.value}:x));})}>{statuses.map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></label></article>)}
  </section>}
 </section>;
}