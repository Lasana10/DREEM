import {useMemo,useState,type ChangeEvent} from "react";
import {FileSpreadsheet,ShieldCheck} from "lucide-react";
import type {WorkspaceData} from "../lib/repository";
import {saveQuestionDraft,type QuestionItem} from "../lib/questionBank";
import {previewQuestionCsv,type QuestionCsvPreview} from "../lib/questionCsvPreview";
import {userFacingError} from "../lib/userFacingError";

/** Author-controlled Question Box import: drafts only, never published or auto-approved. */
export default function QuestionImportPanel({workspace,items,onReload}:{workspace:WorkspaceData;items:QuestionItem[];onReload:()=>Promise<void>}){
 const assignments=workspace.academics.assignments.filter(a=>a.status==="active"&&a.teacherUserId===workspace.viewer.id);
 const [assignmentId,setAssignmentId]=useState("");
 const [preview,setPreview]=useState<QuestionCsvPreview|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const assignment=assignments.find(a=>a.id===assignmentId);
 const outcomes=useMemo(()=>workspace.academics.curriculumOutcomes.filter(o=>o.status==="active"&&o.academicYearId===assignment?.academicYearId&&o.classId===assignment?.classId&&o.subjectId===assignment?.subjectId),[workspace.academics.curriculumOutcomes,assignment]);
 const codeToId=Object.fromEntries(outcomes.map(o=>[o.code.trim().toLowerCase(),o.id]));
 const idToCode=Object.fromEntries(outcomes.map(o=>[o.id,o.code]));
 function reset(){setPreview(null);setError("");setMessage("");}
 async function inspect(event:ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];reset();
  if(!file)return;
  if(file.size>1024*1024){setError("Limit past-question files to 1 MB. Split larger exports by class and subject.");event.currentTarget.value="";return;}
  try{setPreview(previewQuestionCsv(await file.text(),outcomes.map(o=>o.code),items,idToCode));}
  catch(reason){setError(userFacingError(reason,"Could not inspect the past-question CSV. No questions were imported."));}
  finally{event.currentTarget.value="";}
 }
 async function createDrafts(){
  if(!assignment||!preview?.valid.length||preview.issues.length){setError("Select an assigned class and a clean, reviewed question file first.");return;}
  if(!window.confirm(`Confirm you have independently checked all ${preview.valid.length} questions, their answers, marking guides and source rights for ${assignment.className} · ${assignment.subjectName}? They will be saved as drafts, NOT approved questions.`))return;
  let saved=0;setBusy(true);setError("");setMessage("");
  try{
   for(const q of preview.valid){
    const outcomeId=codeToId[q.outcomeCode.trim().toLowerCase()];
    if(!outcomeId){setError(`Objective ${q.outcomeCode} is no longer available. Recheck the source.`);break;}
    try{await saveQuestionDraft({outcomeId,language:q.language,questionType:q.questionType,difficulty:q.difficulty,questionText:q.questionText,choices:q.choices,answerKey:q.answerKey,markingGuide:q.markingGuide,points:q.points,sourceReference:q.sourceReference});saved++;}
    catch(reason){setError(`Stopped at ${q.outcomeCode}: ${userFacingError(reason,"Question not saved")}. ${saved} earlier drafts were saved; reconcile before retrying.`);break;}
   }
   setMessage(`${saved} / ${preview.valid.length} question drafts saved. Submit and moderate each question before exam-paper reuse.`);
   await onReload();
  }catch(reason){setError(userFacingError(reason,"Question drafts may have been saved, but refresh failed. Verify existing records before trying again."));}
  finally{setBusy(false);setPreview(null);}
 }
 return <section className="panel" aria-label="Past questions and marking guides import" style={{marginTop:16}}>
  <div className="panel-title"><FileSpreadsheet/><div><span>PAST PAPERS · MARKING GUIDES</span><h3>Bring approved teaching materials into the Question Box</h3><p>Inspect past questions, answers and marking schemes on this device. Drafts remain confidential and require independent academic approval.</p></div></div>
  <div className="settings-form">
   <label>My teaching assignment<select value={assignmentId} onChange={e=>{setAssignmentId(e.target.value);reset();}}><option value="">Choose your class and subject</option>{assignments.map(a=><option value={a.id} key={a.id}>{a.className} · {a.subjectName}</option>)}</select></label>
   {assignment&&!outcomes.length&&<p className="form-status" role="status">No active curriculum objectives are linked to this assignment. Academic leadership must first approve the curriculum.</p>}
   <p className="quiet-note">CSV columns: <code>objective_code,question,answer,marking_guide,source_reference,marks,language,question_type,difficulty,choices</code>. For multiple-choice questions, separate choices with a | character. All materials must be lawfully reusable.</p>
   <label>Inspect past-question CSV<input type="file" accept=".csv,text/csv" aria-label="Inspect past-question CSV" onChange={event=>void inspect(event)} disabled={busy||!outcomes.length}/></label>
  </div>
  {error&&<p className="form-status error" role="alert">{error}</p>}
  {message&&<p className="form-status success" role="status">{message}</p>}
  {preview&&<div className="studio-stage-body">
   <p role="status">{preview.rows} question rows · {preview.valid.length} ready for review · {preview.duplicates} duplicates · {preview.issues.length} issues</p>
   {preview.issues.length>0&&<div className="form-status error"><strong>Correct the source before import:</strong><ul>{preview.issues.slice(0,8).map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>}
   <div className="compact-table">{preview.valid.slice(0,5).map((q,i)=><div className="document-row" key={i}><strong>{q.outcomeCode} · {q.points} marks</strong><span>{q.questionText}</span><small>Source: {q.sourceReference} · marking guide included</small></div>)}</div>
   <p className="quiet-note"><ShieldCheck size={15}/> Author review is not academic approval. Answer keys and marking guides must remain restricted to authorised staff.</p>
   <button type="button" className="primary" disabled={busy||!preview.valid.length||preview.issues.length>0} onClick={()=>void createDrafts()}>{busy?"Saving private drafts…":"Confirm review and save draft questions"}</button>
  </div>}
 </section>;
}
