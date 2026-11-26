import type { QuestionItem } from "./questionBank";

export function orderedApprovedQuestions(items:QuestionItem[],ids:string[]):QuestionItem[]{
 const available=new Map(items.filter(x=>x.status==="approved").map(x=>[x.id,x]));
 return [...new Set(ids)].flatMap(id=>{const item=available.get(id);return item?[item]:[];});
}
export function paperTotalMarks(items:QuestionItem[]):number {
 return items.reduce((total,item)=>total+item.points,0);
}
export function paperHasMixedLanguages(items:QuestionItem[]):boolean {
 return new Set(items.map(x=>x.language)).size>1;
}

export type PaperCurriculumOutcome={id:string;classId:string;academicYearId:string;status:"draft"|"active"|"retired"};
/** Only questions from active objectives assigned to the selected class may enter a paper. */
export function approvedQuestionsForClass(items:QuestionItem[],outcomes:PaperCurriculumOutcome[],classId:string):QuestionItem[]{
 if(!classId)return[];
 const allowed=new Set(outcomes.filter(o=>o.classId===classId&&o.status==="active").map(o=>o.id));
 return items.filter(item=>item.status==="approved"&&allowed.has(item.outcome_id));
}
/** The server also enforces this; check before preview/printing so staff get a clear explanation. */
export function paperMatchesOneClassAndYear(items:QuestionItem[],outcomes:PaperCurriculumOutcome[],classId:string):boolean{
 if(!classId||!items.length)return false;
 const byId=new Map(outcomes.filter(o=>o.status==="active").map(o=>[o.id,o]));
 const years=new Set<string>();
 for(const item of items){
  const outcome=byId.get(item.outcome_id);
  if(item.status!=="approved"||!outcome||outcome.classId!==classId)return false;
  years.add(outcome.academicYearId);
 }
 return years.size===1;
}
