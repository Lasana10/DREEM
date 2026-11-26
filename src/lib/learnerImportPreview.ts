/** Local-only migration preflight. Never write incoming school files until an authorised, reviewed mapping exists. */
export type LearnerImportPreview={
 rows:number;accepted:number;warnings:string[];headers:string[];mappedFields:string[];sample:Array<{matricule:string;className:string;fullName:string}>;
};
const aliases:Record<string,string[]>={
 matricule:["matricule","student_id","studentid","student_number","admission_number","admission_no","registration_number","id_eleve"],
 fullName:["full_name","student_name","pupil_name","learner_name","nom_complet","nom_et_prenoms","name"],
 firstName:["first_name","firstname","prenom","prenoms","given_name"],
 lastName:["last_name","lastname","surname","nom","family_name"],
 className:["class","class_name","classe","level","niveau"],
 guardianPhone:["guardian_phone","parent_phone","telephone_parent","phone_parent","numero_parent","parent_mobile"],
};
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
function delimiterOf(source:string):string{
 const first=source.split(/\r?\n/,1)[0]??"";
 let quoted=false,comma=0,semi=0;
 for(let i=0;i<first.length;i++){const c=first[i];if(c==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&c===",")comma++;else if(!quoted&&c===";")semi++;}
 return semi>comma?";":",";
}
function csvRows(source:string,maxRows:number):string[][]{
 const delimiter=delimiterOf(source),rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(quoted){quoted=false;}else if(!cell.length){quoted=true;}else throw new Error("Unexpected quotation mark in the CSV file.");}
  else if(c===delimiter&&!quoted){row.push(cell);cell="";}
  else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>maxRows+1)throw new Error("This preview accepts at most "+maxRows+" learner records per file.");}
  else cell+=c;
 }
 if(quoted)throw new Error("An unclosed quoted cell was found. Correct the source CSV file.");
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length>maxRows+1)throw new Error("This preview accepts at most "+maxRows+" learner records per file.");
 return rows;
}
export function previewLearnerCsv(source:string,maxRows=10000):LearnerImportPreview{
 const rows=csvRows(source.replace(/^\uFEFF/,""),maxRows);
 if(rows.length<2)throw new Error("Choose a CSV file with a header row and at least one learner.");
 const headers=rows[0].map(v=>v.trim());
 if(new Set(headers.map(norm)).size!==headers.length)throw new Error("Duplicate CSV column names must be corrected before import.");
 const indices=Object.fromEntries(Object.entries(aliases).map(([key,keys])=>[key,headers.findIndex(h=>keys.includes(norm(h)))])) as Record<string,number>;
 if(indices.fullName<0&&(indices.firstName<0||indices.lastName<0))throw new Error("Include a pupil name column (full_name) or first_name and last_name.");
 if(indices.matricule<0)throw new Error("Include an existing matricule column. Never generate replacement identifiers during migration preview.");
 if(indices.className<0)throw new Error("Include a class column so the school can reconcile enrolments.");
 const seenMatricules=new Set<string>(),seenNames=new Set<string>();const warnings:string[]=[],sample:LearnerImportPreview["sample"]=[];let accepted=0;
 rows.slice(1).forEach((r,i)=>{
  const line=i+2;
  if(r.length>headers.length){warnings.push(`Row ${line}: too many columns; check delimiters and quotes.`);return;}
  const at=(key:string)=>indices[key]>=0?(r[indices[key]]??"").trim():"";
  const fullName=at("fullName")||[at("firstName"),at("lastName")].filter(Boolean).join(" ");
  const matricule=at("matricule"),className=at("className");
  if(!fullName||!matricule||!className){warnings.push(`Row ${line}: missing pupil name, matricule or class.`);return;}
  const id=matricule.toLocaleUpperCase("en");
  if(seenMatricules.has(id)){warnings.push(`Row ${line}: duplicate matricule in this file; do not create another pupil.`);return;}
  seenMatricules.add(id);
  const nameKey=norm(fullName)+"|"+norm(className);
  if(seenNames.has(nameKey))warnings.push(`Row ${line}: similar pupil name and class; human review required.`);
  seenNames.add(nameKey);
  accepted++;
  if(sample.length<5)sample.push({matricule,className,fullName});
 });
 return{rows:rows.length-1,accepted,warnings:warnings.slice(0,100),headers,mappedFields:Object.keys(indices).filter(k=>indices[k]>=0),sample};
}
