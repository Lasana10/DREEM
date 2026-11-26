export const isoLocalDate = (date:Date) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
export function weekStart(value:string):string {
 const date=new Date(value+"T12:00:00");
 if(Number.isNaN(date.getTime())) return value;
 date.setDate(date.getDate()-((date.getDay()+6)%7));
 return isoLocalDate(date);
}

/** A school day must be calculated in the institution's time zone, not the phone's. */
export function schoolClock(date:Date,timeZone:string="Africa/Douala"){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
 const year=get("year"),month=get("month"),day=get("day"),hour=Number(get("hour")),minute=Number(get("minute"));
 const isoDate=`${year}-${month}-${day}`;
 const weekday=new Date(`${isoDate}T12:00:00Z`).getUTCDay()||7;
 return {date:isoDate,weekday,minutes:hour*60+minute};
}
