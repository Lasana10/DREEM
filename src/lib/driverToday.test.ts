import {describe,expect,it} from "vitest";
import type {TransportTripSummary} from "../domain/types";
import {driverTripsForToday,selectDriverTodayTrip} from "./driverToday";
const trip=(id:string,date:string,status:TransportTripSummary["status"]):TransportTripSummary=>({id,routeId:"route",routeName:"School Route",vehicleId:"bus",vehicleCode:"BUS",driverId:"driver",driverName:"Driver",serviceDate:date,direction:"inbound",status,assignedStudents:2,scheduledDeparture:"07:00"});
describe("local-date driver operating mode",()=>{
 it("never promotes future and historical journeys to the active card",()=>{
  const data=[trip("past","2026-11-26","in_progress"),trip("future","2026-11-28","dispatched"),trip("today","2026-11-27","dispatched")];
  const output=selectDriverTodayTrip(data,new Date("2026-11-27T07:00:00Z"),"Africa/Douala");
  expect(output.selected?.id).toBe("today");
  expect(output.today).toHaveLength(1);
 });
 it("uses the school-local time zone at the midnight boundary",()=>{
  const data=[trip("school-today","2026-11-28","dispatched"),trip("yesterday","2026-11-27","in_progress")];
  expect(driverTripsForToday(data,new Date("2026-11-27T23:40:00Z"),"Africa/Douala").map(t=>t.id)).toEqual(["school-today"]);
 });
 it("never makes completed or cancelled trips actionable",()=>{
  const data=[trip("completed","2026-11-27","completed"),trip("cancelled","2026-11-27","cancelled")];
  expect(selectDriverTodayTrip(data,new Date("2026-11-27T10:00:00Z")).selected).toBeNull();
  expect(selectDriverTodayTrip(data,new Date("2026-11-27T10:00:00Z")).actionableIds.size).toBe(0);
 });
 it("prioritises in-progress work ahead of newly dispatched journeys",()=>{
  const data=[trip("dispatched","2026-11-27","dispatched"),trip("in-progress","2026-11-27","in_progress")];
  expect(selectDriverTodayTrip(data,new Date("2026-11-27T10:00:00Z")).selected?.id).toBe("in-progress");
 });
});
