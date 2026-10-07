import { describe, expect, it } from "vitest";
import { isRetryableRemoteFailure, offlinePayloadDigest } from "./offlineOutbox";

describe("offline operation integrity",()=>{
  it("produces the same digest for semantically identical payload key order",async()=>{
    const base={schoolId:"school-1",actorId:"teacher-1",role:"teacher",entity:"attendance",command:"teacher.attendance",idempotencyKey:"attendance-1"};
    const first=await offlinePayloadDigest({...base,payload:{date:"2026-09-11",marks:[{studentId:"s1",status:"present"}],className:"Class 5"}});
    const second=await offlinePayloadDigest({...base,payload:{className:"Class 5",marks:[{status:"present",studentId:"s1"}],date:"2026-09-11"}});
    expect(second).toBe(first);
  });

  it("changes when semantic evidence changes",async()=>{
    const base={schoolId:"school-1",actorId:"teacher-1",role:"teacher",entity:"attendance",command:"teacher.attendance",idempotencyKey:"attendance-1"};
    const present=await offlinePayloadDigest({...base,payload:{studentId:"s1",status:"present"}});
    const absent=await offlinePayloadDigest({...base,payload:{studentId:"s1",status:"absent"}});
    expect(absent).not.toBe(present);
  });
  it("treats backend/network outages as retryable even when the browser reports online",()=>{
    expect(isRetryableRemoteFailure({message:"Failed to fetch"},true)).toBe(true);
    expect(isRetryableRemoteFailure({status:503,message:"Service unavailable"},true)).toBe(true);
    expect(isRetryableRemoteFailure({code:"08006",message:"connection failure"},true)).toBe(true);
  });

  it("does not queue ordinary authorization or validation failures",()=>{
    expect(isRetryableRemoteFailure({message:"Teachers may record attendance only for an assigned class."},true)).toBe(false);
    expect(isRetryableRemoteFailure({code:"23505",message:"duplicate key"},true)).toBe(false);
  });
});
