import fs from "node:fs";
const failures=[];
const mustExist=[
  "src/components/RuntimeBoundary.tsx",
  "src/lib/userFacingError.ts",
  "src/lib/offlineOutbox.ts",
  "src/components/StudentWorkspace.tsx",
  "src/components/FamilyLearningWorkspace.tsx",
  "src/components/TeacherClassroomWorkspace.tsx",
  "src/components/FinanceControlDesk.tsx",
  "src/components/SchoolStudioView.tsx",
];
for(const file of mustExist)if(!fs.existsSync(file))failures.push(`Missing production behavior: ${file}`);
const main=fs.readFileSync("src/main.tsx","utf8");
if(!main.includes("RuntimeBoundary"))failures.push("Runtime recovery boundary is not mounted");
const errorUtility=fs.readFileSync("src/lib/userFacingError.ts","utf8");
for(const token of ["TECHNICAL_PATTERN","Nothing has been assumed saved","row-level security","Failed to fetch"]){if(!errorUtility.includes(token))failures.push(`Safe-error behavior missing: ${token}`)}
const shell=fs.readFileSync("src/components/Shell.tsx","utf8");
for(const token of ["pendingOfflineCount","navigator.onLine","pending sync","mobile-nav"]){if(!shell.includes(token))failures.push(`Connectivity/mobile behavior missing: ${token}`)}
const app=fs.readFileSync("src/App.tsx","utf8");
for(const token of ["SchoolContextPicker","defaultWorkspaceView","buildWorkspaceSearchIndex"]){if(!app.includes(token))failures.push(`Role/context behavior missing: ${token}`)}
if(failures.length){console.error(failures.join("\n"));process.exit(1)}
console.log("DREEM production realism contract passed.");
