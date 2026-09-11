import {
  BarChart3, BookOpenCheck, Building2, BusFront, CircleUserRound, ClipboardCheck,
  FolderHeart, GraduationCap, IdCard, Menu, MessageSquareMore, ReceiptText,
  Settings2, ShieldCheck, UserPlus, UsersRound, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Role, SchoolBrand } from "../domain/types";
import { pendingOfflineCount } from "../lib/offlineOutbox";

export type ViewKey = "command"|"admissions"|"operations"|"academics"|"learning"|"learners"|"credentials"|"teachers"|"care"|"transport"|"finance"|"signals"|"studio";

type NavItem={id:ViewKey;label:string;icon:typeof BarChart3};
const nav:NavItem[] = [
  {id:"command",label:"Command centre",icon:BarChart3},
  {id:"admissions",label:"Admissions",icon:UserPlus},
  {id:"operations",label:"Daily operations",icon:ClipboardCheck},
  {id:"academics",label:"Academic delivery",icon:BookOpenCheck},
  {id:"learning",label:"Assignments",icon:ClipboardCheck},
  {id:"learners",label:"Learner records",icon:GraduationCap},
  {id:"credentials",label:"ID cards",icon:IdCard},
  {id:"teachers",label:"Teaching & staff development",icon:BookOpenCheck},
  {id:"care",label:"Care & safeguarding",icon:FolderHeart},
  {id:"transport",label:"Transport & pickup",icon:BusFront},
  {id:"finance",label:"Finance & fees",icon:ReceiptText},
  {id:"signals",label:"Messages & feedback",icon:MessageSquareMore},
  {id:"studio",label:"School settings",icon:Settings2},
];

const roleViews:Record<Role,ViewKey[]>={
 platform_founder:["command","admissions","operations","academics","learning","learners","credentials","teachers","care","transport","finance","signals","studio"],
 school_owner:["command","admissions","operations","academics","learning","learners","credentials","teachers","care","transport","finance","signals","studio"],
 principal:["command","admissions","operations","academics","learning","learners","credentials","teachers","care","transport","finance","signals","studio"],
 administrator:["command","admissions","operations","learners","credentials","teachers","signals","studio"],
 academic_head:["command","academics","learning","learners","teachers","care","signals","studio"],
 bursar:["finance","learners"],accountant:["command","finance"],
 teacher:["command","operations","learning","learners","care","signals"],tutor:["learning","learners","care","signals"],
 transport_manager:["command","transport","signals"],driver:["transport"],security_guard:["transport"],
 parent:["learning","learners","transport","signals"],student:["learning","learners","transport","signals"],auditor:["command","learners","finance"]
};

const primaryMobileViews:Partial<Record<Role,ViewKey[]>>={
 platform_founder:["command","admissions","academics","learners"],school_owner:["command","admissions","academics","learners"],principal:["command","admissions","academics","learners"],
 administrator:["command","admissions","operations","learners"],academic_head:["command","academics","learning","teachers"],
 teacher:["command","operations","learning","learners"],tutor:["learning","learners","care","signals"],
 parent:["learning","transport","signals"],student:["learning","transport","signals"],
 bursar:["finance","learners"],accountant:["finance","command"],transport_manager:["transport","command","signals"],driver:["transport"],security_guard:["transport"],auditor:["command","finance","learners"]
};

const roleViewLabels:Partial<Record<Role,Partial<Record<ViewKey,string>>>>={
 teacher:{command:"Today",operations:"My classes",learning:"Assignments",learners:"Learner support",care:"Safeguarding",signals:"Messages"},
 tutor:{learning:"My teaching",learners:"Learner support",care:"Safeguarding",signals:"Messages"},
 parent:{learning:"My children",learners:"Learner records",transport:"Transport & pickup",signals:"Messages"},
 student:{learning:"My schoolwork",learners:"My record",transport:"My transport",signals:"Messages"},
 bursar:{finance:"Collections & fees",learners:"Learner accounts"},
 accountant:{command:"Finance overview",finance:"Accounting & reconciliation"},
 transport_manager:{command:"Transport today",transport:"Transport control",signals:"Messages"},
 driver:{transport:"Today’s route"},security_guard:{transport:"Secure gate"},
 auditor:{command:"Oversight",learners:"Learner records",finance:"Finance audit"}
};

function roleLabel(role:Role){return role.replaceAll("_"," ").replace(/\b\w/g,l=>l.toUpperCase());}
function labelFor(role:Role,id:ViewKey){return roleViewLabels[role]?.[id]??nav.find(item=>item.id===id)?.label??"Workspace";}

export default function Shell({brand,viewer,view,onView,signalCount,onFeedback,children}:{brand:SchoolBrand;viewer:{id?:string;name:string;email:string;role:Role};view:ViewKey;onView:(view:ViewKey)=>void;signalCount:number;onFeedback:()=>void;children:ReactNode}){
 const allowed=roleViews[viewer.role];
 const canOpenStudio=allowed.includes("studio");
 // School settings is a controlled configuration destination, not a daily workspace.
 const visibleNav=nav.filter(item=>allowed.includes(item.id)&&item.id!=="studio");
 const primaryIds=primaryMobileViews[viewer.role]??visibleNav.slice(0,4).map(item=>item.id);
 const mobilePrimary=primaryIds.map(id=>visibleNav.find(item=>item.id===id)).filter((item):item is NavItem=>Boolean(item));
 const mobileMore=visibleNav.filter(item=>!primaryIds.includes(item.id));
 const[online,setOnline]=useState(navigator.onLine),[mobileMenuOpen,setMobileMenuOpen]=useState(false),[pending,setPending]=useState(0);
 useEffect(()=>{let active=true;const refresh=()=>{if(viewer.id)pendingOfflineCount({actorId:viewer.id}).then(value=>active&&setPending(value)).catch(()=>{});};const connect=()=>{setOnline(true);refresh();},disconnect=()=>setOnline(false);window.addEventListener("online",connect);window.addEventListener("offline",disconnect);window.addEventListener("dreem:outbox-changed",refresh);refresh();return()=>{active=false;window.removeEventListener("online",connect);window.removeEventListener("offline",disconnect);window.removeEventListener("dreem:outbox-changed",refresh);};},[viewer.id]);
 const connectivity=!online?(pending?`Offline · ${pending} change${pending===1?"":"s"} safely queued`:"Offline · read-only until a safe action is queued"):pending?`Online · ${pending} pending sync`:"Online · synced";
 return <main className="shell" style={{"--brand":brand.primaryColor,"--accent":brand.accentColor} as React.CSSProperties}>
  <aside className="sidebar"><div className="brand"><span>D</span><div><strong>DREEM</strong><small>Proof to Progress</small></div></div><div className="school"><span>{brand.logoUrl?<img src={brand.logoUrl} alt=""/>:brand.shortName}</span><div><strong>{brand.name}</strong><small><Building2 size={11}/>{brand.city} · {brand.subsystem}</small></div></div><nav><small>YOUR WORK</small>{visibleNav.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>onView(item.id)}><item.icon size={18}/><span>{labelFor(viewer.role,item.id)}</span>{item.id==="signals"&&signalCount>0?<b>{signalCount}</b>:null}</button>)}</nav><div className="sidebar-bottom"><div className="secure"><ShieldCheck size={17}/><span><strong>Protected workspace</strong><small>Audit trail active</small></span></div><div className="account"><CircleUserRound/><span><strong>{viewer.name}</strong><small>{roleLabel(viewer.role)}</small></span></div></div></aside>
  <section className="workspace"><header><div><span>DREEM SCHOOL OPERATING SYSTEM</span><h1>{view==="studio"?"School settings":labelFor(viewer.role,view)}</h1></div><div><span className={`connectivity ${online?"online":"offline"}`}>{connectivity}</span><button className="language">EN / FR</button>{canOpenStudio&&view!=="studio"?<button className="feedback" onClick={()=>onView("studio")}><Settings2 size={15}/>School settings</button>:null}<button className="feedback" onClick={onFeedback}><MessageSquareMore size={15}/>Give feedback</button></div></header>{children}</section>
  {mobileMenuOpen?<div className="mobile-more-backdrop" onClick={()=>setMobileMenuOpen(false)}><section className="mobile-more-menu" aria-label="More DREEM workspaces" onClick={e=>e.stopPropagation()}><header><strong>More workspaces</strong><button aria-label="Close workspace menu" onClick={()=>setMobileMenuOpen(false)}><X/></button></header>{mobileMore.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>{onView(item.id);setMobileMenuOpen(false);}}><item.icon size={19}/><span>{labelFor(viewer.role,item.id)}</span></button>)}{canOpenStudio?<button className={view==="studio"?"active":""} onClick={()=>{onView("studio");setMobileMenuOpen(false);}}><Settings2 size={19}/><span>School settings</span></button>:null}</section></div>:null}
  <nav className="mobile-nav">{mobilePrimary.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>onView(item.id)}><item.icon size={19}/><span>{labelFor(viewer.role,item.id).split(" ")[0]}</span></button>)}{(mobileMore.length>0||canOpenStudio)?<button className={mobileMore.some(item=>item.id===view)||view==="studio"?"active":""} onClick={()=>setMobileMenuOpen(true)}><Menu size={19}/><span>More</span></button>:null}</nav>
 </main>;
}
export function EmptyState({title,body}:{title:string;body:string}){return <div className="empty"><UsersRound/><strong>{title}</strong><p>{body}</p></div>;}
