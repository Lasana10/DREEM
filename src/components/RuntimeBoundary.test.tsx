// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RuntimeBoundary from "./RuntimeBoundary";

function Broken({fail}:{fail:boolean}){if(fail)throw new Error("relation private_table does not exist");return <div>Recovered workspace</div>}

describe("RuntimeBoundary",()=>{
  afterEach(()=>cleanup());
  it("replaces a render crash with a safe recovery screen",()=>{
    const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
    render(<RuntimeBoundary><Broken fail/></RuntimeBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not finish loading/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/private_table/i);
    spy.mockRestore();
  });
  it("can retry the screen without forcing a full reload",()=>{
    let fail=true;
    const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
    const {rerender}=render(<RuntimeBoundary><Broken fail={fail}/></RuntimeBoundary>);
    fail=false;
    rerender(<RuntimeBoundary><Broken fail={fail}/></RuntimeBoundary>);
    fireEvent.click(screen.getByRole("button",{name:/try screen again/i}));
    expect(screen.getByText("Recovered workspace")).toBeInTheDocument();
    spy.mockRestore();
  });
});
