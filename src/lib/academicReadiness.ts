import type {SchoolSetup} from "../domain/types";
/** Academic work may only be drafted against the institution's deliberately activated year. */
export function academicReadiness(setup:SchoolSetup){
 const activeYears=setup.academicYears.filter(y=>y.status==="active");
 const year=activeYears.length===1?activeYears[0]:undefined;
 const terms=year?setup.terms.filter(t=>t.academicYearId===year.id):[];
 const classes=year?setup.classes.filter(c=>c.academicYearId===year.id):[];
 const missing=[
  !year?"active academic year":"",
  !terms.length?"terms linked to the active year":"",
  !classes.length?"classes linked to the active year":"",
  !setup.subjects.length?"subjects":"",
 ].filter(Boolean);
 if(activeYears.length>1)missing.unshift("exactly one active academic year");
 return{year,terms,classes,missing,ready:missing.length===0};
}
export function academicActionMatchesYear(yearId:string,classId:string,termId:string|undefined,setup:SchoolSetup){
 const state=academicReadiness(setup);
 return !!state.year&&state.year.id===yearId&&state.classes.some(c=>c.id===classId)&&(!termId||state.terms.some(t=>t.id===termId));
}
