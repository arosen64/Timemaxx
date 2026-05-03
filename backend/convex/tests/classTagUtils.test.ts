import { describe, expect, test } from "vitest";
import {
  buildClassTag,
  legacyNaiveClassTag,
  parseDeptPrefix,
  SEASON_ORDER,
  termSortKey,
} from "../lib/classTagUtils";

describe("legacyNaiveClassTag", () => {
  test("concatenates trimmed code and title with separator", () => {
    expect(legacyNaiveClassTag(" EN.601.226 ", " Data Structures ")).toBe(
      "EN.601.226: Data Structures"
    );
  });
});

describe("buildClassTag", () => {
  test("returns just the code when title is empty", () => {
    expect(buildClassTag("EN.601.226", "")).toBe("EN.601.226");
    expect(buildClassTag("EN.601.226", "   ")).toBe("EN.601.226");
  });

  test("appends title when no prefix overlap", () => {
    expect(buildClassTag("EN.601.226", "Homework 3")).toBe("EN.601.226: Homework 3");
  });

  test("strips a duplicated full-code prefix from the title", () => {
    expect(buildClassTag("EN.601.226", "EN.601.226: Homework 3")).toBe("EN.601.226: Homework 3");
  });

  test("strips a duplicated prefix that uses the term-stripped code", () => {
    expect(buildClassTag("EN.601.226.SP25", "EN.601.226: Final Project")).toBe(
      "EN.601.226.SP25: Final Project"
    );
  });

  test("prefix match is case-insensitive", () => {
    expect(buildClassTag("EN.601.226", "en.601.226: Notes")).toBe("EN.601.226: Notes");
  });

  test("does not strip an unrelated prefix that just contains a colon", () => {
    expect(buildClassTag("EN.601.226", "Reading: Chapter 4")).toBe(
      "EN.601.226: Reading: Chapter 4"
    );
  });

  test("trims surrounding whitespace from inputs", () => {
    expect(buildClassTag("  EN.601.226  ", "  Homework 3  ")).toBe("EN.601.226: Homework 3");
  });
});

describe("termSortKey", () => {
  test("orders terms within the same year by season", () => {
    expect(termSortKey("Spring 2025")).toBeLessThan(termSortKey("Summer 2025"));
    expect(termSortKey("Summer 2025")).toBeLessThan(termSortKey("Fall 2025"));
  });

  test("later years sort after earlier years regardless of season", () => {
    expect(termSortKey("Fall 2024")).toBeLessThan(termSortKey("Spring 2025"));
  });

  test("unknown season contributes 0 to the sort key", () => {
    expect(termSortKey("Winter 2025")).toBe(20250);
  });

  test("season ordering matches SEASON_ORDER constants", () => {
    expect(SEASON_ORDER).toEqual({ Spring: 1, Summer: 2, Fall: 3 });
  });
});

describe("parseDeptPrefix", () => {
  test("extracts the school + department prefix from a JHU course code", () => {
    expect(parseDeptPrefix("EN.601.433")).toBe("EN.601");
    expect(parseDeptPrefix("AS.110.108")).toBe("AS.110");
  });

  test("works on codes with a term suffix", () => {
    expect(parseDeptPrefix("EN.601.433.SP25")).toBe("EN.601");
  });

  test("returns null when there are not enough segments", () => {
    expect(parseDeptPrefix("CS101")).toBeNull();
    expect(parseDeptPrefix("")).toBeNull();
  });
});
