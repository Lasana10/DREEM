import {describe,expect,it} from "vitest";
import {validateGateRelease,type GateReleaseSafetyInput} from "./gateReleaseSafety";
const valid:GateReleaseSafetyInput={online:true,learnerToken:"learner-credential",collectorToken:"collector-credential",decision:"released",reason:"Physically matched verified identity and learner",identityConfirmed:true,identityMethod:"school_photo"};
describe("secure gate handover policy",()=>{
 it("requires human confirmation, not only possession of a QR card",()=>expect(validateGateRelease({...valid,identityConfirmed:false})).toMatch(/DO NOT RELEASE/));
 it("requires a declared physical evidence method",()=>expect(validateGateRelease({...valid,identityMethod:""})).toMatch(/DO NOT RELEASE/));
 it("fails closed when offline or collector authority is unavailable",()=>{
  expect(validateGateRelease({...valid,online:false})).toMatch(/DO NOT RELEASE/);
  expect(validateGateRelease({...valid,collectorToken:""})).toMatch(/DO NOT RELEASE/);
 });
 it("permits an attested online identity check but never grants release itself",()=>expect(validateGateRelease(valid)).toBeNull());
 it("permits documenting denial without collector credentials or attestation",()=>expect(validateGateRelease({...valid,decision:"denied",collectorToken:"",identityConfirmed:false,identityMethod:""})).toBeNull());
 it("still requires a learner identity and a reason for denial",()=>{
  expect(validateGateRelease({...valid,decision:"denied",learnerToken:""})).toMatch(/learner credential/);
  expect(validateGateRelease({...valid,decision:"denied",reason:""})).toMatch(/note/);
 });
});
