import { describe, expect, it } from "vitest";
import { allowedWorkspaceViews, canOpenView, defaultWorkspaceView } from "./access";

describe("authority-driven workspace access",()=>{
  it("does not make a title string a permission",()=>{
    const viewer={role:"teacher" as const,positionTitle:"Headmistress",authorityScopes:["academics"] as import("./authority").AuthorityScope[]};
    expect(canOpenView(viewer,"finance")).toBe(false);
    expect(canOpenView(viewer,"studio")).toBe(false);
    expect(canOpenView(viewer,"academics")).toBe(true);
  });

  it("lets configured authority shape leadership access independently of legacy role",()=>{
    const viewer={role:"administrator" as const,positionTitle:"Director",authorityScopes:["institutional_leadership","admissions","communications"] as import("./authority").AuthorityScope[]};
    expect(canOpenView(viewer,"command")).toBe(true);
    expect(canOpenView(viewer,"admissions")).toBe(true);
    expect(canOpenView(viewer,"finance")).toBe(true);
    expect(canOpenView(viewer,"academics")).toBe(false);
  });

  it("keeps finance collection and approval distinct",()=>{
    const collector={role:"bursar" as const,authorityScopes:["finance_collection"] as import("./authority").AuthorityScope[]};
    const reviewer={role:"accountant" as const,authorityScopes:["finance_approval","audit"] as import("./authority").AuthorityScope[]};
    expect(canOpenView(collector,"finance")).toBe(true);
    expect(canOpenView(reviewer,"finance")).toBe(true);
    expect(canOpenView(collector,"studio")).toBe(false);
    expect(canOpenView(reviewer,"studio")).toBe(false);
  });

  it("uses authority to choose a natural first workspace",()=>{
    const transportLead={role:"administrator" as const,authorityScopes:["transport"] as import("./authority").AuthorityScope[]};
    expect(defaultWorkspaceView(transportLead)).toBe("command");
    expect(allowedWorkspaceViews(transportLead)).toContain("transport");
  });
});
