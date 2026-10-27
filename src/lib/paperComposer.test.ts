import { describe,expect,it } from "vitest";
import { orderedApprovedQuestions, paperHasMixedLanguages, paperTotalMarks } from "./paperComposer";
import type { QuestionItem } from "./questionBank";
const item=(id:string,status:QuestionItem["status"],points:number,language:QuestionItem["language"]="en"):QuestionItem=>({
 id,school_id:"s",outcome_id:"o",language,question_type:"short_answer",difficulty:"foundation",
 question_text:"Explain an important concept",choices:[],answer_key:"Answer",marking_guide:"",
 points,source_reference:"",status,created_by:"t",review_note:null,
});
describe("approved assessment composition",()=>{
 const items=[item("a","approved",3),item("b","submitted",4),item("c","approved",7,"fr")];
 it("never includes unapproved questions even when explicitly selected",()=>{
  expect(orderedApprovedQuestions(items,["b","a"]).map(x=>x.id)).toEqual(["a"]);
 });
 it("preserves manual order and removes duplicate choices",()=>{
  expect(orderedApprovedQuestions(items,["c","a","c"]).map(x=>x.id)).toEqual(["c","a"]);
 });
 it("calculates total marks from selected items",()=>{
  expect(paperTotalMarks(orderedApprovedQuestions(items,["c","a"]))).toBe(10);
 });
 it("warns when approved questions mix languages",()=>{
  expect(paperHasMixedLanguages(orderedApprovedQuestions(items,["a","c"]))).toBe(true);
  expect(paperHasMixedLanguages(orderedApprovedQuestions(items,["a"]))).toBe(false);
 });
});
