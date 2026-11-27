import type {AssignmentSummary,LearnerSummary,ReportCardSummary,SchoolSetup} from "../domain/types";
const canon=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("en").replace(/\s+/g," ");
/** Parent-facing schoolwork is limited to the selected child's authorised active school year. */
export function familyAcademicScope(setup:SchoolSetup,learner:LearnerSummary|undefined){
 const active=setup.academicYears.filter(y=>y.status==="active");
 const year=active.length===1?active[0]:undefined;
 const terms=year?setup.terms.filter(t=>t.academicYearId===year.id):[];
 const classCandidates=year&&learner?setup.classes.filter(c=>c.academicYearId===year.id&&canon(c.name)===canon(learner.className)):[];
 const schoolClass=classCandidates.length===1?classCandidates[0]:undefined;
 return{year,schoolClass,terms,ready:Boolean(year&&schoolClass&&terms.length)};
}
export function publishedFamilyHomework(setup:SchoolSetup,learner:LearnerSummary|undefined,assignments:AssignmentSummary[]):AssignmentSummary[]{
 const scope=familyAcademicScope(setup,learner);
 if(!scope.ready)return[];
 const terms=new Set(scope.terms.map(t=>t.id));
 return assignments.filter(a=>a.status==="published"&&a.classId===scope.schoolClass?.id&&terms.has(a.termId));
}
export function publishedFamilyReports(setup:SchoolSetup,learner:LearnerSummary|undefined,reports:ReportCardSummary[]):ReportCardSummary[]{
 if(!learner)return[];
 const scope=familyAcademicScope(setup,learner);
 if(!scope.ready)return[];
 const terms=new Set(scope.terms.map(t=>t.id));
 return reports.filter(r=>r.studentId===learner.id&&r.status==="published"&&terms.has(r.termId));
}
export function familyFeeBalanceLabel(value:number|undefined):string|null{
 return value!==undefined&&Number.isFinite(value)?new Intl.NumberFormat("fr-FR").format(value)+" FCFA":null;
}
