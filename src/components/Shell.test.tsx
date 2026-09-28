// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoBrand } from "../domain/demo";
import Shell from "./Shell";

describe("shell navigation",()=>{
  it("binds the active school theme to the DREEM shell",()=>{
    const {container}=render(<Shell brand={{...demoBrand,primaryColor:"#6f1d2c",accentColor:"#f2cf72"}} viewer={{name:"Principal",email:"principal@example.test",role:"principal"}} view="command" onView={vi.fn()} signalCount={0} onFeedback={vi.fn()}><div>School pulse</div></Shell>);
    const shell=container.querySelector(".shell") as HTMLElement;
    expect(shell.style.getPropertyValue("--brand")).toBe("#6f1d2c");
    expect(shell.style.getPropertyValue("--accent")).toBe("#f2cf72");
  });
  afterEach(cleanup);
  it("keeps School settings reachable for leadership on compact navigation",()=>{
    const onView=vi.fn();
    render(<Shell brand={demoBrand} viewer={{name:"Principal",email:"principal@example.test",role:"principal"}} view="academics" onView={onView} signalCount={0} onFeedback={vi.fn()}><div>Academic content</div></Shell>);
    fireEvent.click(screen.getByRole("button",{name:"Settings"}));
    expect(onView).toHaveBeenCalledWith("studio");
  });
  it("does not expose School settings to teachers",()=>{
    render(<Shell brand={demoBrand} viewer={{name:"Teacher",email:"teacher@example.test",role:"teacher"}} view="operations" onView={vi.fn()} signalCount={0} onFeedback={vi.fn()}><div>Teacher content</div></Shell>);
    expect(screen.queryByRole("button",{name:"Settings"})).not.toBeInTheDocument();
  });
});
