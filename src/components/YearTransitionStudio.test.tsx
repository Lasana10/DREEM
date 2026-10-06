// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SchoolSetup } from "../domain/types";
import YearTransitionStudio from "./YearTransitionStudio";

const previewClassTransition=vi.fn(),executeClassTransition=vi.fn();
vi.mock("../lib/yearTransition",async()=>{const actual=await vi.importActual<typeof import("../lib/yearTransition")>("../lib/yearTransition");return{...actual,previewClassTransition:(...args:unknown[])=>previewClassTransition(...args),executeClassTransition:(...args:unknown[])=>executeClassTransition(...args)}});

const setup:SchoolSetup={
 academicYears:[{id:"year-1",name:"2025/2026",startsOn:"2025-09-01",endsOn:"2026-07-31",status:"closed"},{id:"year-2",name:"2026/2027",startsOn:"2026-09-01",endsOn:"2027-07-31",status:"active"}],
 terms:[],
 classes:[{id:"class-old",academicYearId:"year-1",name:"Form 1",sectionName:"Secondary",streamName:"A",levelName:"Form 1"},{id:"class-new",academicYearId:"year-2",name:"Form 2",sectionName:"Secondary",streamName:"A",levelName:"Form 2"}],
 subjects:[],
};

describe("YearTransitionStudio",()=>{
 beforeEach(()=>{vi.clearAllMocks();previewClassTransition.mockResolvedValue({fromClassId:"class-old",fromClassName:"Form 1",toClassId:"class-new",toClassName:"Form 2",affectedLearners:42});executeClassTransition.mockResolvedValue({movedLearners:42,destinationClass:"Form 2"});});
 afterEach(cleanup);
 it("previews before moving learners and carries the expected count into execution",async()=>{
  const onChanged=vi.fn().mockResolvedValue(undefined);
  render(<YearTransitionStudio setup={setup} onChanged={onChanged}/>);
  fireEvent.change(screen.getByLabelText("Destination class"),{target:{value:"class-new"}});
  fireEvent.click(screen.getByRole("button",{name:"Preview transition"}));
  await waitFor(()=>expect(previewClassTransition).toHaveBeenCalledWith("class-old","class-new"));
  expect(await screen.findByText("42")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason for this transition"),{target:{value:"End-of-year promotion approved."}});
  fireEvent.click(screen.getByRole("button",{name:/Move 42 learners to Form 2/i}));
  await waitFor(()=>expect(executeClassTransition).toHaveBeenCalledWith(expect.objectContaining({fromClassId:"class-old",toClassId:"class-new",expectedCount:42,reason:"End-of-year promotion approved."})));
  expect(onChanged).toHaveBeenCalled();
 });
});
