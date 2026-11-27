import type {TransportTripSummary} from "../domain/types";
import {schoolClock} from "./academicWeek";

/** Prevent a future or historical route from becoming an actionable school-day trip. */
export function driverTripsForToday(trips:TransportTripSummary[],now:Date,timeZone="Africa/Douala"){
 const schoolDate=schoolClock(now,timeZone).date;
 const order:Record<TransportTripSummary["status"],number>={in_progress:0,delayed:1,dispatched:2,completed:3,cancelled:4};
 const eligible=trips.filter(t=>t.serviceDate===schoolDate);
 return eligible.sort((a,b)=>order[a.status]-order[b.status]||(a.scheduledDeparture??"99:99").localeCompare(b.scheduledDeparture??"99:99")||a.id.localeCompare(b.id));
}
export function selectDriverTodayTrip(trips:TransportTripSummary[],now:Date,timeZone="Africa/Douala"){
 const today=driverTripsForToday(trips,now,timeZone);
 const actionable=today.filter(t=>["in_progress","delayed","dispatched"].includes(t.status));
 return {today,selected:actionable[0]??null,actionableIds:new Set(actionable.map(t=>t.id))};
}
