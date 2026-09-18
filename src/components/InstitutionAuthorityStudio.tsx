import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Building2, Plus, ShieldCheck, UserCog } from "lucide-react";
import type { AccessMembership } from "../domain/types";
import type { AuthorityScope } from "../lib/authority";
import {
  assignSchoolPosition,
  authorityScopeOptions,
  endSchoolPositionAssignment,
  loadInstitutionAuthority,
  positionPresets,
  upsertSchoolPosition,
  type PositionAssignment,
  type PositionCategory,
  type SchoolPosition,
} from "../lib/institutionalAuthority";

const categories:PositionCategory[]=["governance","leadership","academic","finance","operations","support","audit"];
const codeFrom=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"position";

function errorText(reason:unknown){return reason instanceof Error?reason.message:"Institutional authority could not be updated.";}

export default function InstitutionAuthorityStudio({memberships,onChanged}:{memberships:AccessMembership[];onChanged?:()=>Promise<void>}){
  const[positions,setPositions]=useState<SchoolPosition[]>([]),[assignments,setAssignments]=useState<PositionAssignment[]>([]);
  const[title,setTitle]=useState(""),[category,setCategory]=useState<PositionCategory>("leadership"),[scopes,setScopes]=useState<AuthorityScope[]>([]);
  const[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const approved=memberships.filter(item=>item.status==="approved");

  async function refresh(){const data=await loadInstitutionAuthority();setPositions(data.positions);setAssignments(data.assignments);}
  useEffect(()=>{void refresh().catch(reason=>setError(errorText(reason)));},[]);

  const assignmentRows=useMemo(()=>assignments.filter(item=>item.status==="active").map(item=>({
    ...item,
    member:approved.find(member=>member.id===item.membershipId),
    position:positions.find(position=>position.id===item.positionId),
  })).filter(item=>item.member&&item.position),[assignments,approved,positions]);

  function applyPreset(index:number){
    const preset=positionPresets[index];
    setTitle(preset.title);setCategory(preset.category);setScopes(preset.scopes);setMessage("Preset loaded as an editable position. Change the title or authority before saving if this school works differently.");
  }

  function toggle(scope:AuthorityScope){setScopes(current=>current.includes(scope)?current.filter(item=>item!==scope):[...current,scope]);}

  async function run(action:()=>Promise<void>,success:string){
    setBusy(true);setError("");setMessage("");
    try{await action();await refresh();if(onChanged)await onChanged();setMessage(success);}
    catch(reason){setError(errorText(reason));}
    finally{setBusy(false);}
  }

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const savedTitle=title.trim();
    await run(async()=>{await upsertSchoolPosition({code:codeFrom(savedTitle),title:savedTitle,category,scopes});setTitle("");setScopes([]);},"Institutional position saved. Titles remain human-facing; authority controls access.");
  }

  return <section className="panel settings-form institution-authority-studio">
    <div className="panel-title"><UserCog/><div><span>INSTITUTION & AUTHORITY</span><h3>Model the school as it actually operates</h3><p>Principal, Headmistress, Director, Dean, Proprietor and other titles are appointments. DREEM grants capabilities through explicit authority, not through the title itself.</p></div></div>
    <div className="care-assurance"><ShieldCheck/><span><strong>Title ≠ permission</strong><small>One person may hold several appointments; each appointment grants only the authority the school deliberately assigns.</small></span></div>
    {error?<div className="form-status error" role="alert">{error}</div>:null}
    {message?<div className="form-status success" role="status"><BadgeCheck/>{message}</div>:null}

    <div className="role-guide">{positionPresets.map((preset,index)=><button type="button" key={preset.title+":"+index} onClick={()=>applyPreset(index)}><strong>{preset.title}</strong><small>{preset.scopes.map(scope=>authorityScopeOptions.find(item=>item.value===scope)?.label??scope).join(" · ")}</small></button>)}</div>

    <form onSubmit={save}>
      <div className="form-grid">
        <label>Institutional title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Headmistress, Dean, Director…" required/></label>
        <label>Position family<select value={category} onChange={e=>setCategory(e.target.value as PositionCategory)}>{categories.map(item=><option key={item} value={item}>{item.replace("_"," ")}</option>)}</select></label>
      </div>
      <fieldset className="palette-field"><legend>Authority carried by this position</legend><div className="authority-scope-grid">{authorityScopeOptions.map(item=><label key={item.value}><input type="checkbox" checked={scopes.includes(item.value)} onChange={()=>toggle(item.value)}/><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div></fieldset>
      <button className="primary" disabled={busy||!title.trim()} type="submit"><Plus/>Save position</button>
    </form>

    <div className="document-row"><Building2/><div><strong>Position catalogue</strong><small>Create the institutional posts once, then appoint approved people to them. A person can hold several posts; mark the main one as primary.</small></div></div>
    <div className="academic-grid">{positions.filter(item=>item.active).map(position=><article className="document-row" key={position.id}><strong>{position.title}</strong><span>{position.category} · {position.scopes.length} authorit{position.scopes.length===1?"y":"ies"}</span><small>{position.scopes.map(scope=>authorityScopeOptions.find(item=>item.value===scope)?.label??scope).join(" · ")||"No privileged authority"}</small></article>)}{!positions.length?<p>No institutional position has been configured yet.</p>:null}</div>

    {approved.length&&positions.length?<section className="subform"><h4>Appoint approved staff</h4><div className="form-grid">
      <label>Person<select id="authority-member"><option value="">Choose approved person</option>{approved.map(member=><option key={member.id} value={member.id}>{member.name} · {member.role.replaceAll("_"," ")}</option>)}</select></label>
      <label>Position<select id="authority-position"><option value="">Choose institutional position</option>{positions.filter(item=>item.active).map(position=><option key={position.id} value={position.id}>{position.title}</option>)}</select></label>
    </div><button type="button" disabled={busy} onClick={()=>{const membershipId=(document.getElementById("authority-member") as HTMLSelectElement|null)?.value??"";const positionId=(document.getElementById("authority-position") as HTMLSelectElement|null)?.value??"";if(!membershipId||!positionId){setError("Choose both a person and a position.");return;}void run(()=>assignSchoolPosition({membershipId,positionId,primary:true}).then(()=>undefined),"Appointment assigned and the person's authority context updated.");}}>Assign as primary position</button></section>:null}

    <div className="compact-table">{assignmentRows.map(row=><div key={row.id}><span><strong>{row.member!.name}</strong><small>{row.position!.title}{row.primary?" · primary":""}</small></span><button type="button" disabled={busy} onClick={()=>void run(()=>endSchoolPositionAssignment(row.id),"Appointment ended without deleting the person's history.")}>End appointment</button></div>)}</div>
  </section>;
}
