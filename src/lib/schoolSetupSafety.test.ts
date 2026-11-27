import {describe,expect,it} from "vitest";
import type {SchoolSetup} from "../domain/types";
import {validateSchoolSetup} from "./schoolSetupSafety";
const setup:SchoolSetup={
 academicYears:[{id:"y26",name:"2026 / 2027",startsOn:"2026-09-01",endsOn:"2027-07-31",status:"active"}],
 terms:[{id:"t1",academicYearId:"y26",name:"Term 1",startsOn:"2026-09-01",endsOn:"2026-12-18",orderIndex:1}],
 classes:[{id:"c1",academicYearId:"y26",name:"Primary 4",sectionName:"",streamName:"",levelName:"Primary"}],
 subjects:[{id:"s1",name:"Mathematics",code:"MATH",subsystem:"bilingual",gradingWeight:1}],
};
describe("school structure preservation and activation prerequisites",()=>{
 it("accepts a properly scoped academic year without requiring new schools to be created",()=>{
  expect(validateSchoolSetup(setup)).toEqual([]);
 });
 it("blocks two simultaneously active years",()=>{
  expect(validateSchoolSetup({...setup,academicYears:[...setup.academicYears,{id:"y27",name:"2027 / 2028",startsOn:"2027-09-01",endsOn:"2028-07-31",status:"active"}]})).toContain("Only one academic year may be active at a time.");
 });
 it("blocks activation without assigned classes or terms",()=>{
  expect(validateSchoolSetup({...setup,classes:[],terms:[]})).toEqual(expect.arrayContaining([expect.stringContaining("needs at least one linked term"),expect.stringContaining("needs assigned classes")]));
 });
 it("blocks orphan and out-of-year terms and classes",()=>{
  expect(validateSchoolSetup({...setup,terms:[{...setup.terms[0],startsOn:"2026-08-01"}],classes:[{...setup.classes[0],academicYearId:"missing"}]})).toEqual(expect.arrayContaining([expect.stringContaining("falls outside"),expect.stringContaining("unknown academic year")]));
 });
 it("blocks duplicate subject codes and reversed year dates",()=>{
  expect(validateSchoolSetup({...setup,academicYears:[{...setup.academicYears[0],startsOn:"2027-08-01"}],subjects:[...setup.subjects,{...setup.subjects[0],id:"s2",name:"Advanced math"}]})).toEqual(expect.arrayContaining([expect.stringContaining("ends before"),expect.stringContaining("Duplicate subject code")]));
 });
 it("allows historical planning years to remain configured without forcing premature activation",()=>{
  expect(validateSchoolSetup({...setup,academicYears:setup.academicYears.map(y=>({...y,status:"planning" as const}))})).toEqual([]);
 });
});
