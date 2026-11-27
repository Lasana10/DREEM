import {resolveActiveSchoolContext} from "./schoolContext";
import {supabase} from "./supabase";

export type ImportedPupil={matricule:string;fullName:string;className:string};
export type RegistryPupil=ImportedPupil&{id:string};
export type ReconciliationIssue={line:number;matricule:string;kind:"existing"|"identity_conflict"|"duplicate_source"|"unknown_class"|"possible_duplicate_name"|"missing";detail:string};
export type RegistryReconciliation={sourceRows:number;newCandidates:number;existingMatches:number;issues:ReconciliationIssue[];readyForImport:boolean};
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const idKey=(s:string)=>s.trim().toUpperCase();
const header=(s:string)=>norm(s).replace(/[^a-z0-9]+/g,"_");
function rows(source:string):string[][]{
 const first=source.replace(/^\uFEFF/,"").split(/\r?\n/,1)[0]??"";
 const count=(delimiter:string)=>{let quoted=false,n=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&first[i]===delimiter)n++;}return n;};
 const delimiter=count(";")>count(",")?";":",";
 const data=source.replace(/^\uFEFF/,""),result:string[][]=[];
 let quoted=false,row:string[]=[],field="";
 for(let i=0;i<data.length;i++){
  const c=data[i];
  if(c==='"'){if(quoted&&data[i+1]==='"'){field+='"';i++;}else if(quoted)quoted=false;else if(!field)quoted=true;else throw new Error("Unexpected quotation mark in pupil file.");}
  else if(c===delimiter&&!quoted){row.push(field);field="";}
  else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&data[i+1]==="\n")i++;row.push(field);field="";if(row.some(x=>x.trim()))result.push(row);row=[];}
  else field+=c;
  if(result.length>10001)throw new Error("Split files larger than 10,000 learners by class.");
 }
 if(quoted)throw new Error("Unclosed quoted pupil field.");
 row.push(field);if(row.some(x=>x.trim()))result.push(row);
 return result;
}
export function parsePupilCsvForReconciliation(source:string):ImportedPupil[]{
 const csv=rows(source);if(csv.length<2)throw new Error("The file needs a header and at least one pupil.");
 const headers=csv[0].map(header),idx=(names:string[])=>headers.findIndex(h=>names.includes(h));
 const matricule=idx(["matricule","student_id","studentid","student_number","admission_number","admission_no","registration_number","id_eleve"]);
 const name=idx(["full_name","student_name","pupil_name","learner_name","nom_complet","nom_et_prenoms","name"]);
 const first=idx(["first_name","firstname","prenom","prenoms","given_name"]),last=idx(["last_name","lastname","surname","nom","family_name"]);
 const cls=idx(["class","class_name","classe","level","niveau"]);
 if(matricule<0||cls<0||(name<0&&(first<0||last<0)))throw new Error("CSV must include matricule, class, and pupil name.");
 if(new Set(headers).size!==headers.length)throw new Error("Duplicate column headings.");
 return csv.slice(1).map(row=>{
  const at=(i:number)=>i<0?"":(row[i]??"").trim();
  if(row.length>headers.length)throw new Error("CSV contains extra columns; correct the source before comparing.");
  return{matricule:at(matricule),fullName:at(name)||[at(first),at(last)].filter(Boolean).join(" "),className:at(cls)};
 });
}
/** Strictly non-mutating; a match does NOT authorise update or cutover. */
export function reconcilePupils(incoming:ImportedPupil[],existing:RegistryPupil[],classes:string[]):RegistryReconciliation{
 const byId=new Map(existing.map(p=>[idKey(p.matricule),p]));
 const byIdentity=new Map<string,RegistryPupil[]>();
 for(const pupil of existing){const key=norm(pupil.fullName);byIdentity.set(key,[...(byIdentity.get(key)??[]),pupil]);}
 const validClasses=new Set(classes.map(norm)),seen=new Set<string>();
 const issues:ReconciliationIssue[]=[];let newCandidates=0,existingMatches=0;
 incoming.forEach((pupil,index)=>{
  const line=index+2,id=idKey(pupil.matricule),name=norm(pupil.fullName),cls=norm(pupil.className);
  if(!id||!name||!cls){issues.push({line,matricule:id,kind:"missing",detail:"Matricule, pupil name and class required."});return;}
  if(seen.has(id)){issues.push({line,matricule:id,kind:"duplicate_source",detail:"Matricule repeated in source file."});return;}
  seen.add(id);
  if(!validClasses.has(cls)){issues.push({line,matricule:id,kind:"unknown_class",detail:"Class is not configured in this school; reconcile the class mapping."});return;}
  const match=byId.get(id);
  if(match){
   if(norm(match.fullName)!==name||norm(match.className)!==cls)issues.push({line,matricule:id,kind:"identity_conflict",detail:"Existing matricule has a different name or class; school review is mandatory."});
   else{existingMatches++;issues.push({line,matricule:id,kind:"existing",detail:"Already present; preserve the existing pupil record, do not create another."});}
   return;
  }
  if(byIdentity.has(name)){issues.push({line,matricule:id,kind:"possible_duplicate_name",detail:"A pupil with the same name already exists under another matricule; verify identity."});return;}
  newCandidates++;
 });
 return{sourceRows:incoming.length,newCandidates,existingMatches,issues:issues.slice(0,500),readyForImport:false};
}
/** Read only the selected school's pupil index using existing RLS; never a service role key. */
export async function fetchSchoolRegistryIndex():Promise<RegistryPupil[]>{
 if(!supabase)throw new Error("School database is unavailable.");
 const context=await resolveActiveSchoolContext();
 if(!["platform_founder","school_owner","principal","administrator"].includes(context.role))throw new Error("School administration approval is required to reconcile pupil identities.");
 const rows:RegistryPupil[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await supabase.from("students").select("id,matricule,full_name,class_name").eq("school_id",context.schoolId).is("merged_into_student_id",null).order("id").range(offset,offset+499);
  if(error)throw error;
  for(const r of data??[])rows.push({id:String(r.id),matricule:String(r.matricule??""),fullName:String(r.full_name??""),className:String(r.class_name??"")});
  if((data??[]).length<500)return rows;
 }
 throw new Error("Registry exceeds the safe 10,000-pupil reconciliation limit; use a controlled server-side migration.");
}
