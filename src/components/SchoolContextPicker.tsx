import { Building2, ShieldCheck } from "lucide-react";
import type { SchoolMembershipContext } from "../lib/schoolContext";

const label=(role:string)=>role.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase());

export default function SchoolContextPicker({memberships,onChoose,onSignOut}:{memberships:SchoolMembershipContext[];onChoose:(schoolId:string)=>Promise<void>;onSignOut:()=>Promise<void>}){
  return <div className="auth-screen"><section className="auth-card school-context-picker"><strong>DREEM</strong><h1>Choose the school you are entering</h1><p>Your approved role is tied to each school. Choosing a school changes the institution context only; it never grants a new role.</p><div className="school-context-list">{memberships.map(item=><button className="school-context-option" key={`${item.schoolId}:${item.role}`} onClick={()=>void onChoose(item.schoolId)}><Building2/><span><strong>{item.schoolName}</strong><small><ShieldCheck/>Approved as {label(item.role)}</small></span></button>)}</div><button className="link-button" onClick={()=>void onSignOut()}>Sign out</button></section></div>;
}
