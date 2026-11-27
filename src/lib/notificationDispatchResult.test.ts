import {describe,expect,it} from "vitest";
import {parseNotificationDispatch} from "./notificationDispatchResult";
describe("notification provider outcome contract",()=>{
 it("reads the actual nested Edge function response",()=>{
  expect(parseNotificationDispatch({announcements:{processed:2,sent:1,failed:0,waitingForProvider:1},paymentWitnesses:{processed:1,sent:1,failed:0,waitingForProvider:0}})).toEqual({
   processed:2,sent:1,failed:0,waitingForProvider:1,
   paymentWitnesses:{processed:1,sent:1,failed:0,waitingForProvider:0},
  });
 });
 it("does not silently treat a missing or outdated response as delivered",()=>{
  expect(()=>parseNotificationDispatch({processed:2,sent:2,failed:0,waitingForProvider:0})).toThrow(/Announcement delivery result/);
  expect(()=>parseNotificationDispatch(null)).toThrow(/No delivery response/);
  expect(()=>parseNotificationDispatch({announcements:{processed:0,sent:0,failed:0,waitingForProvider:0}})).toThrow(/Payment witness delivery result/);
 });
 it("rejects impossible counters so delivery does not show false success",()=>{
  expect(()=>parseNotificationDispatch({announcements:{processed:1,sent:2,failed:0,waitingForProvider:0},paymentWitnesses:{processed:0,sent:0,failed:0,waitingForProvider:0}})).toThrow(/inconsistent/);
  expect(()=>parseNotificationDispatch({announcements:{processed:1,sent:1,failed:undefined,waitingForProvider:0},paymentWitnesses:{processed:0,sent:0,failed:0,waitingForProvider:0}})).toThrow(/incomplete/);
 });
});