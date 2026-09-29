import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  loadPolicyRules,
  savePolicyRule,
  seedRecommendedPolicies,
  simulatePolicyRule,
  type PolicyActionLevel,
  type PolicyCode,
  type PolicyRule,
  type PolicyService,
} from "../lib/policyEngine";

const labels:Record<PolicyCode,{title:string;help:string;unit:string;domain:string;ownerScope:string}>={
  attendance_followup:{
    title:"Attendance follow-up",
    help:"Learners below this attendance level appear for staff review.",
    unit:"%",
    domain:"attendance",
    ownerScope:"academics_delivery",
  },
  missing_work_followup:{
    title:"Repeated missing school work",
    help:"Repeated overdue work appears for teacher follow-up before escalation.",
    unit:" assignments",
    domain:"learning",
    ownerScope:"academics_delivery",
  },
  fee_overdue_followup:{
    title:"Overdue fee follow-up",
    help:"Open overdue charges enter finance follow-up without automatically blocking the learner.",
    unit:" overdue item(s)",
    domain:"finance",
    ownerScope:"finance_collection",
  },
};

const services:PolicyService[]=["exam","report","trip","renewal","graduation","transport","boarding","library","activity","document"];

function errorText(reason:unknown){return reason instanceof Error?reason.message:"Policy settings could not be updated.";}

export default function PolicyStudio(){
  const[rules,setRules]=useState<PolicyRule[]>([]);
  const[busy,setBusy]=useState<string>("");
  const[message,setMessage]=useState("");
  const[error,setError]=useState("");
  const[advanced,setAdvanced]=useState(false);
  const[impact,setImpact]=useState<Record<string,string>>({});

  async function refresh(){
    setError("");
    const data=await loadPolicyRules();
    setRules(data);
  }

  useEffect(()=>{void refresh().catch(reason=>setError(errorText(reason)));},[]);

  const byCode=useMemo(()=>new Map(rules.map(rule=>[rule.code,rule])),[rules]);
  const codes=Object.keys(labels) as PolicyCode[];

  async function seed(){
    setBusy("seed");setError("");setMessage("");
    try{await seedRecommendedPolicies();await refresh();setMessage("DREEM Recommended rules are active for this school.");}
    catch(reason){setError(errorText(reason));}
    finally{setBusy("");}
  }

  function update(code:PolicyCode,patch:Partial<PolicyRule>){
    setRules(current=>current.map(rule=>rule.code===code?{...rule,...patch}:rule));
  }

  async function preview(code:PolicyCode){
    const rule=byCode.get(code);if(!rule)return;
    setBusy("preview:"+code);setError("");
    try{
      const result=await simulatePolicyRule(code,rule.threshold);
      setImpact(current=>({...current,[code]:result.affected+" of "+result.total+" learners would currently need follow-up."}));
    }catch(reason){setError(errorText(reason));}
    finally{setBusy("");}
  }

  async function save(code:PolicyCode){
    const rule=byCode.get(code);if(!rule)return;
    setBusy("save:"+code);setError("");setMessage("");
    try{
      await savePolicyRule({
        code:rule.code,
        name:rule.name,
        domain:rule.domain,
        threshold:rule.threshold,
        actionLevel:rule.actionLevel,
        targetService:rule.targetService,
        ownerScope:rule.ownerScope,
        enabled:rule.enabled,
      });
      await refresh();
      setMessage(labels[code].title+" saved. DREEM will re-evaluate affected learners automatically.");
    }catch(reason){setError(errorText(reason));}
    finally{setBusy("");}
  }

  return <section className="panel settings-form dreem-policy-studio">
    <div className="panel-title"><ShieldCheck/><div><span>DREEM RECOMMENDED</span><h3>Everyday school follow-up</h3><p>Use clear school rules, preview who they would affect, then let DREEM create evidence-backed follow-up. Learners are never silently blocked.</p></div></div>

    {error?<div className="form-status error" role="alert"><ShieldAlert/>{error}</div>:null}
    {message?<div className="form-status success" role="status"><BadgeCheck/>{message}</div>:null}

    {!rules.length?<div className="workflow-next"><small>SAFE START</small><strong>Use DREEM Recommended</strong><p>Attendance, repeated missing work and overdue fees begin as staff-review rules. You can change the thresholds later.</p><button type="button" className="primary" disabled={busy==="seed"} onClick={()=>void seed()}>Activate recommended rules</button></div>:null}

    <div className="policy-rule-grid">{codes.map(code=>{
      const rule=byCode.get(code);if(!rule)return null;
      const meta=labels[code];
      return <article className="policy-rule-card" key={code}>
        <div><strong>{meta.title}</strong><small>{meta.help}</small></div>
        <label>Follow up when
          <span className="policy-threshold"><input aria-label={meta.title+" threshold"} type="number" min={code==="attendance_followup"?0:1} max={code==="attendance_followup"?100:999} value={rule.threshold} onChange={e=>update(code,{threshold:Number(e.target.value)})}/><small>{meta.unit}</small></span>
        </label>
        <label className="policy-toggle"><input type="checkbox" checked={rule.enabled} onChange={e=>update(code,{enabled:e.target.checked})}/><span>{rule.enabled?"Active":"Paused"}</span></label>
        {advanced?<div className="advanced-settings">
          <label>School response<select value={rule.actionLevel} onChange={e=>update(code,{actionLevel:e.target.value as PolicyActionLevel})}><option value="notify">Notify</option><option value="remind">Remind</option><option value="review">Require staff review</option><option value="restrict_specific_service">Propose a specific service restriction</option></select></label>
          {rule.actionLevel==="restrict_specific_service"?<label>Specific service<select value={rule.targetService??"exam"} onChange={e=>update(code,{targetService:e.target.value as PolicyService})}>{services.map(service=><option value={service} key={service}>{service.replaceAll("_"," ")}</option>)}</select><small>Restriction still requires institutional leadership + school configuration authority and a recorded reason.</small></label>:null}
        </div>:null}
        {impact[code]?<div className="care-assurance"><Eye/><span><strong>Preview</strong><small>{impact[code]}</small></span></div>:null}
        <div className="policy-actions"><button type="button" disabled={busy!==""} onClick={()=>void preview(code)}>Preview impact</button><button type="button" className="primary" disabled={busy!==""} onClick={()=>void save(code)}>Save rule</button></div>
      </article>;
    })}</div>

    {rules.length?<button type="button" className="secondary" onClick={()=>setAdvanced(value=>!value)}>{advanced?"Hide advanced policy controls":"Advanced policy controls"}</button>:null}
    <div className="brand-live-note"><strong>Safe default:</strong> Notify → remind → staff review → authorised exception when needed. A service restriction is never created from a threshold alone.</div>
  </section>;
}
