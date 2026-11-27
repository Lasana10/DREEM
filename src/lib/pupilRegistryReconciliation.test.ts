import {describe,expect,it} from "vitest";
import {parsePupilCsvForReconciliation,reconcilePupils,type RegistryPupil} from "./pupilRegistryReconciliation";
const existing:RegistryPupil[]=[
 {id:"a",matricule:"A-001",fullName:"Nadia M.",className:"CM1"},
 {id:"b",matricule:"A-002",fullName:"Julien T.",className:"CM2"},
];
describe("non-destructive real school registry matching",()=>{
 it("compares a bilingual semicolon CSV against existing matricules",()=>{
  const rows=parsePupilCsvForReconciliation('matricule;nom_complet;classe\nA-001;Nadia M.;CM1\nA-003;Lina P.;CM2');
  const result=reconcilePupils(rows,existing,["CM1","CM2"]);
  expect(result).toMatchObject({sourceRows:2,existingMatches:1,newCandidates:1,readyForImport:false});
  expect(result.issues.some(x=>x.kind==="existing")).toBe(true);
 });
 it("flags changing identity with unchanged matricule and duplicate source IDs",()=>{
  const result=reconcilePupils([
   {matricule:"a-001",fullName:"Other Pupil",className:"CM1"},
   {matricule:"a-001",fullName:"Other Pupil",className:"CM1"},
  ],existing,["CM1"]);
  expect(result.issues.map(x=>x.kind)).toEqual(["identity_conflict","duplicate_source"]);
  expect(result.newCandidates).toBe(0);
 });
 it("rejects unknown classes and existing name with changed matricule",()=>{
  const result=reconcilePupils([
   {matricule:"NEW",fullName:"Lina P.",className:"Unknown"},
   {matricule:"A-099",fullName:"Julien T.",className:"CM2"},
  ],existing,["CM1","CM2"]);
  expect(result.issues.map(x=>x.kind)).toEqual(["unknown_class","possible_duplicate_name"]);
  expect(result.readyForImport).toBe(false);
 });
 it("recognises quoted pupils and multiline names without splitting rows",()=>{
  const rows=parsePupilCsvForReconciliation('matricule,full_name,class\nA-01,"Doe, Jane",CM1\nA-02,"John\nJunior",CM2');
  expect(rows).toHaveLength(2);
  expect(rows[0].fullName).toBe("Doe, Jane");
  expect(rows[1].fullName).toBe("John\nJunior");
 });
 it("refuses incomplete source files without claiming success",()=>{
  expect(()=>parsePupilCsvForReconciliation('full_name,class\nNadia,CM1')).toThrow(/matricule/);
  expect(()=>parsePupilCsvForReconciliation('matricule,full_name,class\nA-1,"Unclosed,CM1')).toThrow(/Unclosed/);
  expect(reconcilePupils([{matricule:"",fullName:"",className:"CM1"}],existing,["CM1"]).issues[0].kind).toBe("missing");
 });
});
