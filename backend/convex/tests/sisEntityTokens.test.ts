import { describe, expect, test } from "vitest";
import {
  decodeSisCandidate,
  decodeSisContext,
  encodeSisCandidate,
  encodeSisContext,
  isSisCandidateEntityId,
} from "../lib/sisEntityTokens";

describe("sisEntityTokens", () => {
  test("round-trips context in v1 base64 format", () => {
    const payload = {
      term: "Fall 2026",
      school: "Krieger School of Arts and Sciences",
      query: "linear algebra || honors",
    };
    const encoded = encodeSisContext(payload);
    expect(decodeSisContext(encoded)).toEqual(payload);
  });

  test("round-trips candidate in v1 base64 format", () => {
    const payload = {
      offeringName: "AS.110.201",
      title: "Calculus II || Advanced Topics",
      term: "Fall 2026",
      school: "Whiting School of Engineering",
    };
    const encoded = encodeSisCandidate(payload);
    expect(decodeSisCandidate(encoded)).toEqual(payload);
    expect(isSisCandidateEntityId(encoded)).toBe(true);
  });

  test("decodes legacy tokens for backwards compatibility", () => {
    const legacyCtx = "__sis_ctx__|Fall 2026||Krieger||calc";
    const legacyPick = "__sis_pick__|AS.110.201||Calculus II||Fall 2026||Krieger";
    expect(decodeSisContext(legacyCtx)).toEqual({
      term: "Fall 2026",
      school: "Krieger",
      query: "calc",
    });
    expect(decodeSisCandidate(legacyPick)).toEqual({
      offeringName: "AS.110.201",
      title: "Calculus II",
      term: "Fall 2026",
      school: "Krieger",
    });
    expect(isSisCandidateEntityId(legacyPick)).toBe(true);
  });

  test("returns null for malformed payloads", () => {
    expect(decodeSisContext("sis_ctx:v1:not-base64")).toBeNull();
    expect(decodeSisCandidate("sis_pick:v1:not-base64")).toBeNull();
    expect(decodeSisContext("__sis_ctx__|a||b")).toBeNull();
    expect(isSisCandidateEntityId("random-id")).toBe(false);
  });
});
