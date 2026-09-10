import type { Role } from "../domain/types";

export type RoleAppIdentity = {
  key: "school" | "teacher" | "family" | "student" | "finance" | "driver" | "gate";
  name: string;
  shortName: string;
  description: string;
};

export function roleAppIdentity(role: Role): RoleAppIdentity {
  if (role === "teacher" || role === "tutor") return { key: "teacher", name: "DREEM Teacher", shortName: "Teacher", description: "Teaching, attendance, lessons, assessment and learner support." };
  if (role === "parent") return { key: "family", name: "DREEM Family", shortName: "Family", description: "Children, learning, fees, transport and safe pickup." };
  if (role === "student") return { key: "student", name: "DREEM Student", shortName: "Student", description: "Today, classes, assignments, feedback and results." };
  if (role === "bursar" || role === "accountant") return { key: "finance", name: "DREEM Finance", shortName: "Finance", description: "Fees, payments, receipts, reconciliation and accounting control." };
  if (role === "driver" || role === "transport_manager") return { key: "driver", name: role === "driver" ? "DREEM Driver" : "DREEM Transport", shortName: role === "driver" ? "Driver" : "Transport", description: "Routes, trips, learners, safety and operational evidence." };
  if (role === "security_guard") return { key: "gate", name: "DREEM Gate", shortName: "Gate", description: "Credential checks and safe learner release." };
  return { key: "school", name: "DREEM School", shortName: "DREEM", description: "Leadership command and whole-school operations." };
}

export function applyRoleAppIdentity(role: Role) {
  if (typeof document === "undefined") return;
  const app = roleAppIdentity(role);
  document.title = `${app.name} · School Operating System`;
  document.documentElement.dataset.dreemApp = app.key;
  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (theme) {
    const computed = typeof globalThis.getComputedStyle === "function"
      ? globalThis.getComputedStyle(document.documentElement).getPropertyValue("--brand").trim()
      : "";
    theme.content = computed || "#123b2c";
  }
}
