// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchoolBrand, SchoolSetup } from "../domain/types";
import { SchoolStudioView } from "./SchoolStudioView";

const brand:SchoolBrand={name:"Great Academy",shortName:"GRA",motto:"Learn well",address:"Douala",city:"Douala",subsystem:"bilingual",primaryColor:"#123b2c",accentColor:"#c9df83",receiptPrefix:"GRA",studentIdPrefix:"GRA",timezone:"Africa/Douala",currency:"XAF"};
const setup:SchoolSetup={academicYears:[],terms:[],classes:[],subjects:[]};
afterEach(cleanup);

describe("School Studio branding",()=>{
  it("applies a professional palette and normalizes document prefixes",async()=>{
    const onSave=vi.fn().mockResolvedValue(undefined);
    render(<SchoolStudioView brand={brand} setup={setup} onSave={onSave} onSaveSetup={vi.fn()} onUploadLogo={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Royal"}));
    fireEvent.change(screen.getByLabelText("Student ID prefix"),{target:{value:"gra school"}});
    fireEvent.click(screen.getByRole("button",{name:/save and publish identity/i}));
    await waitFor(()=>expect(onSave).toHaveBeenCalledWith(expect.objectContaining({primaryColor:"#173f70",accentColor:"#f0c75e",studentIdPrefix:"GRASCHOO"})));
  });

  it("uploads a logo version before publishing it",async()=>{
    const onUploadLogo=vi.fn().mockResolvedValue("https://assets.example/logo.png");
    render(<SchoolStudioView brand={brand} setup={setup} onSave={vi.fn()} onSaveSetup={vi.fn()} onUploadLogo={onUploadLogo}/>);
    const file=new File(["logo"],"logo.png",{type:"image/png"});
    fireEvent.change(screen.getByLabelText(/upload logo/i),{target:{files:[file]}});
    await waitFor(()=>expect(onUploadLogo).toHaveBeenCalledWith(file));
    expect(await screen.findByAltText("School logo preview")).toHaveAttribute("src","https://assets.example/logo.png");
  });
});
