import type {QuestionItem} from "./questionBank";
export type ImportQuestion={
 outcomeCode:string;questionText:string;answerKey:string;markingGuide:string;sourceReference:string;
 language:"en"|"fr";questionType:"short_answer"|"multiple_choice"|"true_false";difficulty:"foundation"|"intermediate"|"advanced";points:number;choices:string[];
};
export type QuestionCsvPreview={rows:number;valid:ImportQuestion[];issues:string[];duplicates:number};
/** CSV preflight operates entirely in the browser and does not grant content approval. */
function csvRows(source:string):string[][]{
 const first=source.replace(/^\uFEFF/,"").split(/\r?\n/,1)[0]??"";
 let quoted=false,commas=0,semicolons=0;
 for(let i=0;i<first.length;i++){const c=first[i];if(c==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&c===",")commas++;else if(!quoted&&c===";")semicolons++;}
 const delimiter=semicolons>commas?";":",";
 const rows:string[][]=[];let row:string[]=[],field="",inside=false;
 const text=source.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(inside&&text[i+1]==='"'){field+='"';i++;}else if(inside)inside=false;else if(!field)inside=true;else throw new Error("Unexpected quotation mark in the question CSV.");}
  else if(c===delimiter&&!inside){row.push(field);field="";}
  else if((c==="\r"||c==="\n")&&!inside){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);field="";if(row.some(x=>x.trim()))rows.push(row);row=[];}
  else field+=c;
  if(rows.length>101)throw new Error("Import at most 100 questions per reviewed batch.");
 }
 if(inside)throw new Error("Unclosed quoted question in the CSV.");
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
const norm=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_");
export function questionSignature(outcomeCode:string,questionText:string){return `${norm(outcomeCode)}|${questionText.trim().toLowerCase().replace(/\s+/g," ")}`;}
export function previewQuestionCsv(source:string,validOutcomeCodes:string[],existing:Pick<QuestionItem,"outcome_id"|"question_text">[],outcomeCodesById:Record<string,string>):QuestionCsvPreview{
 const rows=csvRows(source);
 if(rows.length<2)throw new Error("Provide a header and at least one question.");
 const headers=rows[0].map(norm);const col=(names:string[])=>headers.findIndex(h=>names.includes(h));
 const indexes={outcome:col(["objective_code","outcome_code","code_competence","curriculum_code"]),question:col(["question","question_text","question_fr","question_en"]),answer:col(["answer","answer_key","correct_answer","reponse"]),guide:col(["marking_guide","marking_scheme","marking_criteria","bareme"]),source:col(["source_reference","source","paper_reference","reference"]),points:col(["marks","points","score"]),language:col(["language","langue"]),type:col(["question_type","type"]),difficulty:col(["difficulty","difficulte"]),choices:col(["choices","options"])};
 if(Object.entries(indexes).some(([key,i])=>["outcome","question","answer","guide","source","points"].includes(key)&&i<0))throw new Error("Required CSV columns: objective_code, question, answer, marking_guide, source_reference, marks.");
 if(new Set(headers).size!==headers.length)throw new Error("Duplicate CSV headings are not permitted.");
 const allowed=new Set(validOutcomeCodes.map(norm));
 const seen=new Set(existing.map(item=>questionSignature(outcomeCodesById[item.outcome_id]??"",item.question_text)));
 let duplicates=0;const issues:string[]=[],valid:ImportQuestion[]=[];
 rows.slice(1).forEach((r,i)=>{
  const line=i+2,at=(n:number)=>n<0?"":(r[n]??"").trim();
  const outcomeCode=at(indexes.outcome),questionText=at(indexes.question),answerKey=at(indexes.answer),markingGuide=at(indexes.guide),sourceReference=at(indexes.source);
  const points=Number(at(indexes.points)),language=(at(indexes.language)||"en").toLowerCase(),questionType=at(indexes.type)||"short_answer",difficulty=at(indexes.difficulty)||"foundation";
  const choices=at(indexes.choices)?at(indexes.choices).split("|").map(x=>x.trim()).filter(Boolean):[];
  if(r.length>headers.length){issues.push(`Row ${line}: too many fields; check CSV quotation.`);return;}
  if(!allowed.has(norm(outcomeCode))){issues.push(`Row ${line}: curriculum objective ${outcomeCode||"(missing)"} is not approved for this class and subject.`);return;}
  if(questionText.length<10||!answerKey||!markingGuide||!sourceReference||questionText.length>4000||answerKey.length>4000||sourceReference.length>500){issues.push(`Row ${line}: a valid question, answer, marking guide and original source are required.`);return;}
  if(!Number.isInteger(points)||points<1||points>100){issues.push(`Row ${line}: marks must be between 1 and 100.`);return;}
  if(!["en","fr"].includes(language)||!["short_answer","multiple_choice","true_false"].includes(questionType)||!["foundation","intermediate","advanced"].includes(difficulty)){issues.push(`Row ${line}: unsupported language, question type or difficulty.`);return;}
  if(questionType==="multiple_choice"&&(choices.length<2||choices.length>6)){issues.push(`Row ${line}: multiple-choice questions need 2–6 options separated by |.`);return;}
  const signature=questionSignature(outcomeCode,questionText);
  if(seen.has(signature)){duplicates++;issues.push(`Row ${line}: duplicate question found; skipped.`);return;}
  seen.add(signature);
  valid.push({outcomeCode,questionText,answerKey,markingGuide,sourceReference,points,language:language as ImportQuestion["language"],questionType:questionType as ImportQuestion["questionType"],difficulty:difficulty as ImportQuestion["difficulty"],choices});
 });
 return {rows:rows.length-1,valid,issues:issues.slice(0,100),duplicates};
}
