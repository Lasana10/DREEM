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
  it("searches real school records and routes to their workspace",()=>{
    const onView=vi.fn();
    render(<Shell brand={demoBrand} viewer={{name:"Principal",email:"principal@example.test",role:"principal"}} view="command" onView={onView} signalCount={0} onFeedback={vi.fn()} searchItems={[{id:"learner:1",kind:"learner",title:"Maya Nkom",subtitle:"DRM-001 · Form 3",keywords:"maya nkom drm-001 form 3 learner",view:"learners"}]}><div>Command</div></Shell>);
    fireEvent.change(screen.getByPlaceholderText(/find a workspace or task/i),{target:{value:"Maya"}});
    fireEvent.click(screen.getByRole("button",{name:/Maya Nkom/i}));
    expect(onView).toHaveBeenCalledWith("learners");
  });
  it("does not expose School settings to teachers",()=>{
    render(<Shell brand={demoBrand} viewer={{name:"Teacher",email:"teacher@example.test",role:"teacher"}} view="operations" onView={vi.fn()} signalCount={0} onFeedback={vi.fn()}><div>Teacher content</div></Shell>);
    expect(screen.queryByRole("button",{name:"Settings"})).not.toBeInTheDocument();
  });
});
