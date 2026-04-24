/**
 * Encodes SIS MCQ context / pick payloads as base64 JSON so delimiters in titles cannot break parsing.
 * Legacy pipe-delimited IDs are still decoded for in-flight sessions.
 */

const LEGACY_CTX = "__sis_ctx__|";
const LEGACY_PICK = "__sis_pick__|";
const V1_CTX = "sis_ctx:v1:";
const V1_PICK = "sis_pick:v1:";

export type SisContextPayload = { term: string; school: string; query: string };
export type SisCandidatePayload = { offeringName: string; title: string; term: string; school: string };

function utf8ToBase64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeSisContext(input: SisContextPayload): string {
  return `${V1_CTX}${utf8ToBase64(JSON.stringify(input))}`;
}

export function decodeSisContext(s: string): SisContextPayload | null {
  if (s.startsWith(V1_CTX)) {
    const raw = base64ToUtf8(s.slice(V1_CTX.length));
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const term = typeof o.term === "string" ? o.term : "";
      const school = typeof o.school === "string" ? o.school : "";
      const query = typeof o.query === "string" ? o.query : "";
      if (!term || !school || !query) return null;
      return { term, school, query };
    } catch {
      return null;
    }
  }
  if (!s.startsWith(LEGACY_CTX)) return null;
  const body = s.slice(LEGACY_CTX.length);
  const [term, school, query] = body.split("||");
  if (!term || !school || !query) return null;
  return { term, school, query };
}

export function encodeSisCandidate(input: SisCandidatePayload): string {
  return `${V1_PICK}${utf8ToBase64(JSON.stringify(input))}`;
}

export function decodeSisCandidate(s: string): SisCandidatePayload | null {
  if (s.startsWith(V1_PICK)) {
    const raw = base64ToUtf8(s.slice(V1_PICK.length));
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const offeringName = typeof o.offeringName === "string" ? o.offeringName : "";
      const title = typeof o.title === "string" ? o.title : "";
      const term = typeof o.term === "string" ? o.term : "";
      const school = typeof o.school === "string" ? o.school : "";
      if (!offeringName || !title || !term || !school) return null;
      return { offeringName, title, term, school };
    } catch {
      return null;
    }
  }
  if (!s.startsWith(LEGACY_PICK)) return null;
  const body = s.slice(LEGACY_PICK.length);
  const [offeringName, title, term, school] = body.split("||");
  if (!offeringName || !title || !term || !school) return null;
  return { offeringName, title, term, school };
}

/** True if this id was produced by encodeSisCandidate (v1 or legacy). */
export function isSisCandidateEntityId(id: string): boolean {
  return id.startsWith(V1_PICK) || id.startsWith(LEGACY_PICK);
}
