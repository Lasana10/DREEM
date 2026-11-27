// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import SchoolRecoveryPanel from "./SchoolRecoveryPanel";
import {demoBrand} from "../domain/demo";

const {exportBundle,verifyBundle,downloadBundle}=vi.hoisted(()=>({
 exportBundle:vi.fn(),verifyBundle:vi.fn(),downloadBundle:vi.fn()
}));
vi.mock("../lib/schoolRecovery",()=>({
 exportSchoolRecoveryBundle:exportBundle,
 verifySchoolRecoveryBundle:verifyBundle,
 downloadRecoveryBundle:downloadBundle,
}));
const bundle={manifest:{format:"dreem-recovery",school_id:"school",generated_at:"2026-11-27T11:00:00Z",sha256:"hash"},payload:{students:[]}};
describe("school recovery integrity gate",()=>{
 beforeEach(()=>{vi.clearAllMocks();exportBundle.mockResolvedValue(bundle);verifyBundle.mockResolvedValue({valid:true,students:2,guardians:1,audit_events:4});});
 afterEach(cleanup);
 it("checks integrity before downloading a school recovery bundle",async()=>{
  const order:string[]=[];
  verifyBundle.mockImplementation(async()=>{order.push("verify");return {valid:true,students:2};});
  downloadBundle.mockImplementation(()=>{order.push("download");});
  render(<SchoolRecoveryPanel brand={demoBrand}/>);
  fireEvent.click(screen.getByRole("button",{name:/Download verified recovery bundle/i}));
  await waitFor(()=>expect(downloadBundle).toHaveBeenCalledTimes(1));
  expect(order).toEqual(["verify","download"]);
 });
 it("never downloads an unverified recovery bundle",async()=>{
  verifyBundle.mockResolvedValue({valid:false,reason:"Mismatch"});
  render(<SchoolRecoveryPanel brand={demoBrand}/>);
  fireEvent.click(screen.getByRole("button",{name:/Download verified recovery bundle/i}));
  await screen.findByRole("alert");
  expect(downloadBundle).not.toHaveBeenCalled();
 });
});
