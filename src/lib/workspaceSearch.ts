import type { WorkspaceData } from "./repository";
import type { WorkspaceView } from "./access";

export type WorkspaceSearchKind =
  | "learner" | "admission" | "teacher" | "curriculum" | "academic_document"
  | "assessment" | "assignment" | "case" | "transport" | "message" | "staff";

export interface WorkspaceSearchItem {
  id: string;
  kind: WorkspaceSearchKind;
  title: string;
  subtitle: string;
  keywords: string;
  view: WorkspaceView;
}

function item(input: Omit<WorkspaceSearchItem,"keywords"> & { keywords?: string }):WorkspaceSearchItem {
  return {...input,keywords:[input.title,input.subtitle,input.keywords??""].join(" ").toLowerCase()};
}

export function buildWorkspaceSearchIndex(workspace:WorkspaceData):WorkspaceSearchItem[] {
  const rows:WorkspaceSearchItem[]=[];

  for(const learner of workspace.learners) rows.push(item({
    id:`learner:${learner.id}`,kind:"learner",title:learner.name,
    subtitle:`${learner.matricule} · ${learner.className} · ${learner.nextAction}`,
    keywords:`student pupil onefile attendance mastery fees ${learner.idStatus}`,view:"learners"
  }));

  for(const admission of workspace.admissions) rows.push(item({
    id:`admission:${admission.id}`,kind:"admission",title:admission.learnerName,
    subtitle:`${admission.applicationNumber} · ${admission.targetClassName} · ${admission.status.replaceAll("_"," ")}`,
    keywords:`${admission.guardianName} ${admission.guardianPhone??""} ${admission.guardianEmail??""} application enrolment`,view:"admissions"
  }));

  for(const teacher of workspace.teachers) rows.push(item({
    id:`teacher:${teacher.id}`,kind:"teacher",title:teacher.name,
    subtitle:`${teacher.subject} · ${teacher.coverage}% coverage · ${teacher.workload} workload`,
    keywords:`${teacher.nextSupport} teaching staff`,view:"teachers"
  }));

  for(const membership of workspace.operations.memberships) rows.push(item({
    id:`staff:${membership.id}`,kind:"staff",title:membership.name,
    subtitle:`${membership.role.replaceAll("_"," ")} · ${membership.status}`,
    keywords:"staff access membership role authority",view:"operations"
  }));

  for(const outcome of workspace.academics.curriculumOutcomes) rows.push(item({
    id:`curriculum:${outcome.id}`,kind:"curriculum",title:outcome.titleEn,
    subtitle:`${outcome.code} · ${outcome.source} · ${outcome.status}`,
    keywords:`${outcome.titleFr??""} ${outcome.description??""} syllabus objective competency curriculum`,view:"academics"
  }));

  for(const document of workspace.academics.documents) rows.push(item({
    id:`academic-document:${document.id}`,kind:"academic_document",title:document.title,
    subtitle:`${document.documentType.replaceAll("_"," ")} · ${document.language} · ${document.status}`,
    keywords:`${document.fileName} syllabus paper marking guide resource document`,view:"academics"
  }));

  for(const assessment of workspace.academics.assessments) rows.push(item({
    id:`assessment:${assessment.id}`,kind:"assessment",title:assessment.title,
    subtitle:`${assessment.className} · ${assessment.subjectName} · ${assessment.status}`,
    keywords:`${assessment.creatorName} marks exam test moderation`,view:"academics"
  }));

  for(const assignment of workspace.academics.assignmentsForLearners) rows.push(item({
    id:`assignment:${assignment.id}`,kind:"assignment",title:assignment.title,
    subtitle:`${assignment.className} · ${assignment.subjectName} · ${assignment.status}`,
    keywords:`${assignment.instructions} homework coursework due submission`,view:"learning"
  }));

  for(const schoolCase of workspace.cases) rows.push(item({
    id:`case:${schoolCase.id}`,kind:"case",title:schoolCase.title,
    subtitle:`${schoolCase.caseNumber} · ${schoolCase.studentName} · ${schoolCase.status}`,
    keywords:`${schoolCase.category} ${schoolCase.priority} ${schoolCase.summary} safeguarding care support`,view:"care"
  }));

  for(const route of workspace.transport.routes) rows.push(item({
    id:`route:${route.id}`,kind:"transport",title:route.name,
    subtitle:`${route.code} · ${route.direction} · ${route.status}`,
    keywords:`${route.stops.map(stop=>stop.name).join(" ")} bus route transport stop`,view:"transport"
  }));

  for(const signal of workspace.signals) rows.push(item({
    id:`message:${signal.id}`,kind:"message",title:signal.subjectName,
    subtitle:`${signal.category} · ${signal.severity} · ${signal.status.replaceAll("_"," ")}`,
    keywords:`${signal.sourceName} ${signal.message} feedback communication message`,view:"signals"
  }));

  return rows;
}

export function searchWorkspace(items:WorkspaceSearchItem[],query:string,limit=8){
  const tokens=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(!tokens.length)return [];
  return items
    .map(entry=>({entry,score:tokens.reduce((score,token)=>{
      if(entry.title.toLowerCase().startsWith(token))return score+8;
      if(entry.title.toLowerCase().includes(token))return score+5;
      if(entry.subtitle.toLowerCase().includes(token))return score+3;
      if(entry.keywords.includes(token))return score+1;
      return score-4;
    },0)}))
    .filter(result=>result.score>0)
    .sort((a,b)=>b.score-a.score||a.entry.title.localeCompare(b.entry.title))
    .slice(0,limit)
    .map(result=>result.entry);
}
