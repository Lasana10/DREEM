import { describe,expect,it } from "vitest";
import { userFacingError } from "./userFacingError";

describe("userFacingError",()=>{
  it("does not expose database internals",()=>{
    expect(userFacingError({message:"duplicate key violates unique constraint",details:"Key (id)=(x)",hint:"SQLSTATE",code:"23505"})).toBe("This appears to have already been recorded. Refresh the workspace before trying again.");
  });
  it("maps offline failures to useful guidance",()=>{
    expect(userFacingError(new Error("Failed to fetch"))).toMatch(/connection/i);
  });
  it("allows short human-safe validation messages",()=>{
    expect(userFacingError(new Error("Choose a class before saving."))).toBe("Choose a class before saving.");
  });
  it("replaces technical or excessively long messages with fallback",()=>{
    expect(userFacingError(new Error("relation dreem_students does not exist"),"Could not load learners.")).toBe("Could not load learners.");
  });
});
