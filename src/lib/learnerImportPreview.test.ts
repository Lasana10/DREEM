import {describe,expect,it} from "vitest";
import {previewLearnerCsv} from "./learnerImportPreview";

describe("existing-school pupil migration preflight",()=>{
 it("retains existing pupil identifiers and recognises French semicolon exports",()=>{
  const csv="matricule;nom_complet;classe;telephone_parent\nA-001;Ada N.;CM1;+237 600000000\nA-002;Benoit B.;CM2;+237 600000001";
  const result=previewLearnerCsv(csv);
  expect(result.rows).toBe(2);
  expect(result.accepted).toBe(2);
  expect(result.sample[0]).toEqual({matricule:"A-001",fullName:"Ada N.",className:"CM1"});
  expect(result.mappedFields).toContain("guardianPhone");
 });
 it("handles quoted commas, embedded newlines and BOM without splitting pupil rows",()=>{
  const csv='\uFEFFmatricule,full_name,class\r\nP-1,"Doe, Jane",Primary 4\r\nP-2,"John\nJunior",Primary 5\r\n';
  const result=previewLearnerCsv(csv);
  expect(result.rows).toBe(2);
  expect(result.sample[0].fullName).toBe("Doe, Jane");
  expect(result.sample[1].fullName).toBe("John\nJunior");
 });
 it("flags conflicting source IDs rather than creating duplicate pupil identities",()=>{
  const result=previewLearnerCsv("matricule,full_name,class\nA1,One,Class 1\na1,Two,Class 2");
  expect(result.accepted).toBe(1);
  expect(result.warnings.some(x=>x.includes("duplicate matricule"))).toBe(true);
 });
 it("does not permit migration preflight without existing identity and class fields",()=>{
  expect(()=>previewLearnerCsv("full_name,class\nOne,Class 1")).toThrow(/matricule/);
  expect(()=>previewLearnerCsv("matricule,full_name\nA1,One")).toThrow(/class column/);
 });
 it("flags missing rows and malformed quoted values without claiming an import",()=>{
  expect(previewLearnerCsv("matricule,full_name,class\nA1,One,Class 1\nA2,,Class 2").accepted).toBe(1);
  expect(()=>previewLearnerCsv('matricule,full_name,class\nA1,"Unclosed,Class 1')).toThrow(/unclosed/);
 });
});
