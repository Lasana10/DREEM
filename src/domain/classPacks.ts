import type { AcademicYearConfig, ClassConfig, SchoolSetup, SubjectConfig, TermConfig } from "./types";

export type ClassPackId = "bilingual-primary" | "bilingual-secondary" | "english-primary" | "french-secondary";
export interface ClassPack { id: ClassPackId; name: string; description: string; levels: string[]; languages: string; }
export const classPacks: ClassPack[] = [
  { id: "bilingual-primary", name: "Bilingual primary", description: "English and French primary sections with a shared school structure.", levels: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"], languages: "English + French" },
  { id: "bilingual-secondary", name: "Bilingual secondary", description: "English Forms and French cycles for a bilingual secondary school.", levels: ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Lower Sixth", "Upper Sixth", "6eme", "5eme", "4eme", "3eme", "Seconde", "Premiere", "Terminale"], languages: "English + French" },
  { id: "english-primary", name: "English primary", description: "English-medium primary structure with French as a subject.", levels: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"], languages: "English" },
  { id: "french-secondary", name: "French secondary", description: "French-medium secondary structure with configurable series and options.", levels: ["6eme", "5eme", "4eme", "3eme", "Seconde", "Premiere", "Terminale"], languages: "French" },
];
type SubjectSeed = readonly [string, string];
const subjects: Record<"english" | "french", readonly SubjectSeed[]> = {
  english: [["English Language", "ENG"], ["Mathematics", "MATH"], ["Science", "SCI"], ["French", "FRE"], ["ICT", "ICT"], ["Social Studies", "SOC"], ["Religious and Moral Education", "RME"], ["Creative Arts", "ART"], ["Physical Education", "PE"]],
  french: [["Francais", "FRE"], ["Mathematiques", "MATH"], ["Sciences", "SCI"], ["Anglais", "ENG"], ["TIC", "ICT"], ["Histoire-Geographie", "HIST"], ["ECM", "ECM"], ["Arts", "ART"], ["Education Physique et Sportive", "EPS"]],
} as const;
function generatedId() { return crypto.randomUUID(); }
export function buildClassPack(packId: ClassPackId, academicYearName = `${new Date().getFullYear()} / ${new Date().getFullYear() + 1}`): SchoolSetup {
  const pack = classPacks.find(item => item.id === packId);
  if (!pack) throw new Error("Choose a valid class pack.");
  const startYear = Number(academicYearName.slice(0, 4)) || new Date().getFullYear();
  const year: AcademicYearConfig = { id: generatedId(), name: academicYearName, startsOn: `${startYear}-09-01`, endsOn: `${startYear + 1}-07-31`, status: "planning" };
  const terms: TermConfig[] = [
    ["Term 1", `${startYear}-09-01`, `${startYear}-12-20`],
    ["Term 2", `${startYear + 1}-01-05`, `${startYear + 1}-03-31`],
    ["Term 3", `${startYear + 1}-04-12`, `${startYear + 1}-07-31`],
  ].map(([name, startsOn, endsOn], index) => ({ id: generatedId(), academicYearId: year.id, name, startsOn, endsOn, orderIndex: index + 1 }));
  const classes: ClassConfig[] = pack.levels.map((level) => ({ id: generatedId(), academicYearId: year.id, name: level, sectionName: pack.languages, streamName: "", levelName: level }));
  const groups = pack.languages === "French" ? ["french"] : pack.languages === "English" ? ["english"] : ["english", "french"];
  const rows = groups.flatMap(group => subjects[group as keyof typeof subjects]);
  const unique = Array.from(new Map(rows.map(row => [row[1], row])).values());
  const configuredSubjects: SubjectConfig[] = unique.map(([name, code]) => ({ id: generatedId(), name, code, subsystem: pack.languages === "English" ? "anglophone" : pack.languages === "French" ? "francophone" : "bilingual", gradingWeight: 100 }));
  return { academicYears: [year], terms, classes, subjects: configuredSubjects };
}
