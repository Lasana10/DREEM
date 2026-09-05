import { describe, expect, it } from "vitest";
import { makeQrMatrix } from "./qr";

describe("local credential QR encoder", () => {
  it("creates a deterministic version 4 matrix for a 64-character credential", () => {
    const matrix = makeQrMatrix("0123456789abcdef".repeat(4));
    expect(matrix).toHaveLength(33);
    expect(matrix.every((row) => row.length === 33)).toBe(true);
    expect(matrix.flat().filter(Boolean)).toHaveLength(528);
    expect(matrix[0].slice(0, 7)).toEqual([true, true, true, true, true, true, true]);
  });

  it("rejects payloads that exceed version 4-L byte capacity", () => {
    expect(() => makeQrMatrix("x".repeat(79))).toThrow(/too long/i);
  });
});
