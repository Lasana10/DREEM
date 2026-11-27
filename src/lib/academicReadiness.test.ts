import {describe,expect,it} from "vitest";
import {demoSetup} from "../domain/demo";
import {academicReadiness,academicActionMatchesYear} from "./academicReadiness";
describe("live academic year activation",()=>{
 it("accepts only a year with linked terms and classes",()=>{
  expect(academicReadiness(demoSetup).ready).toBe(true);
  expect(academicActionMatchesYear("ay-1","class-1","term-1",demoSetup)).toBe(true);
 });
 it("rejects planning years despite populated historical classes and timetables",()=>{
  const setup={...demoSetup,academicYears:demoSetup.academicYears.map(y=>({...y,status:"planning" as const}))};
  expect(academicReadiness(setup).ready).toBe(false);
  expect(academicReadiness(setup).missing).toContain("active academic year");
  expect(academicActionMatchesYear("ay-1","class-1","term-1",setup)).toBe(false);
 });
 it("rejects classes and terms belonging to a different year",()=>{
  expect(academicActionMatchesYear("ay-1","absent","term-1",demoSetup)).toBe(false);
  expect(academicActionMatchesYear("ay-1","class-1","other-term",demoSetup)).toBe(false);
  expect(academicActionMatchesYear("other","class-1","term-1",demoSetup)).toBe(false);
 });
 it("rejects multiple active years and missing active-year assignments",()=>{
  const duplicate={...demoSetup,academicYears:[...demoSetup.academicYears,{...demoSetup.academicYears[0],id:"ay-2"}]};
  expect(academicReadiness(duplicate).ready).toBe(false);
  const unscoped={...demoSetup,classes:demoSetup.classes.map(c=>({...c,academicYearId:"ay-2"}))};
  expect(academicReadiness(unscoped).missing).toContain("classes linked to the active year");
 });
});
