// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoFinance, demoLearners, demoSetup } from "../domain/demo";
import FinanceWorkspace from "./FinanceWorkspace";

vi.mock("../lib/feePlans",()=>({
  loadFeePlans:vi.fn().mockResolvedValue([]),
  createFeePlan:vi.fn(),
  activateFeePlan:vi.fn(),
}));

describe("role-specific finance workspaces",()=>{
  afterEach(cleanup);
  it("gives the bursar collection and custody controls",async()=>{
    render(<FinanceWorkspace finance={demoFinance} learners={demoLearners} setup={demoSetup} role="bursar" onRecorded={async()=>undefined}/>);
    expect(screen.getByRole("button",{name:/collect payment/i})).toBeInTheDocument();
    expect(await screen.findByRole("heading",{name:/count and submit the open till/i})).toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:/reconcile cashier closures/i})).not.toBeInTheDocument();
    expect(screen.queryByText(/fee structure studio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/leadership-controlled activation/i)).not.toBeInTheDocument();
  });
  it("gives accountants review controls without collection",async()=>{
    render(<FinanceWorkspace finance={demoFinance} learners={demoLearners} setup={demoSetup} role="accountant" onRecorded={async()=>undefined}/>);
    expect(screen.queryByRole("button",{name:/collect payment/i})).not.toBeInTheDocument();
    expect(await screen.findByRole("heading",{name:/reconcile cashier closures/i})).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:/confirm money reached the institution/i})).toBeInTheDocument();
    expect(screen.queryByText(/fee structure studio/i)).not.toBeInTheDocument();
  });
  it("shows fee policy only to an authority that can both configure the school and approve finance",async()=>{
    render(<FinanceWorkspace finance={demoFinance} learners={demoLearners} setup={demoSetup} role="principal" authorityScopes={["institutional_leadership","finance_approval","school_configuration"]} onRecorded={async()=>undefined}/>);
    expect(await screen.findByText(/fee structure studio/i)).toBeInTheDocument();
  });
  it("keeps auditors read-only",async()=>{
    render(<FinanceWorkspace finance={demoFinance} learners={demoLearners} setup={demoSetup} role="auditor" onRecorded={async()=>undefined}/>);
    expect(await screen.findByRole("heading",{name:/independent audit view/i})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/collect payment/i})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/record independent decision/i})).not.toBeInTheDocument();
  });
});