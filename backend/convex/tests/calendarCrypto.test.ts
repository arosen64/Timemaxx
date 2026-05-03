import { describe, expect, test } from "vitest";
import { decryptToken, encryptToken } from "../lib/calendarCrypto";

// 64-char hex (32 bytes) — matches `openssl rand -hex 32` output shape.
const HEX_KEY_A =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const HEX_KEY_B =
  "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

describe("encryptToken / decryptToken", () => {
  test("round-trips a plaintext token", async () => {
    const plaintext = "ya29.a0AfH6SMBexample-access-token-value";
    const ciphertext = await encryptToken(plaintext, HEX_KEY_A);
    expect(ciphertext).not.toBe(plaintext);
    expect(await decryptToken(ciphertext, HEX_KEY_A)).toBe(plaintext);
  });

  test("round-trips an empty string", async () => {
    const ciphertext = await encryptToken("", HEX_KEY_A);
    expect(await decryptToken(ciphertext, HEX_KEY_A)).toBe("");
  });

  test("round-trips multibyte unicode characters", async () => {
    const plaintext = "café — 你好 — 🎉";
    const ciphertext = await encryptToken(plaintext, HEX_KEY_A);
    expect(await decryptToken(ciphertext, HEX_KEY_A)).toBe(plaintext);
  });

  test("emits valid base64 output", async () => {
    const ciphertext = await encryptToken("hello", HEX_KEY_A);
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    // 12-byte IV + at least 16-byte auth tag = 28 raw bytes minimum,
    // base64-encoded length is at least 40 characters.
    expect(ciphertext.length).toBeGreaterThanOrEqual(40);
  });

  test("uses a fresh random IV per call (same plaintext yields different ciphertexts)", async () => {
    const plaintext = "same-token";
    const a = await encryptToken(plaintext, HEX_KEY_A);
    const b = await encryptToken(plaintext, HEX_KEY_A);
    expect(a).not.toBe(b);
    expect(await decryptToken(a, HEX_KEY_A)).toBe(plaintext);
    expect(await decryptToken(b, HEX_KEY_A)).toBe(plaintext);
  });

  test("decrypting with the wrong key fails (authenticated encryption)", async () => {
    const ciphertext = await encryptToken("secret", HEX_KEY_A);
    await expect(decryptToken(ciphertext, HEX_KEY_B)).rejects.toThrow();
  });

  test("decrypting tampered ciphertext fails the GCM auth tag check", async () => {
    const ciphertext = await encryptToken("secret", HEX_KEY_A);
    // Flip a character in the middle of the base64 payload to corrupt the
    // ciphertext / auth tag without changing length.
    const mid = Math.floor(ciphertext.length / 2);
    const swap = ciphertext[mid] === "A" ? "B" : "A";
    const tampered = ciphertext.slice(0, mid) + swap + ciphertext.slice(mid + 1);
    await expect(decryptToken(tampered, HEX_KEY_A)).rejects.toThrow();
  });

  test.each([
    ["short hex", "deadbeef"],
    ["non-hex characters", "z".repeat(64)],
    ["wrong length (63 chars)", "0".repeat(63)],
    ["wrong length (65 chars)", "0".repeat(65)],
    ["empty key", ""],
  ])("encrypt rejects invalid key: %s", async (_label, badKey) => {
    await expect(encryptToken("anything", badKey)).rejects.toThrow(
      /CALENDAR_TOKEN_SECRET must be exactly 64 hex characters/,
    );
  });

  test("decrypt rejects invalid key", async () => {
    const ciphertext = await encryptToken("hello", HEX_KEY_A);
    await expect(decryptToken(ciphertext, "not-hex")).rejects.toThrow(
      /CALENDAR_TOKEN_SECRET must be exactly 64 hex characters/,
    );
  });

  test("uppercase and lowercase hex keys are interchangeable", async () => {
    const ciphertext = await encryptToken("hello", HEX_KEY_A);
    expect(await decryptToken(ciphertext, HEX_KEY_A.toUpperCase())).toBe("hello");
  });
});
