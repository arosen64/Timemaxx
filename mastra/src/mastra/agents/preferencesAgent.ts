import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

/**
 * Maxx Preferences Agent — stub.
 * Directs users to the Preferences page to make changes.
 * TODO: implement actual preference reading/writing via Convex tools.
 */
export const preferencesAgent = new Agent({
  id: "preferences-agent",
  name: "Maxx Preferences Agent",
  instructions: `
You are Maxx Preferences Agent, embedded in TimeMaxx.
You help users understand and update their study preferences.
For now, acknowledge what they want to change and direct them to the Preferences page.
Output exactly ONE JSON object — no other text.

## JSON shape
{
  "message": string,
  "reasoning": string
}
  `.trim(),
  model: anthropic("claude-sonnet-4-20250514"),
});
