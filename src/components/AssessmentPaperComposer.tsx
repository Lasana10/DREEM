import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileText, GraduationCap, ListChecks, ShieldCheck } from "lucide-react";
import type { QuestionItem } from "../lib/questionBank";
import { orderedApprovedQuestions, paperHasMixedLanguages, paperTotalMarks } from "../lib/paperComposer";
import { listExamPapers, saveExamPaper, type SavedExamPaper } from "../lib/examPapers";
import { userFacingError } from "../lib/userFacingError";

type PaperKind="questions"|"marking";
export default function AssessmentPaperComposer({items,schoolName}:{items:QuestionItem[];schoolName:string}){
 const approved=useMemo(()=>items.filter(item=>item.status==="approved"),[items]);
 const [chosen,setChosen]=useState<string[]>([]);
 const [title,setTitle]=useState("Continuous Assessment");
 const [className,setClassName]=useState("");
 const [term,setTerm]=useState("");
 const [duration,setDuration]=useState(45);
 const [language,setLanguage]=useState<"en"|"fr">("en");
 const [mode,setMode]=useState<PaperKind>("questions");
 const [onlyLanguage,setOnlyLanguage]=useState(true);
 const [saved,setSaved]=useState<SavedExamPaper[]>([]);
 const [activePaper,setActivePaper]=useState<SavedExamPaper|null>(null);
 const [working,setWorking]=useState(false),[saveError,setSaveError]=useState(""),[savedMessage,setSavedMessage]=useState("");
 const reloadPapers=useCallback(async()=>{try{setSaved(await listExamPapers());}catch(reason){setSaveError(userFacingError(reason,"Saved papers are unavailable. Check the database migration."));}},[]);
 useEffect(()=>{void reloadPapers();},[reloadPapers]);
 const selected=useMemo(()=>activePaper ? activePaper.snapshot.map(item=>({...item,school_id:activePaper.school_id,difficulty:"foundation" as const,source_reference:"",status:"approved" as const,created_by:activePaper.created_by,review_note:null})) : orderedApprovedQuestions(approved,chosen),[approved,chosen,activePaper]);
 const visible=approved.filter(item=>!onlyLanguage||item.language===language);
 const sum=paperTotalMarks(selected);
 const mixed=paperHasMixedLanguages(selected);
 const toggle=(id:string)=>{setActivePaper(null);setChosen(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);};
 const restore=(id:string)=>{const paper=saved.find(p=>p.id===id);if(!paper)return;setActivePaper(paper);setChosen(paper.question_ids);setTitle(paper.title);setTerm(paper.term_label);setDuration(paper.duration_minutes);setClassName("Class-linked saved paper");setSavedMessage("Saved revision loaded with its original question and marking snapshots.");setSaveError("");};
 const createNew=()=>{setActivePaper(null);setChosen([]);setTitle("Continuous Assessment");setClassName("");setTerm("");setDuration(45);setSavedMessage("");};
 async function persist(){setWorking(true);setSaveError("");setSavedMessage("");try{const id=await saveExamPaper({title,termLabel:term,durationMinutes:duration,questionIds:chosen,paperId:activePaper?.id});await reloadPapers();setSavedMessage("Exam paper saved with its approved questions and marking snapshot. Reference: "+id.slice(0,8));}catch(reason){setSaveError(userFacingError(reason,"This exam draft was not saved. Check school authorization and selected approved questions."));}finally{setWorking(false);}}
 const print=(kind:PaperKind)=>{setMode(kind);window.setTimeout(()=>window.print(),50);};
 return <section className="excellence-paper">
  <div className="excellence-paper-head"><div><span className="excellence-kicker-dark"><FileText size={15}/> PRINTABLE ASSESSMENTS</span><h2>Examination paper composer</h2><p>Choose independently approved questions, arrange them and produce a pupil paper or staff-only marking guide. Paper composition is local until printed or saved by your browser.</p></div><span className="excellence-paper-total"><GraduationCap size={18}/>{sum} marks</span></div>
  <div className="excellence-paper-form">
   <div className="excellence-paper-saved"><label>Saved exam papers<select aria-label="Saved exam papers" value={activePaper?.id??""} onChange={e=>e.target.value?restore(e.target.value):createNew()}><option value="">New paper</option>{saved.map(p=><option value={p.id} key={p.id}>{p.title} · Revision {p.revision} · {p.total_marks} marks</option>)}</select></label><button type="button" className="excellence-cancel" onClick={createNew}>New paper</button></div>
   {saveError&&<p className="form-status error" role="alert">{saveError}</p>}{savedMessage&&<p className="form-status success" role="status">{savedMessage}</p>}{activePaper&&<p className="excellence-register-status">Viewing saved revision {activePaper.revision}. Printing uses the stored question snapshot. Saving a revision validates every question against the current approved bank.</p>}
   <div className="excellence-register-fields"><label>Assessment title<input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></label><label>Class or level<input value={className} maxLength={80} placeholder="e.g. Class 5" onChange={e=>setClassName(e.target.value)}/></label><label>Term / period<input value={term} maxLength={80} onChange={e=>setTerm(e.target.value)}/></label></div>
   <div className="excellence-register-fields"><label>Duration (minutes)<input type="number" min={1} max={300} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label>Language<select value={language} onChange={e=>setLanguage(e.target.value as "en"|"fr")}><option value="en">English</option><option value="fr">Français</option></select></label><label>Question filtering<select value={onlyLanguage?"yes":"no"} onChange={e=>setOnlyLanguage(e.target.value==="yes")}><option value="yes">Chosen language only</option><option value="no">Both languages</option></select></label></div>
  </div>
  <div className="excellence-paper-selector"><div className="excellence-question-toolbar"><div><h3>Approved question library</h3><small>{visible.length} available · {selected.length} selected</small></div><button className="excellence-cancel" onClick={()=>{setChosen([]);setActivePaper(null);}} disabled={!chosen.length} type="button">Clear selection</button></div>
  {visible.length===0?<p>No approved questions are available in this language yet. Questions must pass academic moderation before paper assembly.</p>:
   <div className="excellence-paper-options">{visible.map(item=><label key={item.id} className="excellence-paper-option"><input type="checkbox" checked={chosen.includes(item.id)} onChange={()=>toggle(item.id)}/><span><strong>{item.question_text}</strong><small>{item.points} marks · {item.language.toUpperCase()} · {item.difficulty}</small></span></label>)}</div>}
  </div>
  {selected.length>0&&<div className="excellence-paper-order"><strong>Question order</strong><p>Selected questions print in the order shown below. Reorder them before printing.</p>{selected.map((item,i)=><div key={item.id}><span><b>{i+1}.</b> {item.question_text.slice(0,115)}{item.question_text.length>115?"…":""}</span><span><button type="button" aria-label={`Move question ${i+1} up`} disabled={i===0} onClick={()=>setChosen(prev=>{const next=[...prev];[next[i-1],next[i]]=[next[i],next[i-1]];return next;})}>↑</button><button type="button" aria-label={`Move question ${i+1} down`} disabled={i===selected.length-1} onClick={()=>setChosen(prev=>{const next=[...prev];[next[i],next[i+1]]=[next[i+1],next[i]];return next;})}>↓</button></span></div>)}</div>}
  {mixed&&<p className="excellence-register-status">This paper contains questions in both English and French. Confirm that this matches your school's approved assessment plan.</p>}
  <div className="excellence-question-actions"><button type="button" className="excellence-register-action" disabled={working||!selected.length||!title.trim()||!className.trim()||!!activePaper} onClick={()=>void persist()}>Save exam draft</button><button type="button" className="excellence-register-action" disabled={!selected.length||!title.trim()||!className.trim()||duration<1} onClick={()=>print("questions")}><FileDown size={17}/> Print / save pupil paper</button><button type="button" className="excellence-cancel" disabled={!selected.length||!title.trim()||!className.trim()} onClick={()=>print("marking")}><ListChecks size={17}/> Print staff marking guide</button></div>
  <p className="excellence-weekly-disclaimer"><ShieldCheck size={15}/> Only approved questions may be assembled. Printing a paper does not publish learner results or expose answer keys on the pupil version. Save using your browser's print-to-PDF option if needed.</p>
  <div className="excellence-print-sheet" aria-label={mode==="questions"?"Pupil examination paper":"Confidential marking guide"}>
   <header><p className="excellence-print-brand">{schoolName||"SCHOOL"}</p><h1>{title}</h1><p>{className} · {term} · {duration} minutes · {sum} marks</p>{mode==="marking"&&<strong>STAFF ONLY — CONFIDENTIAL MARKING GUIDE</strong>}</header>
   {mode==="questions"&&<div className="excellence-print-student"><span>Name: ____________________________________</span><span>Date: __________________</span></div>}
   {selected.map((item,index)=><article key={item.id}><div className="excellence-print-question"><b>{index+1}.</b><div><p>{item.question_text}</p>{item.choices.length>0&&<ol type="A">{item.choices.map((choice,i)=><li key={i}>{choice}</li>)}</ol>}{mode==="marking"&&<div className="excellence-print-answer"><b>Answer:</b> {item.answer_key}{item.marking_guide&&<p><b>Marking criteria:</b> {item.marking_guide}</p>}</div>}</div><strong>({item.points} marks)</strong></div></article>)}
   <footer>Prepared using DREEM School Excellence · Approved question bank</footer>
  </div>
 </section>;
}
