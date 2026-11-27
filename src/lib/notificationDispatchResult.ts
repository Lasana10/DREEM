export type DeliveryBatch={processed:number;sent:number;failed:number;waitingForProvider:number};
export type NotificationDispatchSummary=DeliveryBatch&{paymentWitnesses:DeliveryBatch};
const empty=():DeliveryBatch=>({processed:0,sent:0,failed:0,waitingForProvider:0});
function readBatch(value:unknown,label:string):DeliveryBatch{
 if(!value||typeof value!=="object")throw new Error(`${label} delivery result was not returned. Delivery cannot be confirmed.`);
 const item=value as Record<string,unknown>;const result=empty();
 for(const key of Object.keys(result) as Array<keyof DeliveryBatch>){
  const n=item[key];
  if(typeof n!=="number"||!Number.isSafeInteger(n)||n<0)throw new Error(`${label} delivery result is incomplete. Delivery cannot be confirmed.`);
  result[key]=n;
 }
 if(result.sent+result.failed+result.waitingForProvider>result.processed)throw new Error(`${label} delivery counts are inconsistent. Review provider records.`);
 return result;
}
/** Convert backend result to a truthful, explicit summary; never mistake missing counts for success. */
export function parseNotificationDispatch(value:unknown):NotificationDispatchSummary{
 if(!value||typeof value!=="object")throw new Error("No delivery response was received.");
 const obj=value as Record<string,unknown>;
 const announcements=readBatch(obj.announcements,"Announcement");
 const paymentWitnesses=readBatch(obj.paymentWitnesses,"Payment witness");
 return {...announcements,paymentWitnesses};
}
