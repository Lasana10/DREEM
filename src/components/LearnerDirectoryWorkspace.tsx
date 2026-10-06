import { ChevronLeft, ChevronRight, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { LearnerSummary, Role, SchoolBrand } from "../domain/types";
import type { AuthorityScope } from "../lib/authority";
import { loadLearnerDirectoryPage } from "../lib/learnerDirectory";
import { userFacingError } from "../lib/userFacingError";
import LearnersWorkspace from "./LearnersWorkspace";

export default function LearnerDirectoryWorkspace({brand,role,authorityScopes,initialLearners=[]}:{brand:SchoolBrand;role:Role;authorityScopes?:AuthorityScope[];initialLearners?:LearnerSummary[]}){
  const[rows,setRows]=useState<LearnerSummary[]>(initialLearners),[total,setTotal]=useState(initialLearners.length),[page,setPage]=useState(0),[query,setQuery]=useState(""),[draft,setDraft]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const pageSize=50;
  const load=useCallback(async(nextPage:number,nextQuery:string)=>{setBusy(true);setError("");try{const result=await loadLearnerDirectoryPage({page:nextPage,pageSize,query:nextQuery});setRows(result.rows);setTotal(result.total);setPage(result.page);}catch(reason){setError(userFacingError(reason,"The learner directory could not be loaded. Check your connection and try again."));}finally{setBusy(false);}},[]);
  useEffect(()=>{void load(0,"");},[load]);
  function search(event:FormEvent){event.preventDefault();const next=draft.trim();setQuery(next);void load(0,next);}
  const from=total?Math.min(total,page*pageSize+1):0,to=Math.min(total,(page+1)*pageSize),hasPrev=page>0,hasNext=(page+1)*pageSize<total;
  return <div className="learner-directory-workspace">
    <section className="content learner-directory-toolbar">
      <div className="role-hero"><div><span className="eyebrow">PEOPLE · LEARNERS</span><h2>{query?`${total} matching learner${total===1?"":"s"}`:`${total} learner${total===1?"":"s"} in this school`}</h2><p>Search the full school register. Results are loaded in pages so large schools stay complete and responsive.</p></div><div className="role-hero-status"><span className="status-pill"><UsersRound size={15}/>{from}–{to} of {total}</span></div></div>
      <form className="directory-search" onSubmit={search}><label><Search size={17}/><span className="sr-only">Search learners</span><input value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Search name, matricule or class" autoComplete="off"/></label><button className="primary" disabled={busy}>Search</button>{query?<button type="button" onClick={()=>{setDraft("");setQuery("");void load(0,"");}}>Clear</button>:null}</form>
      {error?<div className="form-status error" role="alert">{error}</div>:null}
      {busy?<p className="quiet-note">Loading learner records…</p>:null}
    </section>
    {!busy||rows.length?<LearnersWorkspace learners={rows} brand={brand} role={role} authorityScopes={authorityScopes}/>:null}
    <section className="content directory-pagination" aria-label="Learner directory pages"><span>{from}–{to} of {total}</span><div><button type="button" disabled={!hasPrev||busy} onClick={()=>void load(page-1,query)}><ChevronLeft/>Previous</button><button type="button" disabled={!hasNext||busy} onClick={()=>void load(page+1,query)}>Next<ChevronRight/></button></div></section>
  </div>;
}
