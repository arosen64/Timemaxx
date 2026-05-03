import { cn } from "../src/utils/cn";

describe("cn", () => {
  it("joins string class names with a space", () => {
    expect(cn("text-navy", "font-bold")).toBe("text-navy font-bold");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, "b", null, undefined, 0, "")).toBe("a b");
  });

  it("flattens nested arrays", () => {
    expect(cn("a", ["b", ["c", "d"]])).toBe("a b c d");
  });

  it("applies object-style truthy keys only", () => {
    expect(cn({ active: true, disabled: false, hidden: null, focused: 1 })).toBe("active focused");
  });

  it("returns an empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns an empty string when all inputs are falsy", () => {
    expect(cn(false, null, undefined, "")).toBe("");
  });
});
