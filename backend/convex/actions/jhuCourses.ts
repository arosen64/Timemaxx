"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const JHU_SIS_BASE_URL = "https://sis.jhu.edu/api/classes";

function getApiKey(): string {
  const key = process.env.JHU_SIS_API_KEY;
  if (!key) throw new Error("JHU_SIS_API_KEY environment variable is not set");
  return key;
}

async function sisFetch(url: string, endpoint: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch {
    throw new Error(`JHU SIS API request failed for ${endpoint}`);
  }
}

/**
 * Returns courses using the JHU SIS advanced search query string format.
 * Dept names with "/" must use "_" per the non-standard API encoding requirement.
 */
export const getCoursesByTerm = action({
  args: {
    term: v.string(),
    school: v.optional(v.string()),
    department: v.optional(v.string()),
    courseTitle: v.optional(v.string()),
    courseNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Build query string manually so we can apply the API's non-standard
    // department encoding: "/" must be replaced with "_" (not %2F).
    const encode = (v: string) => encodeURIComponent(v);
    const encodeDept = (v: string) => encodeURIComponent(v.replace(/\//g, "_"));

    const parts: string[] = [`key=${getApiKey()}`, `Term=${encode(args.term)}`];
    if (args.school) parts.push(`School=${encode(args.school)}`);
    if (args.department) parts.push(`Department=${encodeDept(args.department)}`);
    if (args.courseTitle) parts.push(`CourseTitle=${encode(args.courseTitle)}`);
    if (args.courseNumber) parts.push(`CourseNumber=${encode(args.courseNumber)}`);

    const res = await sisFetch(`${JHU_SIS_BASE_URL}?${parts.join("&")}`, "courses");
    if (!res.ok) {
      throw new Error(`JHU SIS API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const results = data as object[];
    if (results.length > 8000) {
      throw new Error(
        `Too many results (${results.length}). Please filter by school, department, or course title.`
      );
    }
    return results;
  },
});

/**
 * Returns all available schools from the JHU SIS API.
 */
export const getAvailableSchools = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const params = new URLSearchParams({ key: getApiKey() });
    const res = await sisFetch(`${JHU_SIS_BASE_URL}/codes/schools?${params}`, "schools");
    if (!res.ok) {
      throw new Error(`JHU SIS API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data as object[];
  },
});

/**
 * Returns all available term codes from the JHU SIS API.
 * The /terms endpoint returns an array of objects with a `Name` field.
 */
export const getAvailableTerms = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const params = new URLSearchParams({ key: getApiKey() });
    const res = await sisFetch(`${JHU_SIS_BASE_URL}/codes/terms?${params}`, "terms");
    if (!res.ok) {
      throw new Error(`JHU SIS API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data as object[];
  },
});
