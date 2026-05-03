import { describe, expect, test } from "vitest";
import { hexToGcalColorId } from "../lib/gcalHelpers";

describe("hexToGcalColorId", () => {
  test("returns the exact preset id for an exact-match hex", () => {
    // Tomato preset is rgb(213, 0, 0) → "#d50000".
    expect(hexToGcalColorId("#d50000")).toBe("11");
    // Peacock preset is rgb(3, 155, 229) → "#039BE5".
    expect(hexToGcalColorId("#039BE5")).toBe("7");
  });

  test("accepts hex with or without leading '#'", () => {
    expect(hexToGcalColorId("d50000")).toBe("11");
    expect(hexToGcalColorId("#d50000")).toBe("11");
  });

  test("is case-insensitive", () => {
    expect(hexToGcalColorId("#D50000")).toBe(hexToGcalColorId("#d50000"));
    expect(hexToGcalColorId("#aAbBcC")).toBe(hexToGcalColorId("#AABBCC"));
  });

  test("snaps an off-color hex to its nearest preset", () => {
    // Slightly off Tomato (rgb 213, 0, 0) → still nearest Tomato (id "11").
    expect(hexToGcalColorId("#d20303")).toBe("11");
    // Slightly off Peacock (rgb 3, 155, 229) → still nearest Peacock (id "7").
    expect(hexToGcalColorId("#0a99e0")).toBe("7");
  });

  test("returns undefined for hex strings of the wrong length", () => {
    expect(hexToGcalColorId("#fff")).toBeUndefined();
    expect(hexToGcalColorId("#ffffffff")).toBeUndefined();
    expect(hexToGcalColorId("")).toBeUndefined();
  });

  test("returns undefined for non-hex characters in the input", () => {
    expect(hexToGcalColorId("#zzzzzz")).toBeUndefined();
    expect(hexToGcalColorId("not-a-color")).toBeUndefined();
  });

  test("always returns one of the 11 valid GCal preset ids", () => {
    const validIds = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    for (const hex of ["#000000", "#ffffff", "#7f7f7f", "#123456", "#abcdef"]) {
      const id = hexToGcalColorId(hex);
      expect(id).toBeDefined();
      expect(validIds.has(id!)).toBe(true);
    }
  });
});
