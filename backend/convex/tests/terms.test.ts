import { describe, expect, test } from "vitest";
import { currentTermOrdinal, isPastTerm, termBucket, termToOrdinal } from "../lib/terms";

describe("terms", () => {
  test("parses season/year into sortable ordinal", () => {
    expect(termToOrdinal("Intersession 2026")).toBe(20260);
    expect(termToOrdinal("Spring 2026")).toBe(20261);
    expect(termToOrdinal("Summer 2026")).toBe(20262);
    expect(termToOrdinal("Fall 2026")).toBe(20263);
  });

  test("returns null for unparseable terms", () => {
    expect(termToOrdinal("Soon")).toBeNull();
  });

  test("computes current term boundary in January and August", () => {
    expect(currentTermOrdinal(new Date("2026-01-10T12:00:00Z"))).toBe(20260);
    expect(currentTermOrdinal(new Date("2026-01-20T12:00:00Z"))).toBe(20261);
    expect(currentTermOrdinal(new Date("2026-08-10T12:00:00Z"))).toBe(20262);
    expect(currentTermOrdinal(new Date("2026-08-20T12:00:00Z"))).toBe(20263);
  });

  test("buckets terms as current then future then past", () => {
    const nowOrd = currentTermOrdinal();
    const year = Math.floor(nowOrd / 10);
    const season = nowOrd % 10;
    const names = ["Intersession", "Spring", "Summer", "Fall"];
    const current = `${names[season]} ${year}`;
    const future = `${names[Math.min(3, season + 1)]} ${season === 3 ? year + 1 : year}`;
    const past = `${names[Math.max(0, season - 1)]} ${season === 0 ? year - 1 : year}`;

    expect(termBucket(current)).toBe(0);
    expect(termBucket(future)).toBe(1);
    expect(termBucket(past)).toBe(2);
    expect(termBucket(undefined)).toBe(3);
  });

  test("isPastTerm aligns with bucket semantics", () => {
    const nowOrd = currentTermOrdinal();
    const year = Math.floor(nowOrd / 10);
    const season = nowOrd % 10;
    const names = ["Intersession", "Spring", "Summer", "Fall"];
    const past = `${names[Math.max(0, season - 1)]} ${season === 0 ? year - 1 : year}`;
    expect(isPastTerm(past)).toBe(true);
  });
});
