import { describe, expect, it } from "vitest";
import { buildClassPack } from "./classPacks";

describe("school class packs", () => {
  it("provides a bilingual primary baseline that can be customised", () => {
    const setup = buildClassPack("bilingual-primary", "2026 / 2027");
    expect(setup.academicYears[0].name).toBe("2026 / 2027");
    expect(setup.classes).toHaveLength(6);
    expect(setup.classes[0]).toMatchObject({ name: "Class 1", sectionName: "English + French" });
    expect(setup.subjects.map(subject => subject.code)).toEqual(expect.arrayContaining(["ENG", "FRE", "MATH"]));
    const customised = { ...setup, classes: setup.classes.map(item => item.id === setup.classes[0].id ? { ...item, name: "Year 1", streamName: "Section A" } : item) };
    expect(customised.classes[0]).toMatchObject({ name: "Year 1", streamName: "Section A" });
  });
});
