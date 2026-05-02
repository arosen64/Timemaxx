/**
 * AES-256-GCM encrypt/decrypt utilities for Google Calendar OAuth tokens.
 * Uses Web Crypto (crypto.subtle) — works in both edge (httpAction) and
 * Node ("use node" action) Convex runtimes.
 *
 * Key format: 64-char hex string (openssl rand -hex 32), set as CALENDAR_TOKEN_SECRET.
 * Ciphertext format: base64(iv[12 bytes] + ciphertext+authTag).
 */

function hexKeyToBytes(hexSecret: string): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-fA-F]{64}$/.test(hexSecret)) {
    throw new Error("CALENDAR_TOKEN_SECRET must be exactly 64 hex characters");
  }
  const bytes = hexSecret.match(/.{2}/g)!.map((b) => parseInt(b, 16));
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return view;
}

export async function encryptToken(plaintext: string, hexSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    hexKeyToBytes(hexSecret),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"] as KeyUsage[]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const result = new Uint8Array(12 + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...result));
}

export async function decryptToken(ciphertext: string, hexSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    hexKeyToBytes(hexSecret),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const raw = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
