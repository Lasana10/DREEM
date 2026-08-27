import { BarChart3, BookOpenCheck, Building2, BusFront, CircleUserRound, ClipboardCheck, FolderHeart, GraduationCap, MessageSquareMore, ReceiptText, Settings2, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Role, SchoolBrand } from "../domain/types";

export type ViewKey = "command" | "admissions" | "operations" | "academics" | "learners" | "teachers" | "care" | "transport" | "finance" | "signals" | "studio";
const nav = [
  {id:"command" as const,label:"Command centre",icon:BarChart3},
  {id:"admissions" as const,label:"Admissions",icon:UserPlus},
  {id:"operations" as const,label:"Daily operations",icon:ClipboardCheck},
  {id:"academics" as const,label:"Academic delivery",icon:BookOpenCheck},
  {id:"learners" as const,label:"Learner OneFiles",icon:GraduationCap},
  {id:"teachers" as const,label:"Teacher studio",icon:BookOpenCheck},
  {id:"care" as const,label:"Care & safeguarding",icon:FolderHeart},
  {id:"transport" as const,label:"School transport",icon:BusFront},
  {id:"finance" as const,label:"TrustLedger",icon:ReceiptText},
  {id:"signals" as const,label:"Voice & signals",icon:MessageSquareMore},
  {id:"studio" as const,label:"School studio",icon:Settings2},
];

const roleViews: Record<Role, ViewKey[]> = {
  platform_founder:["command","admissions","operations","academics","learners","teachers","care","transport","finance","signals","studio"],
  school_owner:["command","admissions","operations","academics","learners","teachers","care","transport","finance","signals","studio"],
  principal:["command","admissions","operations","academics","learners","teachers","care","transport","finance","signals","studio"],
  administrator:["command","admissions","operations","academics","learners","teachers","care","transport","finance","signals","studio"],
  academic_head:["command","admissions","operations","academics","learners","teachers","care","signals","studio"],
  bursar:["command","learners","finance"],
  accountant:["command","finance"],
  teacher:["operations","learners","care","signals"],
  tutor:["learners","care","signals"],
  transport_manager:["command","transport","signals"],
  driver:["transport","signals"],
  security_guard:["transport","signals"],
  parent:["learners","transport","signals"],
  student:["learners","transport","signals"],
  auditor:["command","learners","finance","signals"],
};

function roleLabel(role: Role) { return role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default function Shell({ brand, viewer, view, onView, signalCount, onFeedback, children }:{brand:SchoolBrand;viewer:{name:string;email:string;role:Role};view:ViewKey;onView:(view:ViewKey)=>void;signalCount:number;onFeedback:()=>void;children:ReactNode}) {
  const visibleNav = nav.filter((item) => roleViews[viewer.role].includes(item.id));
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const connect=()=>setOnline(true);const disconnect=()=>setOnline(false);window.addEventListener("online",connect);window.addEventListener("offline",disconnect);return()=>{window.removeEventListener("online",connect);window.removeEventListener("offline",disconnect)}},[]);
  return <main className="shell" style={{"--brand":brand.primaryColor,"--accent":brand.accentColor} as React.CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><span>D</span><div><strong>DREEM</strong><small>Proof to Progress</small></div></div>
      <div className="school"><span>{brand.logoUrl?<img src={brand.logoUrl} alt=""/>:brand.shortName}</span><div><strong>{brand.name}</strong><small><Building2 size={11}/>{brand.city} · {brand.subsystem}</small></div></div>
      <nav><small>OPERATIONS</small>{visibleNav.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>onView(item.id)}><item.icon size={18}/><span>{item.label}</span>{item.id==="signals"&&signalCount>0?<b>{signalCount}</b>:null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={17}/><span><strong>Protected workspace</strong><small>Audit trail active</small></span></div><div className="account"><CircleUserRound/><span><strong>{viewer.name}</strong><small>{roleLabel(viewer.role)}</small></span></div></div>
    </aside>
    <section className="workspace"><header><div><span>DREEM SCHOOL OPERATING SYSTEM</span><h1>{nav.find(item=>item.id===view)?.label}</h1></div><div><span className={`connectivity ${online?"online":"offline"}`}>{online?"Online":"Offline · writes paused"}</span><button className="language">EN / FR</button><button className="feedback" onClick={onFeedback}><MessageSquareMore size={15}/>Give feedback</button></div></header>{children}</section>
    <nav className="mobile-nav">{visibleNav.slice(0,5).map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>onView(item.id)}><item.icon size={19}/><span>{item.label.split(" ")[0]}</span></button>)}</nav>
  </main>;
}

export function EmptyState({ title, body }:{title:string;body:string}) { return <div className="empty"><UsersRound/><strong>{title}</strong><p>{body}</p></div>; }
