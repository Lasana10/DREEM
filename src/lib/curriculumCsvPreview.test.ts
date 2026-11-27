import {describe,expect,it} from "vitest";
import {previewCurriculumCsv} from "./curriculumCsvPreview";
describe("reviewed school curriculum CSV preflight",()=>{
 it("supports French semicolon imports and protects source references",()=>{
  const csv="code;title_en;title_fr;description;source_reference\nM4-FR-01;Identify fractions;Identifier les fractions;Compare 1/2 and 1/4;Syllabus section 4\nM4-FR-02;Add fractions;Additionner les fractions;;Approved book p. 12";
  const data=previewCurriculumCsv(csv);
  expect(data.total).toBe(2);expect(data.valid.length).toBe(2);
  expect(data.valid[1].reference).toBe("Approved book p. 12");
 });
 it("rejects rows without provenance and skips duplicate objectives",()=>{
  const csv="code,title_en,source_reference\nK1,First topic,Book 1\nK1,Repeated topic,Book 2\nK2,Second topic,";
  const result=previewCurriculumCsv(csv,["K0"]);
  expect(result.valid.map(x=>x.code)).toEqual(["K1"]);expect(result.duplicates).toBe(1);expect(result.issues.length).toBe(2);
  expect(previewCurriculumCsv("code,title_en,source_reference\nK1,First topic,Book 1",["k1"]).valid).toHaveLength(0);
 });
 it("parses quoted names and embedded newlines, preserving text verbatim",()=>{
  const csv='code,title_en,description,source_reference\nK1,"Explain 1, 2 and 3","Line one\nLine two","Document, p. 3"';
  const p=previewCurriculumCsv(csv);
  expect(p.valid[0].titleEn).toBe("Explain 1, 2 and 3");
  expect(p.valid[0].description).toBe("Line one\nLine two");
 });
 it("does not accept unstructured or unsigned files",()=>{
  expect(()=>previewCurriculumCsv("code,title_en\nK1,First topic")).toThrow(/source_reference/);
  expect(()=>previewCurriculumCsv('code,title_en,source_reference\nK1,"Unclosed text,Book')).toThrow(/Unclosed/);
  expect(()=>previewCurriculumCsv("code,title_en,source_reference")).toThrow(/at least one/);
 });
});
