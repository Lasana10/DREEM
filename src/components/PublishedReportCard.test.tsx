// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LearnerSummary, ReportCardSummary, SchoolBrand } from "../domain/types";
const {loadDetail}=vi.hoisted(()=>({loadDetail:vi.fn()}));
vi.mock("../lib/reportCards",()=>({loadPublishedReportCardDetail:(...args:unknown[])=>loadDetail(...args)}));
import PublishedReportCard from "./PublishedReportCard";

const brand:SchoolBrand={name:"Great Academy",shortName:"GRA",motto:"Learn well",address:"Mendong",city:"Yaoundé",subsystem:"bilingual",primaryColor:"#123b2c",accentColor:"#c9df83",receiptPrefix:"GRA",studentIdPrefix:"GRA",timezone:"Africa/Douala",currency:"XAF"};
const learner:LearnerSummary={id:"s1",name:"Nadia Learner",matricule:"GRA-1001",className:"Form 4A",attendance:94,mastery:76,engagement:81,wellbeing:88,trend:4,feeBalance:0,nextAction:"Keep learning",idStatus:"active"};
const report:ReportCardSummary={id:"r1",studentId:"s1",studentName:"Nadia Learner",termId:"t1",termName:"Term 1",status:"published",revision:2,overallAverage:78.5,evidenceCount:6,generatedBy:"u1",generatedAt:"2026-09-20T10:00:00Z",publishedAt:"2026-09-21T10:00:00Z"};

describe("PublishedReportCard",()=>{
 beforeEach(()=>loadDetail.mockReset().mockResolvedValue({id:"r1",studentId:"s1",termId:"t1",status:"published",revision:2,overallAverage:78.5,evidenceCount:6,teacherComment:"Strong progress in reasoning.",generatedAt:"2026-09-20T10:00:00Z",publishedAt:"2026-09-21T10:00:00Z",subjects:[{id:"rr1",subjectName:"Mathematics",averagePercent:82,assessmentCount:3},{id:"rr2",subjectName:"English",averagePercent:75,assessmentCount:3}]}));
 afterEach(cleanup);
 it("opens the real published subject breakdown",async()=>{
   render(<PublishedReportCard report={report} learner={learner} brand={brand}/>);
   fireEvent.click(screen.getByRole("button",{name:/open report/i}));
   await waitFor(()=>expect(loadDetail).toHaveBeenCalledWith("r1"));
   expect(await screen.findByText("Mathematics")).toBeInTheDocument();
   expect(screen.getByText("82.0%")).toBeInTheDocument();
   expect(screen.getByText(/Strong progress in reasoning/)).toBeInTheDocument();
   expect(screen.getByRole("dialog")).toHaveTextContent("GRA-1001");
 });
 it("does not expose backend internals when a published report fails to load",async()=>{
   loadDetail.mockRejectedValueOnce(new Error("relation dreem_report_card_results does not exist"));
   render(<PublishedReportCard report={report} learner={learner} brand={brand}/>);
   fireEvent.click(screen.getByRole("button",{name:/open report/i}));
   expect(await screen.findByRole("alert")).toHaveTextContent(/could not be opened/i);
   expect(screen.getByRole("alert")).not.toHaveTextContent(/dreem_report_card_results/i);
 });
});
