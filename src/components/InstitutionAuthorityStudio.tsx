import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Building2, ChevronDown, Plus, ShieldCheck, UserCog } from "lucide-react";
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

function errorText(reason:unknown){return reason instanceof Error?reason.message:"DREEM could not update this appointment.";}

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
    setTitle(preset.title);setCategory(preset.category);setScopes(preset.scopes);
    setError("");setMessage(`${preset.title} loaded. You can use it as-is or adjust it.`);
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
    await run(async()=>{await upsertSchoolPosition({code:codeFrom(savedTitle),title:savedTitle,category,scopes});setTitle("");setScopes([]);},"Position saved. DREEM will use it to show the right work to the right person.");
  }

  return <section className="panel settings-form institution-authority-studio">
    <div className="panel-title"><UserCog/><div><span>PEOPLE & RESPONSIBILITIES</span><h3>Choose how this school is organised</h3><p>Start with a ready-made position, then adjust only when your school works differently.</p></div></div>
    {error?<div className="form-status error" role="alert">{error}</div>:null}
    {message?<div className="form-status success" role="status"><BadgeCheck/>{message}</div>:null}

    <div className="position-pack-grid">
      {positionPresets.map((preset,index)=><button type="button" className="position-pack" key={preset.title+":"+index} onClick={()=>applyPreset(index)}>
        <strong>{preset.title}</strong>
        <small>{preset.category}</small>
        <span>Use this setup</span>
      </button>)}
    </div>

    <form onSubmit={save} className="position-editor">
      <div className="form-grid">
        <label>Position name<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Headmistress, Dean, Director…" required/></label>
        <label>Area<select value={category} onChange={e=>setCategory(e.target.value as PositionCategory)}>{categories.map(item=><option key={item} value={item}>{item.replace("_"," ")}</option>)}</select></label>
      </div>

      <details className="advanced-access">
        <summary><span><strong>Advanced access</strong><small>Only change this if the ready-made setup does not fit your school.</small></span><ChevronDown/></summary>
        <div className="authority-scope-grid">{authorityScopeOptions.map(item=><label key={item.value}><input type="checkbox" checked={scopes.includes(item.value)} onChange={()=>toggle(item.value)}/><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div>
      </details>

      <button className="primary" disabled={busy||!title.trim()} type="submit"><Plus/>Save position</button>
    </form>

    <div className="document-row"><Building2/><div><strong>Who holds which position?</strong><small>Choose an approved staff member and assign their main position.</small></div></div>

    {approved.length&&positions.length?<section className="subform appointment-box"><div className="form-grid">
      <label>Person<select id="authority-member"><option value="">Choose person</option>{approved.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label>Position<select id="authority-position"><option value="">Choose position</option>{positions.filter(item=>item.active).map(position=><option key={position.id} value={position.id}>{position.title}</option>)}</select></label>
    </div><button type="button" className="primary" disabled={busy} onClick={()=>{const membershipId=(document.getElementById("authority-member") as HTMLSelectElement|null)?.value??"";const positionId=(document.getElementById("authority-position") as HTMLSelectElement|null)?.value??"";if(!membershipId||!positionId){setError("Choose a person and a position first.");return;}void run(()=>assignSchoolPosition({membershipId,positionId,primary:true}).then(()=>undefined),"Appointment saved.");}}>Assign position</button></section>:null}

    <div className="appointment-list">{assignmentRows.map(row=><article key={row.id}><span><strong>{row.member!.name}</strong><small>{row.position!.title}{row.primary?" · main position":""}</small></span><button type="button" disabled={busy} onClick={()=>void run(()=>endSchoolPositionAssignment(row.id),"Appointment ended.")}>End</button></article>)}</div>

    {!assignmentRows.length?<div className="care-assurance"><ShieldCheck/><span><strong>No appointments yet</strong><small>Invite staff first, then assign positions here.</small></span></div>:null}
  </section>;
}
