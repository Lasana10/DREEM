import { describe, expect, it } from "vitest";
import { roleAppIdentity } from "./roleApp";

describe("roleAppIdentity", () => {
  it.each([
    ["teacher", "teacher", "DREEM Teacher"],
    ["parent", "family", "DREEM Family"],
    ["student", "student", "DREEM Student"],
    ["bursar", "finance", "DREEM Finance"],
    ["accountant", "finance", "DREEM Finance"],
    ["driver", "driver", "DREEM Driver"],
    ["transport_manager", "driver", "DREEM Transport"],
    ["security_guard", "gate", "DREEM Gate"],
    ["principal", "school", "DREEM School"],
  ] as const)("maps %s to its authorized install identity", (role, key, name) => {
    expect(roleAppIdentity(role)).toMatchObject({ key, name });
  });
});
