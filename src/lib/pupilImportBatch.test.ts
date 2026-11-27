import {describe,expect,it} from "vitest";
import {validatePupilImportApproval} from "./pupilImportBatch";
import type {RegistryReconciliation,ImportedPupil} from "./pupilRegistryReconciliation";
const pupil:ImportedPupil={matricule:"REG-123",fullName:"New Pupil",className:"CM1"};
const clean:RegistryReconciliation={sourceRows:1,newCandidates:1,existingMatches:0,issues:[],readyForImport:false};
describe("atomic school-approved pupil import gate",()=>{
 it("requires explicit approval even when source and registry comparisons match",()=>{
  expect(validatePupilImportApproval([pupil],clean,false)).toEqual([expect.stringContaining("explicitly approve")]);
  expect(validatePupilImportApproval([pupil],clean,true)).toEqual([]);
 });
 it("refuses conflicting, pre-existing and changed source files",()=>{
  expect(validatePupilImportApproval([pupil],{...clean,existingMatches:1},true)).toEqual([expect.stringContaining("conflict-free")]);
  expect(validatePupilImportApproval([pupil,pupil],clean,true)).toEqual([expect.stringContaining("conflict-free")]);
  expect(validatePupilImportApproval([pupil],{...clean,issues:[{line:2,matricule:"REG-123",kind:"unknown_class",detail:"unknown"}]},true)).toEqual([expect.stringContaining("conflict-free")]);
 });
 it("refuses empty files, overlimit batches and missing identities",()=>{
  expect(validatePupilImportApproval([],clean,true).some(x=>x.includes("1 to 200"))).toBe(true);
  expect(validatePupilImportApproval(Array.from({length:201},()=>pupil),clean,true).some(x=>x.includes("1 to 200"))).toBe(true);
  expect(validatePupilImportApproval([{...pupil,matricule:""}],clean,true).some(x=>x.includes("matricule"))).toBe(true);
 });
});
