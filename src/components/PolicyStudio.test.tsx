// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api=vi.hoisted(()=>({
  loadPolicyRules:vi.fn(),
  savePolicyRule:vi.fn(),
  seedRecommendedPolicies:vi.fn(),
  simulatePolicyRule:vi.fn(),
}));

vi.mock("../lib/policyEngine",()=>api);
import PolicyStudio from "./PolicyStudio";

const rules=[
  {id:"r1",schoolId:"s1",code:"attendance_followup",name:"Attendance follow-up",domain:"attendance",threshold:80,actionLevel:"review",ownerScope:"academics_delivery",enabled:true,recommended:true},
  {id:"r2",schoolId:"s1",code:"missing_work_followup",name:"Repeated missing school work",domain:"learning",threshold:2,actionLevel:"review",ownerScope:"academics_delivery",enabled:true,recommended:true},
  {id:"r3",schoolId:"s1",code:"fee_overdue_followup",name:"Overdue fee follow-up",domain:"finance",threshold:1,actionLevel:"review",ownerScope:"finance_collection",enabled:true,recommended:true},
];

beforeEach(()=>{
  api.loadPolicyRules.mockReset().mockResolvedValue(rules);
  api.savePolicyRule.mockReset().mockResolvedValue("r1");
  api.seedRecommendedPolicies.mockReset().mockResolvedValue(3);
  api.simulatePolicyRule.mockReset().mockResolvedValue({affected:3,total:120});
});
afterEach(cleanup);

describe("PolicyStudio",()=>{
  it("loads the persistent school rules and previews impact before saving",async()=>{
    render(<PolicyStudio/>);
    expect(await screen.findByDisplayValue("80")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button",{name:/preview impact/i})[0]);
    expect(await screen.findByText("3 of 120 learners would currently need follow-up.")).toBeInTheDocument();
    expect(api.simulatePolicyRule).toHaveBeenCalledWith("attendance_followup",80);

    fireEvent.change(screen.getByLabelText("Attendance follow-up threshold"),{target:{value:"75"}});
    fireEvent.click(screen.getAllByRole("button",{name:/save rule/i})[0]);
    await waitFor(()=>expect(api.savePolicyRule).toHaveBeenCalledWith(expect.objectContaining({
      code:"attendance_followup",
      threshold:75,
      actionLevel:"review",
      enabled:true,
    })));
  });

  it("starts from DREEM Recommended when no school rules exist",async()=>{
    api.loadPolicyRules.mockResolvedValue([]);
    render(<PolicyStudio/>);
    const button=await screen.findByRole("button",{name:/activate recommended rules/i});
    fireEvent.click(button);
    await waitFor(()=>expect(api.seedRecommendedPolicies).toHaveBeenCalledTimes(1));
  });

  it("keeps service restrictions behind advanced controls",async()=>{
    render(<PolicyStudio/>);
    await screen.findByDisplayValue("80");
    fireEvent.click(screen.getByRole("button",{name:/advanced policy controls/i}));
    const responseSelect=screen.getAllByLabelText("School response")[0];
    fireEvent.change(responseSelect,{target:{value:"restrict_specific_service"}});
    expect(screen.getAllByLabelText("Specific service")[0]).toBeInTheDocument();
    expect(screen.getByText(/institutional leadership \+ school configuration authority/i)).toBeInTheDocument();
  });
});
