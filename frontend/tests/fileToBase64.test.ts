import { fileToBase64 } from "../src/utils/fileToBase64";

describe("fileToBase64", () => {
  it("encodes ASCII file contents to base64", async () => {
    const file = new File(["Hello, world!"], "hello.txt", { type: "text/plain" });
    expect(await fileToBase64(file)).toBe("SGVsbG8sIHdvcmxkIQ==");
  });

  it("encodes binary contents byte-for-byte", async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
    const file = new File([bytes], "blob.bin", { type: "application/octet-stream" });
    expect(await fileToBase64(file)).toBe("AAEC//4=");
  });

  it("returns an empty string for an empty file", async () => {
    const file = new File([], "empty.txt", { type: "text/plain" });
    expect(await fileToBase64(file)).toBe("");
  });

  it("matches the canonical base64 alphabet for known input", async () => {
    const file = new File(["A"], "a.txt", { type: "text/plain" });
    expect(await fileToBase64(file)).toBe("QQ==");
  });
});
