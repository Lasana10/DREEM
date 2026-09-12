// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SchoolContextPicker from "./SchoolContextPicker";

describe("DREEM school context picker",()=>{
  afterEach(cleanup);
  it("shows each institution with its approved role and chooses only the school context",()=>{
    const choose=vi.fn(async()=>undefined);
    render(<SchoolContextPicker memberships={[{schoolId:"school-a",schoolName:"Graceland Bilingual Complex",role:"teacher"},{schoolId:"school-b",schoolName:"Second Campus",role:"bursar"}]} onChoose={choose} onSignOut={async()=>undefined}/>);
    expect(screen.getByText("Graceland Bilingual Complex")).toBeInTheDocument();
    expect(screen.getByText(/Approved as Teacher/i)).toBeInTheDocument();
    expect(screen.getByText(/Approved as Bursar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Graceland Bilingual Complex/i}));
    expect(choose).toHaveBeenCalledWith("school-a");
  });
});
