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
