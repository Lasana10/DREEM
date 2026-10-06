// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RemoteLearnerPicker from "./RemoteLearnerPicker";

const loadLearnerDirectoryPage=vi.fn();
vi.mock("../lib/learnerDirectory",()=>({loadLearnerDirectoryPage:(...args:unknown[])=>loadLearnerDirectoryPage(...args)}));

describe("RemoteLearnerPicker",()=>{
 beforeEach(()=>{vi.clearAllMocks();loadLearnerDirectoryPage.mockResolvedValue({rows:[{id:"learner-501",matricule:"GBC-0501",name:"Amina N.",className:"Form 4A",mastery:0,attendance:0,engagement:0,wellbeing:0,trend:0,nextAction:"",idStatus:"active",feeAccountId:"fee-501",feeBalance:35000}],total:1,page:0,pageSize:20});});
 afterEach(cleanup);
 it("searches the server-backed directory and returns the selected learner",async()=>{
  const onSelect=vi.fn();
  render(<RemoteLearnerPicker name="studentId" label="Learner" onSelect={onSelect}/>);
  fireEvent.change(screen.getByPlaceholderText("Search name, matricule or class"),{target:{value:"Amina"}});
  await waitFor(()=>expect(loadLearnerDirectoryPage).toHaveBeenCalledWith(expect.objectContaining({query:"Amina",page:0,pageSize:20})));
  fireEvent.click(await screen.findByRole("option",{name:/Amina N\./i}));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({id:"learner-501",matricule:"GBC-0501"}));
  expect((document.querySelector('input[name="studentId"]') as HTMLInputElement).value).toBe("learner-501");
 });
});
