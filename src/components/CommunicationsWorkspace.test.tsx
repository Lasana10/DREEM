// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommunitySignal } from "../domain/types";

const loadAnnouncements=vi.fn();
const publishAnnouncement=vi.fn();
vi.mock("../lib/announcements",()=>({
  loadAnnouncements:(...args:unknown[])=>loadAnnouncements(...args),
  publishAnnouncement:(...args:unknown[])=>publishAnnouncement(...args),
}));

import CommunicationsWorkspace from "./CommunicationsWorkspace";

const signals:CommunitySignal[]=[];

describe("school communications",()=>{
  beforeEach(()=>{loadAnnouncements.mockResolvedValue([{id:"n1",title:"Parent meeting",body:"Friday at 15:00",audience:"families",priority:"important",publishedAt:"2026-09-11T10:00:00Z"}]);publishAnnouncement.mockResolvedValue("n2");});
  afterEach(()=>{cleanup();vi.clearAllMocks();});

  it("loads persisted notices for ordinary members without exposing publishing",async()=>{
    render(<CommunicationsWorkspace role="parent" signals={signals} onFeedback={vi.fn()} onStatus={async()=>undefined}/>);
    expect(await screen.findByText("Parent meeting")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Publish notice"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Give feedback"})).toBeInTheDocument();
  });

  it("lets authorized school leadership publish to an explicit audience",async()=>{
    render(<CommunicationsWorkspace role="principal" signals={signals} onFeedback={vi.fn()} onStatus={async()=>undefined}/>);
    await screen.findByText("Parent meeting");
    fireEvent.change(screen.getByLabelText("Title"),{target:{value:"Tomorrow timetable"}});
    fireEvent.change(screen.getByLabelText("Audience"),{target:{value:"students"}});
    fireEvent.change(screen.getByLabelText("Priority"),{target:{value:"important"}});
    fireEvent.change(screen.getByLabelText("Notice"),{target:{value:"Classes begin at 8 AM tomorrow."}});
    fireEvent.click(screen.getByRole("button",{name:"Publish notice"}));
    await waitFor(()=>expect(publishAnnouncement).toHaveBeenCalledWith(expect.objectContaining({title:"Tomorrow timetable",audience:"students",priority:"important"})));
  });
});
