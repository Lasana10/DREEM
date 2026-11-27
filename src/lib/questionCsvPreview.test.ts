import {describe,expect,it} from "vitest";
import {previewQuestionCsv,questionSignature} from "./questionCsvPreview";
describe("curriculum-linked past-question CSV intake",()=>{
 const columns="objective_code;question;answer;marking_guide;source_reference;marks;language;question_type;difficulty;choices";
 it("parses French spreadsheets with answers, marking guides and linked curriculum",()=>{
  const csv=`${columns}\nMATH-1;What is 4 plus 3?;7;Award 2 marks for 7;School test 2024;2;en;short_answer;foundation;`;
  const result=previewQuestionCsv(csv,["MATH-1"],[],{});
  expect(result.valid).toHaveLength(1);
  expect(result.valid[0]).toMatchObject({answerKey:"7",markingGuide:"Award 2 marks for 7",points:2,questionType:"short_answer"});
 });
 it("keeps quoted commas and supports multiple-choice options",()=>{
  const csv='objective_code,question,answer,marking_guide,source_reference,marks,language,question_type,difficulty,choices\nMAT-1,"Which pair, A or B, is correct?","A","A = 5; B = 4","Past paper 2025",3,fr,multiple_choice,intermediate,"A = 5|B = 4"';
  expect(previewQuestionCsv(csv,["MAT-1"],[],{}).valid[0].choices).toEqual(["A = 5","B = 4"]);
 });
 it("refuses missing marking guides, sources and foreign-class objectives",()=>{
  const csv=`${columns}\nOTHER;What is three plus four?;7;One mark;Original;1;en;short_answer;foundation;\nMAT-1;What is three plus four?;7;;Original;1;en;short_answer;foundation;`;
  const result=previewQuestionCsv(csv,["MAT-1"],[],{});
  expect(result.valid).toHaveLength(0);expect(result.issues).toHaveLength(2);
 });
 it("detects existing questions and in-file duplicates without creating replacements",()=>{
  const csv=`${columns}\nMAT-1;What is three plus four?;7;One mark;Source;1;en;short_answer;foundation;\nMAT-1;What is three plus four?;7;One mark;Source;1;en;short_answer;foundation;`;
  const result=previewQuestionCsv(csv,["MAT-1"],[],{});
  expect(result.duplicates).toBe(1);
  const known=previewQuestionCsv(csv,["MAT-1"],[{outcome_id:"o",question_text:"What is three plus four?"}],{o:"MAT-1"});
  expect(known.valid).toHaveLength(0);
  expect(questionSignature("MAT-1","  What is three plus four?  ")).toBe(questionSignature("mat-1","What is three plus four?"));
 });
 it("rejects missing required headers and malformed quoted data",()=>{
  expect(()=>previewQuestionCsv("objective_code,question,marks\nMATH-1,Question one,2",["MATH-1"],[],{})).toThrow(/Required CSV/);
  expect(()=>previewQuestionCsv('objective_code,question,answer,marking_guide,source_reference,marks\nMATH-1,"Unclosed,7,Guide,Source,2',["MATH-1"],[],{})).toThrow(/Unclosed/);
 });
});
