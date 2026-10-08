import fs from "node:fs";
const files=["src/experience-v2.css","src/experience-grade-v5.css","src/components/SchoolCommandCentre.tsx","src/components/SchoolStudioView.tsx","src/components/FinanceWorkspace.tsx","src/components/TeacherClassroomWorkspace.tsx"];
const text=files.map(file=>fs.readFileSync(file,"utf8")).join("\n");
const failures=[];
for(const token of ["--dreem-blue","#1769e0","#1257ba","#0d2341"])if(text.includes(token))failures.push("Hardcoded Experience V2 colour returned: "+token);
const css=fs.readFileSync("src/experience-v2.css","utf8");
for(const required of ["var(--brand","#f3f6f3","@media(max-width:680px)","font-size:16px","env(safe-area-inset-bottom)"])if(!css.includes(required))failures.push("Missing UX contract: "+required);
const premium=fs.readFileSync("src/experience-grade-v5.css","utf8");
for(const required of ["--dreem-shadow",".intelligence-brief",".role-hero",".studio-stage",".mobile-nav","prefers-reduced-motion"])if(!premium.includes(required))failures.push("Experience-grade visual contract missing: "+required);
const main=fs.readFileSync("src/main.tsx","utf8");
if(!main.includes('"./experience-grade-v5.css"'))failures.push("Experience-grade stylesheet is not loaded");
const studio=fs.readFileSync("src/components/SchoolStudioView.tsx","utf8");
const policyStudio=fs.readFileSync("src/components/PolicyStudio.tsx","utf8");
if(!studio.includes("School theme"))failures.push("School theme control missing");
if(!studio.includes("<PolicyStudio/>")||!policyStudio.includes("SCHOOL RULES")||!policyStudio.includes("See who this affects"))failures.push("Live school-rules experience missing");
const command=fs.readFileSync("src/components/SchoolCommandCentre.tsx","utf8");
if(!command.includes("SCHOOL TODAY"))failures.push("Plain-language School Today missing");
if(!command.includes("SCHOOL FLOW"))failures.push("School flow surface missing");
if(!command.includes("Suggested follow-up"))failures.push("Recommended follow-up surface missing");
const care=fs.readFileSync("src/components/CareView.tsx","utf8");
const transport=fs.readFileSync("src/components/TransportView.tsx","utf8");
const responsive=fs.readFileSync("src/experience-grade-v5.css","utf8");
for(const [source,tokens,label] of [[care,["care-case-context","showNewCase","activeCase"],"Learner care contextual workflow"],[transport,["route-management-list","showRouteSetup","route-stop-summary"],"Route-first transport"],[responsive,["case-action-workspace","route-management-list","padding-bottom:max(105px"],"Narrow-screen operational layout"]]){
  for(const token of tokens)if(!source.includes(token))failures.push(label+" regression: "+token);
}
if(failures.length){console.error(failures.join("\n"));process.exit(1)}
console.log("DREEM UX contract passed.");
