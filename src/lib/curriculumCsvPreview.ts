/** Preview only. Official curriculum provenance is never inferred from a CSV filename. */
export type CurriculumCsvRow={code:string;titleEn:string;titleFr:string;description:string;reference:string};
export type CurriculumCsvPreview={total:number;valid:CurriculumCsvRow[];issues:string[];duplicates:number};
function column(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_");}
function parseDelimited(source:string):string[][]{
 const lines=source.replace(/^\uFEFF/,"");
 const first=lines.split(/\r?\n/,1)[0]??"";
 const count=(sep:string)=>{let quoted=false,n=0;for(let i=0;i<first.length;i++){const c=first[i];if(c==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&c===sep)n++;}return n;};
 const delim=count(";")>count(",")?";":",";
 let row:string[]=[],field="",quoted=false;const rows:string[][]=[];
 for(let i=0;i<lines.length;i++){
  const c=lines[i];
  if(c==='"'){if(quoted&&lines[i+1]==='"'){field+='"';i++;}else if(quoted)quoted=false;else if(field.length===0)quoted=true;else throw new Error("Unexpected quotation mark in CSV.");}
  else if(c===delim&&!quoted){row.push(field);field="";}
  else if((c==="\r"||c==="\n")&&!quoted){if(c==="\r"&&lines[i+1]==="\n")i++;row.push(field);field="";if(row.some(x=>x.trim()))rows.push(row);row=[];}
  else field+=c;
  if(rows.length>1001)throw new Error("Limit 1,000 curriculum rows per reviewed batch.");
 }
 if(quoted)throw new Error("Unclosed quoted field in CSV.");
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
export function previewCurriculumCsv(text:string,existingCodes:string[]=[]):CurriculumCsvPreview{
 const rows=parseDelimited(text);if(rows.length<2)throw new Error("Provide a CSV header and at least one curriculum objective.");
 const headers=rows[0].map(column);
 const index=(names:string[])=>headers.findIndex(x=>names.includes(x));
 const code=index(["code","objective_code","competency_code","code_competence"]);
 const en=index(["title_en","english_title","objective_en","english_objective","objectif_anglais"]);
 const fr=index(["title_fr","french_title","objective_fr","objectif_fr"]);
 const description=index(["description","notes","learning_competency","competence"]);
 const ref=index(["source_reference","reference","document_reference","source","reference_document"]);
 if(code<0||en<0||ref<0)throw new Error("CSV needs code, title_en and source_reference columns. A source reference is required for every objective.");
 if(new Set(headers).size!==headers.length)throw new Error("Duplicate column headings must be corrected.");
 let duplicates=0;const seen=new Set(existingCodes.map(x=>x.trim().toLowerCase()));
 const issues:string[]=[],valid:CurriculumCsvRow[]=[];
 rows.slice(1).forEach((r,i)=>{
  const at=(j:number)=>j>=0?(r[j]??"").trim():"";
  const item={code:at(code),titleEn:at(en),titleFr:at(fr),description:at(description),reference:at(ref)};
  if(r.length>headers.length){issues.push(`Row ${i+2}: too many fields.`);return;}
  if(!item.code||item.titleEn.length<3||!item.reference){issues.push(`Row ${i+2}: code, English title and source reference are required.`);return;}
  if(item.code.length>80||item.titleEn.length>300||item.titleFr.length>300||item.reference.length>500){issues.push(`Row ${i+2}: text exceeds supported lengths.`);return;}
  const key=item.code.toLowerCase();
  if(seen.has(key)){duplicates++;issues.push(`Row ${i+2}: duplicate curriculum code ${item.code}; skipped.`);return;}
  seen.add(key);valid.push(item);
 });
 return{total:rows.length-1,valid,issues:issues.slice(0,100),duplicates};
}
