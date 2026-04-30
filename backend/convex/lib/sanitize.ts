/**
 * Input sanitization and validation utilities for LLM-facing text fields.
 * Applied to all user-provided content before it enters a Gemini prompt.
 */

/** Phrases commonly used in prompt injection attempts (case-insensitive). */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|context)/gi,
  /ignore\s+all\s+instructions/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions\s*:/gi,
  /\bsystem\s*:/gi,
  /\bassistant\s*:/gi,
  /forget\s+(everything|all|the\s+above)/gi,
  /\bdisregard\b.*\b(instructions|above|previous|prior)\b/gi,
  /\boverride\b.*\b(instructions|prompt|system)\b/gi,
  /do\s+not\s+follow\s+(the\s+)?(above|previous|prior)/gi,
  /pretend\s+you\s+are/gi,
  /act\s+as\s+(if\s+you\s+are|a\b)/gi,
  /\brole\s*:\s*/gi,
  /```\s*system\b/gi,
];

/** Matches XML/HTML-like tags that could break prompt delimiters. */
const XML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/g;

/**
 * Sanitises user-provided text before it is interpolated into a prompt.
 *
 * 1. Truncates to `maxLength` characters.
 * 2. Strips XML / HTML tags (prevents delimiter escape).
 * 3. Replaces known injection phrases with `[FILTERED]`.
 * 4. Collapses runs of 3+ newlines into 2.
 * 5. Trims leading / trailing whitespace.
 */
export function sanitizeUserInput(text: string, maxLength: number): string {
  let result = text.slice(0, maxLength);

  // Strip XML/HTML tags
  result = result.replace(XML_TAG_PATTERN, "");

  // Replace known injection phrases
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, "[FILTERED]");
  }

  // Collapse excessive newlines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * JSON-stringify a value for inclusion in a prompt, escaping `<` and `>` to
 * their unicode escape forms. The escapes remain valid JSON string literals
 * (they decode back to `<`/`>`) but ensure the raw characters never appear in
 * the prompt stream, preventing a user from forging a closing delimiter tag
 * (e.g. `</syllabus_content>`) and escaping the sandbox.
 *
 * Use this instead of raw `JSON.stringify` whenever you embed structured user
 * data inside XML-delimited prompt sections.
 */
export function safeStringifyForPrompt(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

/**
 * Throws a descriptive error if `text` exceeds `maxLength` characters.
 * Call this at the action level before any prompt construction.
 */
export function validateLength(text: string, maxLength: number, fieldName: string): void {
  if (text.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
}
