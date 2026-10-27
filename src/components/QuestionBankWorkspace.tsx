import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, CheckCircle, FileQuestion, ShieldCheck } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { fetchQuestionBank, reviewQuestion, saveQuestionDraft, submitQuestion, type QuestionDraft, type QuestionItem } from "../lib/questionBank";
import { userFacingError } from "../lib/userFacingError";
import AssessmentPaperComposer from "./AssessmentPaperComposer";

export default function QuestionBankWorkspace({workspace,teacher,reviewer}:{workspace:WorkspaceData;teacher:boolean;reviewer:boolean}){
 const [items,setItems]=useState<QuestionItem[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [selected,setSelected]=useState(""),[decision,setDecision]=useState<Record<string,"approved"|"returned">>({}),[notes,setNotes]=useState<Record<string,string>>({});
 const [editId,setEditId]=useState(""),[filter,setFilter]=useState<"all"|"approved"|"submitted">("all");
 const [type,setType]=useState<QuestionItem["question_type"]>("short_answer");
 const activeAssignments=workspace.academics.assignments.filter(a=>a.status==="active"&&(reviewer||a.teacherUserId===workspace.viewer.id));
 const outcomeIds=useMemo(()=>new Set(activeAssignments.flatMap(a=>workspace.academics.curriculumOutcomes.filter(o=>o.status==="active"&&o.academicYearId===a.academicYearId&&o.classId===a.classId&&o.subjectId===a.subjectId).map(o=>o.id))),[activeAssignments,workspace.academics.curriculumOutcomes]);
 const outcomes=workspace.academics.curriculumOutcomes.filter(o=>outcomeIds.has(o.id));
 const currentOutcome=outcomes.find(o=>o.id===selected)??outcomes[0];
 const reload=useCallback(async()=>{setLoading(true);try{setItems(await fetchQuestionBank());setError("");}catch(reason){setError(userFacingError(reason,"The question bank could not be loaded. Its database migration may be pending."));}finally{setLoading(false);}},[]);
 useEffect(()=>{void reload();},[reload]);
 const visible=items.filter(item=>filter==="all"||item.status===filter);
 const own=items.filter(item=>item.created_by===workspace.viewer.id);
 const pending=items.filter(item=>item.status==="submitted");
 const [editing,setEditing]=useState<QuestionItem|null>(null);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const f=new FormData(form);
  if(!currentOutcome){setError("Choose an approved curriculum objective before writing a question.");return;}
  const choices=type==="multiple_choice"?String(f.get("choices")??"").split("\n").map(x=>x.trim()).filter(Boolean):[];
  if(type==="multiple_choice"&&(choices.length<2||choices.length>6)){setError("Enter 2–6 answer choices, each on a separate line.");return;}
  const draft:QuestionDraft={outcomeId:currentOutcome.id,questionId:editId||undefined,language:String(f.get("language")) as QuestionDraft["language"],questionType:type,difficulty:String(f.get("difficulty")) as QuestionDraft["difficulty"],questionText:String(f.get("question")).trim(),choices,answerKey:String(f.get("answer")).trim(),markingGuide:String(f.get("guide")).trim(),points:Number(f.get("points")),sourceReference:String(f.get("source")).trim()};
  setBusy(true);setError("");setMessage("");
  try{await saveQuestionDraft(draft);setMessage("Question draft saved. Submit it for independent approval when ready.");setEditId("");setEditing(null);form.reset();await reload();}
  catch(reason){setError(userFacingError(reason,"The question draft was not saved."));}finally{setBusy(false);}
 }
 async function act(id:string,action:"submit"|"review"){
  setBusy(true);setError("");setMessage("");
  try{if(action==="submit"){await submitQuestion(id);setMessage("Question submitted for review.");}else{const note=(notes[id]??"").trim();if(note.length<5)throw new Error("Explain your review decision (at least five characters).");await reviewQuestion(id,decision[id]??"approved",note);setMessage("Independent question review recorded.");}await reload();}
  catch(reason){setError(userFacingError(reason,"The question action was not recorded."));}finally{setBusy(false);}
 }
 function beginEdit(item:QuestionItem){setEditing(item);setEditId(item.id);setSelected(item.outcome_id);setType(item.question_type);}
 return <section className="excellence-question-bank">
  <div className="excellence-register-header"><div><span className="excellence-kicker-dark"><FileQuestion size={15}/> CURRICULUM · ASSESSMENT STUDIO</span><h2>Question bank</h2><p>Build reusable questions from approved objectives. Each draft requires independent academic review before joining the approved bank.</p></div><span className="excellence-question-kpi"><BookOpen size={19}/>{items.filter(q=>q.status==="approved").length} approved</span></div>
  {error&&<p role="alert" className="form-status error">{error}</p>}{message&&<p role="status" className="form-status success">{message}</p>}
  {teacher&&<div className="excellence-question-author"><h3>{editing?"Edit returned question":"Prepare an assessment question"}</h3>
   {outcomes.length===0?<p className="excellence-register-status">No active curriculum objective is assigned to your classes yet. Academic leadership must approve and assign a curriculum before questions can be authored.</p>:
   <form key={editing?.id??"new"} onSubmit={save}>
    <label>Curriculum objective<select value={currentOutcome?.id??""} onChange={e=>setSelected(e.target.value)}>{outcomes.map(o=><option value={o.id} key={o.id}>{o.code} · {o.titleEn}</option>)}</select></label>
    <div className="excellence-register-fields"><label>Language<select name="language" defaultValue={editing?.language??"en"}><option value="en">English</option><option value="fr">Français</option></select></label><label>Question type<select name="type" value={type} onChange={e=>setType(e.target.value as QuestionItem["question_type"])}><option value="short_answer">Short answer</option><option value="multiple_choice">Multiple choice</option><option value="true_false">True / false</option></select></label><label>Difficulty<select name="difficulty" defaultValue={editing?.difficulty??"foundation"}><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>
    <label>Question<textarea required minLength={10} maxLength={4000} rows={3} name="question" defaultValue={editing?.question_text??""}/></label>
    {type==="multiple_choice"&&<label>Answer choices (one per line)<textarea name="choices" required rows={4} defaultValue={editing?.choices.join("\n")??""}/></label>}
    <div className="excellence-register-fields"><label>Correct answer<input name="answer" required maxLength={4000} defaultValue={editing?.answer_key??""}/></label><label>Marks<input type="number" min="1" max="100" name="points" required defaultValue={editing?.points??1}/></label><label>Source reference<input name="source" maxLength={500} placeholder="Approved syllabus, book or page" defaultValue={editing?.source_reference??""}/></label></div>
    <label>Marking guide<textarea name="guide" rows={2} defaultValue={editing?.marking_guide??""} placeholder="Method, rubric or acceptable alternative answers"/></label>
    <div className="excellence-question-actions"><button type="submit" className="excellence-register-action" disabled={busy}>Save draft</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setEditId("");}} className="excellence-cancel">Cancel edit</button>}</div>
   </form>}
  </div>}
  <div className="excellence-question-list"><div className="excellence-question-toolbar"><div><h3>Curated questions</h3><small>{pending.length} pending moderation · {own.length} authored by this account</small></div><label>Show<select aria-label="Filter questions" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All accessible</option><option value="approved">Approved</option><option value="submitted">Awaiting review</option></select></label></div>
   {loading?<p role="status">Loading questions…</p>:visible.length===0?<p>No questions match this view yet.</p>:visible.map(item=>{
    const o=workspace.academics.curriculumOutcomes.find(x=>x.id===item.outcome_id);
    return <article key={item.id} className="excellence-register-item"><div className="excellence-register-item-top"><div><b>{o?.code??"Curriculum objective"} · {item.language.toUpperCase()} · {item.points} marks</b><small>{item.difficulty} · {item.question_type.replace("_"," ")}</small></div><span className="excellence-register-state">{item.status}</span></div><p className="excellence-question-text">{item.question_text}</p>
     {item.choices.length>0&&<ol className="excellence-choices">{item.choices.map((choice,index)=><li key={index}>{choice}</li>)}</ol>}
     <details><summary>Answer key and marking guide (staff only)</summary><p><strong>Answer:</strong> {item.answer_key}</p>{item.marking_guide&&<p><strong>Marking guide:</strong> {item.marking_guide}</p>}{item.source_reference&&<p><strong>Source:</strong> {item.source_reference}</p>}</details>
     {item.review_note&&<p className="excellence-register-status">{item.review_note}</p>}
     {item.created_by===workspace.viewer.id&&["draft","returned"].includes(item.status)&&<div className="excellence-question-actions"><button type="button" disabled={busy} onClick={()=>beginEdit(item)} className="excellence-cancel">Edit draft</button>{item.status==="draft"&&<button disabled={busy} onClick={()=>void act(item.id,"submit")} className="excellence-register-action">Submit for approval</button>}</div>}
     {reviewer&&item.status==="submitted"&&item.created_by!==workspace.viewer.id&&<div className="excellence-register-review"><label>Decision<select aria-label="Question decision" value={decision[item.id]??"approved"} onChange={e=>setDecision(prev=>({...prev,[item.id]:e.target.value as "approved"|"returned"}))}><option value="approved">Approve question</option><option value="returned">Return for correction</option></select></label><label>Review note<input aria-label="Question review note" value={notes[item.id]??""} onChange={e=>setNotes(prev=>({...prev,[item.id]:e.target.value}))} placeholder="Record checking findings"/></label><button type="button" disabled={busy} onClick={()=>void act(item.id,"review")}><ShieldCheck size={16}/> Record review</button></div>}
     {item.status==="approved"&&<p className="excellence-question-approved"><CheckCircle size={15}/> Approved for reuse in teacher-authored assessments</p>}
    </article>;
   })}</div>
  <AssessmentPaperComposer items={items} schoolName={workspace.brand.name} classes={workspace.setup.classes}/>
 </section>;
}
