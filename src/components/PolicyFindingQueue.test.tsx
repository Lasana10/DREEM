// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PolicyFindingQueue from "./PolicyFindingQueue";

const {loadFindings,acknowledge}=vi.hoisted(()=>({loadFindings:vi.fn(),acknowledge:vi.fn()}));
vi.mock("../lib/supabase",()=>({isSupabaseConfigured:true}));
vi.mock("../lib/policyEngine",()=>({loadPolicyFindings:loadFindings,acknowledgePolicyFinding:acknowledge}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const open={id:"finding-1",title:"Attendance needs follow-up",explanation:"Attendance below recommended level",nextAction:"Ask teacher to review",ownerScope:"academics_delivery",state:"open" as const,severity:"warning" as const,domain:"attendance",lastSeenAt:"2026-10-08T10:00:00Z"};
describe("Audited institution follow-through",()=>{
 it("records responsibility but does not falsely claim resolution",async()=>{
  loadFindings.mockResolvedValueOnce([open]).mockResolvedValueOnce([{...open,state:"acknowledged"}]);
  acknowledge.mockResolvedValue(undefined);
  render(<PolicyFindingQueue/>);
  await screen.findByText("Attendance needs follow-up");
  fireEvent.click(screen.getByText("Attendance needs follow-up"));
  fireEvent.change(screen.getByRole("textbox",{name:"Follow-up note"}),{target:{value:"Review the register today"}});
  fireEvent.click(screen.getByRole("button",{name:"Acknowledge responsibility"}));
  await waitFor(()=>expect(acknowledge).toHaveBeenCalledWith("finding-1","Review the register today"));
  await screen.findByText("Acknowledged, awaiting resolution");
 });
});
