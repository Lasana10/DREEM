// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchoolBrand, SchoolSetup } from "../domain/types";
import { demoSetup } from "../domain/demo";
vi.mock("../lib/policyEngine",()=>({loadPolicyRules:vi.fn().mockResolvedValue([]),savePolicyRule:vi.fn(),seedRecommendedPolicies:vi.fn().mockResolvedValue(3),simulatePolicyRule:vi.fn().mockResolvedValue({affected:0,total:0})}));
import { SchoolStudioView } from "./SchoolStudioView";
const brand:SchoolBrand={name:"Great Academy",shortName:"GRA",motto:"Learn well",address:"Douala",city:"Douala",subsystem:"bilingual",primaryColor:"#123b2c",accentColor:"#c9df83",receiptPrefix:"GRA",studentIdPrefix:"GRA",timezone:"Africa/Douala",currency:"XAF"};
const setup:SchoolSetup={academicYears:[],terms:[],classes:[],subjects:[]};
afterEach(cleanup);

describe("School Studio branding",()=>{
 it("keeps already configured school forms collapsed until leadership needs them",()=>{render(<SchoolStudioView brand={brand} setup={demoSetup} onSave={vi.fn()} onSaveSetup={vi.fn()} onUploadLogo={vi.fn()}/>);const stage=screen.getByText("School identity and appearance").closest("details");expect(stage).not.toHaveAttribute("open");fireEvent.click(screen.getByText("School identity and appearance"));expect(stage).toHaveAttribute("open");});

 it("applies a professional palette and normalizes document prefixes",async()=>{const onSave=vi.fn().mockResolvedValue(undefined);render(<SchoolStudioView brand={brand} setup={setup} onSave={onSave} onSaveSetup={vi.fn()} onUploadLogo={vi.fn()}/>);fireEvent.click(screen.getByRole("button",{name:"Royal"}));fireEvent.click(screen.getByRole("button",{name:/document details/i}));fireEvent.change(screen.getByLabelText("Learner ID prefix"),{target:{value:"gra school"}});fireEvent.click(screen.getByRole("button",{name:/save identity/i}));await waitFor(()=>expect(onSave).toHaveBeenCalledWith(expect.objectContaining({primaryColor:"#173f70",accentColor:"#f0c75e",studentIdPrefix:"GRASCHOO"})));});
 it("publishes custom school colours, not only preset palettes",async()=>{const onSave=vi.fn().mockResolvedValue(undefined);render(<SchoolStudioView brand={brand} setup={setup} onSave={onSave} onSaveSetup={vi.fn()} onUploadLogo={vi.fn()}/>);fireEvent.change(screen.getByLabelText("Primary colour value"),{target:{value:"#075d5b"}});fireEvent.change(screen.getByLabelText("Accent colour value"),{target:{value:"#a7e0d2"}});fireEvent.click(screen.getByRole("button",{name:/save identity/i}));await waitFor(()=>expect(onSave).toHaveBeenCalledWith(expect.objectContaining({primaryColor:"#075d5b",accentColor:"#a7e0d2"})));});
 it("uploads a logo version before publishing it",async()=>{const onUploadLogo=vi.fn().mockResolvedValue("https://assets.example/logo.png");render(<SchoolStudioView brand={brand} setup={setup} onSave={vi.fn()} onSaveSetup={vi.fn()} onUploadLogo={onUploadLogo}/>);const file=new File(["logo"],"logo.png",{type:"image/png"});fireEvent.change(screen.getByLabelText(/upload logo/i),{target:{files:[file]}});await waitFor(()=>expect(onUploadLogo).toHaveBeenCalledWith(file));expect(await screen.findByAltText("School logo preview")).toHaveAttribute("src","https://assets.example/logo.png");});
 it("requires school leader confirmation before activating a planned academic year",async()=>{
  const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
  const onSaveSetup=vi.fn().mockResolvedValue(undefined);
  const planned:SchoolSetup={...demoSetup,academicYears:demoSetup.academicYears.map(year=>({...year,status:"planning" as const}))};
  render(<SchoolStudioView brand={brand} setup={planned} onSave={vi.fn()} onSaveSetup={onSaveSetup} onUploadLogo={vi.fn()}/>);
  fireEvent.click(screen.getByText("School structure"));
  fireEvent.change(screen.getByDisplayValue("Planning"),{target:{value:"active"}});
  fireEvent.click(screen.getByRole("button",{name:/save school structure/i}));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Activate academic year"));
  expect(onSaveSetup).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button",{name:/save school structure/i}));
  await waitFor(()=>expect(onSaveSetup).toHaveBeenCalledWith(expect.objectContaining({academicYears:expect.arrayContaining([expect.objectContaining({status:"active"})])})));
  confirm.mockRestore();
 });

 it("separates routine school setup from protected migration, year transition and recovery",()=>{
  const {container}=render(<SchoolStudioView brand={brand} setup={demoSetup} onSave={vi.fn()} onSaveSetup={vi.fn()} onUploadLogo={vi.fn()}/>);
  const advanced=container.querySelector(".studio-advanced-operations") as HTMLDetailsElement;
  expect(advanced).toBeInTheDocument();
  expect(advanced).not.toHaveAttribute("open");
  expect(advanced).toHaveTextContent("Pupil record migration");
  expect(advanced).toHaveTextContent("Year transition");
  expect(advanced).toHaveTextContent("Recovery & export");
  const stages=Array.from(container.querySelectorAll(".studio-stage summary strong")).map(el=>el.textContent);
  expect(stages.slice(0,4)).toEqual(["School identity and appearance","School structure","School rules","Staff responsibilities"].filter(x=>stages.includes(x)));
  fireEvent.click(screen.getByText(/Advanced school operations · pupil migration/i));
  expect(advanced).toHaveAttribute("open");
 });

});
