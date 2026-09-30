import {
  BarChart3, BookOpenCheck, Building2, BusFront, CircleUserRound, ClipboardCheck,
  FolderHeart, GraduationCap, IdCard, Menu, MessageSquareMore, ReceiptText,
  Search, Settings2, ShieldCheck, UserPlus, UsersRound, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Role, SchoolBrand } from "../domain/types";
import type { AuthorityScope } from "../lib/authority";
import { allowedWorkspaceViews } from "../lib/access";
import { pendingOfflineCount } from "../lib/offlineOutbox";
import { searchWorkspace, type WorkspaceSearchItem } from "../lib/workspaceSearch";
import { roleAppIdentity } from "../lib/roleApp";

export type ViewKey = "command"|"admissions"|"operations"|"academics"|"learning"|"learners"|"credentials"|"teachers"|"care"|"transport"|"finance"|"signals"|"studio";
type NavItem={id:ViewKey;label:string;icon:typeof BarChart3;keywords?:string};
const nav:NavItem[]=[
  {id:"command",label:"Today",icon:BarChart3,keywords:"home dashboard pulse attention"},
  {id:"admissions",label:"Admissions",icon:UserPlus,keywords:"applications enrolment applicant"},
  {id:"operations",label:"Operations",icon:ClipboardCheck,keywords:"staff access attendance school operations"},
  {id:"academics",label:"Academics",icon:BookOpenCheck,keywords:"curriculum timetable teaching outcomes"},
  {id:"learning",label:"Learning",icon:ClipboardCheck,keywords:"assignments assessment submissions lessons"},
  {id:"learners",label:"People",icon:GraduationCap,keywords:"learners families staff guardians records"},
  {id:"credentials",label:"ID cards",icon:IdCard,keywords:"identity credential badge qr"},
  {id:"teachers",label:"Teaching team",icon:BookOpenCheck,keywords:"teachers workload coaching"},
  {id:"care",label:"Care",icon:FolderHeart,keywords:"support safeguarding wellbeing cases"},
  {id:"transport",label:"Transport",icon:BusFront,keywords:"routes buses drivers stops trips"},
  {id:"finance",label:"Finance",icon:ReceiptText,keywords:"fees payments receipts reconciliation money"},
  {id:"signals",label:"Messages",icon:MessageSquareMore,keywords:"communication feedback announcements inbox"},
  {id:"studio",label:"Settings",icon:Settings2,keywords:"school configuration policy branding setup"},
];

const primaryMobileViews:Partial<Record<Role,ViewKey[]>>={
 platform_founder:["command","admissions","academics","finance"],school_owner:["command","admissions","academics","finance"],principal:["command","admissions","academics","learners"],
 administrator:["command","admissions","operations","learners"],academic_head:["command","academics","learning","teachers"],
 teacher:["command","operations","learning","learners"],tutor:["learning","learners","care","signals"],
 parent:["learning","transport","signals"],student:["learning","transport","signals"],bursar:["finance","learners"],
 accountant:["finance","command"],transport_manager:["transport","command","signals"],driver:["transport"],security_guard:["transport"],auditor:["command","finance","learners"]
};

const primaryDesktopViews:Partial<Record<Role,ViewKey[]>>={
 platform_founder:["command","admissions","academics","learners","finance","signals"],
 school_owner:["command","admissions","academics","learners","finance","signals"],
 principal:["command","admissions","academics","learners","finance","signals"],
 administrator:["command","admissions","operations","learners","signals"],
 academic_head:["command","academics","learning","learners","teachers","signals"],
 teacher:["command","operations","learning","learners","signals"],
 tutor:["learning","learners","care","signals"],
 parent:["learning","learners","transport","signals"],
 student:["learning","learners","transport","signals"],
 bursar:["finance","learners","signals"],
 accountant:["command","finance","signals"],
 transport_manager:["command","transport","signals"],
 driver:["transport"],security_guard:["transport"],
 auditor:["command","finance","learners"]
};

const roleViewLabels:Partial<Record<Role,Partial<Record<ViewKey,string>>>>={
 teacher:{command:"Today",operations:"My classes",learning:"Assignments",learners:"Learners",care:"Support",signals:"Messages"},
 tutor:{learning:"My teaching",learners:"Learners",care:"Support",signals:"Messages"},
 parent:{learning:"My children",learners:"Learner record",transport:"Transport",signals:"Messages"},
 student:{learning:"Today",learners:"My record",transport:"Transport",signals:"Messages"},
 bursar:{finance:"Money today",learners:"Learner accounts"},accountant:{command:"Finance pulse",finance:"Review & reconcile"},
 transport_manager:{command:"Transport today",transport:"Transport control",signals:"Messages"},driver:{transport:"My route"},
 security_guard:{transport:"Secure gate"},auditor:{command:"Oversight",learners:"Learner records",finance:"Finance audit"}
};
function roleLabel(role:Role){return role.replaceAll("_"," ").replace(/\b\w/g,l=>l.toUpperCase());}
function labelFor(role:Role,id:ViewKey){return roleViewLabels[role]?.[id]??nav.find(item=>item.id===id)?.label??"Workspace";}

export default function Shell({brand,viewer,view,onView,signalCount,onFeedback,searchItems=[],children}:{brand:SchoolBrand;viewer:{id?:string;name:string;email:string;role:Role;positionTitle?:string;authorityScopes?:AuthorityScope[]};view:ViewKey;onView:(view:ViewKey)=>void;signalCount:number;onFeedback:()=>void;searchItems?:WorkspaceSearchItem[];children:ReactNode}){
 const appIdentity=roleAppIdentity(viewer.role);
 const allowed=allowedWorkspaceViews(viewer) as ViewKey[];
 const canOpenStudio=allowed.includes("studio");
 const visibleNav=nav.filter(item=>allowed.includes(item.id)&&item.id!=="studio");
 const desktopPrimaryIds=primaryDesktopViews[viewer.role]??visibleNav.slice(0,6).map(item=>item.id);
 const desktopPrimary=desktopPrimaryIds.map(id=>visibleNav.find(item=>item.id===id)).filter((item):item is NavItem=>Boolean(item));
 const desktopSecondary=visibleNav.filter(item=>!desktopPrimaryIds.includes(item.id));
 const primaryIds=primaryMobileViews[viewer.role]??visibleNav.slice(0,4).map(item=>item.id);
 const mobilePrimary=primaryIds.map(id=>visibleNav.find(item=>item.id===id)).filter((item):item is NavItem=>Boolean(item));
 const mobileMore=visibleNav.filter(item=>!primaryIds.includes(item.id));
 const[online,setOnline]=useState(navigator.onLine),[mobileMenuOpen,setMobileMenuOpen]=useState(false),[pending,setPending]=useState(0),[query,setQuery]=useState("");
 useEffect(()=>{let active=true;const refresh=()=>{if(viewer.id)pendingOfflineCount({actorId:viewer.id}).then(value=>active&&setPending(value)).catch(()=>{});};const connect=()=>{setOnline(true);refresh();},disconnect=()=>setOnline(false);window.addEventListener("online",connect);window.addEventListener("offline",disconnect);window.addEventListener("dreem:outbox-changed",refresh);refresh();return()=>{active=false;window.removeEventListener("online",connect);window.removeEventListener("offline",disconnect);window.removeEventListener("dreem:outbox-changed",refresh);};},[viewer.id]);
 const connectivity=!online?(pending?("Offline · "+pending+" queued"):"Offline"):(pending?(pending+" pending sync"):"Synced");
 const normalizedQuery=query.trim().toLowerCase();
 const navResults=normalizedQuery?visibleNav.filter(item=>[labelFor(viewer.role,item.id),item.label,item.keywords??""].join(" ").toLowerCase().includes(normalizedQuery)).slice(0,4):[];
 const recordResults=normalizedQuery?searchWorkspace(searchItems.filter(item=>allowed.includes(item.view as ViewKey)),normalizedQuery,8):[];
 const open=(id:ViewKey)=>{onView(id);setQuery("");};
 const NavButton=({item}:{item:NavItem})=><button key={item.id} className={view===item.id?"active":""} onClick={()=>open(item.id)}><item.icon size={18}/><span>{labelFor(viewer.role,item.id)}</span>{item.id==="signals"&&signalCount>0?<b>{signalCount}</b>:null}</button>;
 return <main className="shell" style={{"--brand":brand.primaryColor,"--accent":brand.accentColor} as React.CSSProperties}>
  <aside className="sidebar">
    <div className="brand"><span>D</span><div><strong>{appIdentity.name}</strong><small>{appIdentity.description}</small></div></div>
    <div className="school"><span>{brand.logoUrl?<img src={brand.logoUrl} alt=""/>:brand.shortName}</span><div><strong>{brand.name}</strong><small><Building2 size={11}/>{brand.city} · {brand.subsystem}</small></div></div>
    <nav className="role-nav">
      <div className="nav-context"><small>YOUR WORK</small><strong>{viewer.positionTitle||roleLabel(viewer.role)}</strong></div>
      <div className="nav-primary">{desktopPrimary.map(item=><NavButton key={item.id} item={item}/>)}</div>
      {desktopSecondary.length?<details className="nav-more" open={desktopSecondary.some(item=>item.id===view)?true:undefined}><summary><Menu size={17}/><span>More school work</span><small>{desktopSecondary.length}</small></summary><div>{desktopSecondary.map(item=><NavButton key={item.id} item={item}/>)}</div></details>:null}
    </nav>
    <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={17}/><span><strong>{connectivity}</strong><small>Audit trail active</small></span></div><div className="account"><CircleUserRound/><span><strong>{viewer.name}</strong><small>{viewer.positionTitle||roleLabel(viewer.role)}</small></span></div></div>
  </aside>
  <section className="workspace"><header>
    <div><span>{appIdentity.shortName} · {brand.shortName||"DREEM"} · {brand.city}</span><h1>{view==="studio"?"School settings":labelFor(viewer.role,view)}</h1></div>
    <div>
      <div className="dreem-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a workspace or task…"/>{navResults.length||recordResults.length?<div className="dreem-search-results">{recordResults.length?<><small className="search-section-label">SCHOOL RECORDS</small>{recordResults.map(item=><button key={item.id} onClick={()=>open(item.view as ViewKey)}><Search size={16}/><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><em>{item.kind.replaceAll("_"," ")}</em></button>)}</>:null}{navResults.length?<><small className="search-section-label">WORKSPACES</small>{navResults.map(item=><button key={item.id} onClick={()=>open(item.id)}><item.icon size={16}/><span><strong>{labelFor(viewer.role,item.id)}</strong><small>{item.label===labelFor(viewer.role,item.id)?item.keywords:item.label}</small></span></button>)}</>:null}</div>:normalizedQuery?<div className="dreem-search-results empty-search"><small>No matching school record or workspace.</small></div>:null}</div>
      <span className={"connectivity "+(online?"online":"offline")}>{connectivity}</span>
      <button className="language">EN / FR</button>
      {canOpenStudio&&view!=="studio"?<button className="feedback" onClick={()=>onView("studio")}><Settings2 size={15}/>Settings</button>:null}
      <button className="feedback" onClick={onFeedback}><MessageSquareMore size={15}/>{signalCount?"Messages":"Help"}</button>
    </div>
  </header>{children}</section>
  {mobileMenuOpen?<div className="mobile-more-backdrop" onClick={()=>setMobileMenuOpen(false)}><section className="mobile-more-menu" aria-label="More DREEM workspaces" onClick={e=>e.stopPropagation()}><header><strong>More</strong><button aria-label="Close" onClick={()=>setMobileMenuOpen(false)}><X/></button></header>{mobileMore.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>{onView(item.id);setMobileMenuOpen(false);}}><item.icon size={19}/><span>{labelFor(viewer.role,item.id)}</span></button>)}{canOpenStudio?<button className={view==="studio"?"active":""} onClick={()=>{onView("studio");setMobileMenuOpen(false);}}><Settings2 size={19}/><span>Settings</span></button>:null}</section></div>:null}
  <nav className="mobile-nav">{mobilePrimary.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>onView(item.id)}><item.icon size={19}/><span>{labelFor(viewer.role,item.id).split(" ")[0]}</span></button>)}{(mobileMore.length>0||canOpenStudio)?<button className={mobileMore.some(item=>item.id===view)||view==="studio"?"active":""} onClick={()=>setMobileMenuOpen(true)}><Menu size={19}/><span>More</span></button>:null}</nav>
 </main>;
}
export function EmptyState({title,body}:{title:string;body:string}){return <div className="empty"><UsersRound/><strong>{title}</strong><p>{body}</p></div>;}
