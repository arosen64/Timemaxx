import { MastraClient } from "@mastra/client-js";

export function createMastraClient(baseUrl: string): MastraClient {
  const secret = process.env.MASTRA_SERVER_SECRET;
  return new MastraClient({
    baseUrl,
    ...(secret ? { headers: { Authorization: `Bearer ${secret}` } } : {}),
  });
}
