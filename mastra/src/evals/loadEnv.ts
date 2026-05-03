/**
 * Loads mastra/.env then mastra/.env.local (local overrides). Used by npm run eval.
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const mastraDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(mastraDir, ".env") });
config({ path: resolve(mastraDir, ".env.local"), override: true });
