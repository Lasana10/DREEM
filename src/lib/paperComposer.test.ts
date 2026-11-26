import { describe,expect,it } from "vitest";
import { approvedQuestionsForClass, orderedApprovedQuestions, paperHasMixedLanguages, paperMatchesOneClassAndYear, paperTotalMarks } from "./paperComposer";
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

describe("school-aligned examination composition",()=>{
 const outcomes=[
  {id:"o",classId:"class-a",academicYearId:"2026",status:"active" as const},
  {id:"other",classId:"class-b",academicYearId:"2026",status:"active" as const},
  {id:"new-year",classId:"class-a",academicYearId:"2027",status:"active" as const},
  {id:"retired",classId:"class-a",academicYearId:"2026",status:"retired" as const},
 ];
 const question=(id:string,outcome_id:string,status:QuestionItem["status"]="approved")=>({...item(id,status,5),outcome_id});
 it("shows only moderated questions assigned to the chosen class",()=>{
  const available=approvedQuestionsForClass([
   question("a","o"),question("b","other"),question("c","retired"),question("d","o","submitted")
  ],outcomes,"class-a");
  expect(available.map(x=>x.id)).toEqual(["a"]);
 });
 it("rejects class mixing and academic-year mixing before printing or saving",()=>{
  expect(paperMatchesOneClassAndYear([question("a","o"),question("b","other")],outcomes,"class-a")).toBe(false);
  expect(paperMatchesOneClassAndYear([question("a","o"),question("b","new-year")],outcomes,"class-a")).toBe(false);
  expect(paperMatchesOneClassAndYear([question("a","o"),question("b","o")],outcomes,"class-a")).toBe(true);
 });
 it("rejects unapproved, retired and empty selections",()=>{
  expect(paperMatchesOneClassAndYear([question("x","o","submitted")],outcomes,"class-a")).toBe(false);
  expect(paperMatchesOneClassAndYear([question("x","retired")],outcomes,"class-a")).toBe(false);
  expect(paperMatchesOneClassAndYear([],outcomes,"class-a")).toBe(false);
 });
});
