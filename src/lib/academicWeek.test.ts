import { describe, expect, it } from "vitest";
import { isoLocalDate, weekStart } from "./academicWeek";
describe("academic weekly register dates", () => {
 it("anchors Monday to itself", () => { expect(weekStart("2026-10-26")).toBe("2026-10-26"); });
 it("anchors a Sunday to the previous Monday", () => { expect(weekStart("2026-11-01")).toBe("2026-10-26"); });
 it("handles month and year boundaries", () => { expect(weekStart("2027-01-01")).toBe("2026-12-28"); });
 it("leaves malformed input for form validation", () => { expect(weekStart("invalid")).toBe("invalid"); });
 it("formats local dates without UTC rollover", () => { expect(isoLocalDate(new Date(2026,9,27,23,0))).toBe("2026-10-27"); });
});
