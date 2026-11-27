import type { SchoolSetup } from "../domain/types";

/**
 * School setup is additive and explicit: no existing pupil, curriculum,
 * timetable or historical school records are implicitly deleted by an edit.
 */
export function validateSchoolSetup(setup:SchoolSetup):string[]{
 const errors:string[]=[];
 const years=setup.academicYears;
 const byYear=new Map(years.map(y=>[y.id,y]));
 const active=years.filter(y=>y.status==="active");
 if(active.length>1)errors.push("Only one academic year may be active at a time.");
 for(const year of years){
  if(!year.name.trim()||!year.startsOn||!year.endsOn)errors.push("Every academic year needs a name and complete dates.");
  if(year.startsOn&&year.endsOn&&year.startsOn>year.endsOn)errors.push(`Academic year ${year.name} ends before it starts.`);
  if(year.status==="active"){
   if(!setup.terms.some(t=>t.academicYearId===year.id))errors.push(`Active year ${year.name} needs at least one linked term.`);
   if(!setup.classes.some(c=>c.academicYearId===year.id))errors.push(`Active year ${year.name} needs assigned classes.`);
  }
 }
 const names=new Set<string>();
 for(const term of setup.terms){
  const year=byYear.get(term.academicYearId);
  if(!year){errors.push(`Term ${term.name} references an unknown academic year.`);continue;}
  if(!term.name.trim()||!term.startsOn||!term.endsOn)errors.push("Every term needs a name and complete dates.");
  if(term.startsOn&&term.endsOn&&(term.startsOn>term.endsOn||term.startsOn<year.startsOn||term.endsOn>year.endsOn))errors.push(`Term ${term.name} falls outside ${year.name} or its dates are reversed.`);
  const key=`${term.academicYearId}|${term.name.trim().toLowerCase()}`;
  if(names.has(key))errors.push(`Duplicate term name ${term.name} in an academic year.`);
  names.add(key);
 }
 for(const item of setup.classes){
  if(!item.name.trim())errors.push("Every class needs a name.");
  if(item.academicYearId&&!byYear.has(item.academicYearId))errors.push(`Class ${item.name} references an unknown academic year.`);
 }
 const codes=new Set<string>();
 for(const item of setup.subjects){
  if(!item.name.trim()||!item.code.trim()||!Number.isFinite(item.gradingWeight)||item.gradingWeight<=0)errors.push("Every subject needs a name, code and valid positive grading weight.");
  const key=item.code.trim().toLowerCase();if(codes.has(key))errors.push(`Duplicate subject code ${item.code}.`);codes.add(key);
 }
 return [...new Set(errors)];
}
