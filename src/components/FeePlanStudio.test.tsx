// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSetup } from "../domain/demo";
import FeePlanStudio from "./FeePlanStudio";

const loadFeePlans = vi.fn(), createFeePlan = vi.fn(), activateFeePlan = vi.fn();
vi.mock("../lib/feePlans", () => ({
  loadFeePlans: (...args: unknown[]) => loadFeePlans(...args),
  createFeePlan: (...args: unknown[]) => createFeePlan(...args),
  activateFeePlan: (...args: unknown[]) => activateFeePlan(...args),
}));

describe("FeePlanStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFeePlans.mockResolvedValue([]);
    createFeePlan.mockResolvedValue({ planId: "plan-1", status: "draft", totalAmount: 100000 });
    activateFeePlan.mockResolvedValue({ planId: "plan-1", status: "active", learnersCharged: 3, totalCharged: 300000 });
  });
  afterEach(cleanup);

  it("allows leadership to build a class fee plan", async () => {
    render(<FeePlanStudio setup={demoSetup} role="principal" onChanged={vi.fn().mockResolvedValue(undefined)} />);
    await waitFor(() => expect(loadFeePlans).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Class"), { target: { value: demoSetup.classes[0].id } });
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Annual class fees" } });
    fireEvent.change(screen.getByLabelText("Fee code 1"), { target: { value: "TUITION" } });
    fireEvent.change(screen.getByLabelText("Fee label 1"), { target: { value: "Tuition" } });
    fireEvent.change(screen.getByLabelText("Fee amount 1"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft fee plan" }));
    await waitFor(() => expect(createFeePlan).toHaveBeenCalledWith(expect.objectContaining({ classId: demoSetup.classes[0].id, name: "Annual class fees", items: expect.arrayContaining([expect.objectContaining({ code: "TUITION", amount: 100000 })]) })));
  });

  it("keeps bursars from editing fee structures", async () => {
    render(<FeePlanStudio setup={demoSetup} role="bursar" onChanged={vi.fn().mockResolvedValue(undefined)} />);
    await waitFor(() => expect(loadFeePlans).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Create draft fee plan" })).not.toBeInTheDocument();
    expect(screen.getByText(/Only founder, school owner or principal/i)).toBeInTheDocument();
  });
});
