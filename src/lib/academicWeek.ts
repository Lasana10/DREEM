export const isoLocalDate = (date:Date) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
export function weekStart(value:string):string {
 const date=new Date(value+"T12:00:00");
 if(Number.isNaN(date.getTime())) return value;
 date.setDate(date.getDate()-((date.getDay()+6)%7));
 return isoLocalDate(date);
}
