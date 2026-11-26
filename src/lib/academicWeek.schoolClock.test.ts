import {describe,expect,it} from "vitest";
import {schoolClock} from "./academicWeek";

describe("institutional timetable clock",()=>{
 it("uses the school's calendar even when the browser is elsewhere",()=>{
  const instant=new Date("2026-11-26T23:30:00Z");
  expect(schoolClock(instant,"Africa/Douala")).toEqual({date:"2026-11-27",weekday:5,minutes:30});
  expect(schoolClock(instant,"UTC")).toEqual({date:"2026-11-26",weekday:4,minutes:23*60+30});
 });
 it("handles the date line and local hours without server offset guesses",()=>{
  const instant=new Date("2026-01-01T00:15:00Z");
  expect(schoolClock(instant,"America/New_York")).toEqual({date:"2025-12-31",weekday:3,minutes:19*60+15});
 });
 it("honours daylight savings transitions where the school is located",()=>{
  expect(schoolClock(new Date("2026-03-29T01:30:00Z"),"Europe/Paris")).toEqual({date:"2026-03-29",weekday:7,minutes:3*60+30});
 });
});
