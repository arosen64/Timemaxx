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

    const queryString = parts.join("&");
    const res = await sisFetch(`${JHU_SIS_BASE_URL}?${queryString}`, "courses");
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
 * Returns details (including description) for a specific course offering.
 * offeringName is the SIS offering code, e.g. "AS.001.001" or "AS00410021".
 * term is the term string, e.g. "Summer 2026".
 */
export const getCourseDetails = action({
  args: {
    offeringName: v.string(),
    term: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // SIS detail endpoint expects dots removed and a trailing "1", e.g. "AS.010.222" → "AS0102221"
    const sisCode = args.offeringName.replace(/\./g, "") + "01";
    const encodedTerm = encodeURIComponent(args.term);
    const url = `${JHU_SIS_BASE_URL}/${sisCode}/${encodedTerm}?key=${getApiKey()}`;

    const res = await sisFetch(url, "course-details");
    if (!res.ok) {
      throw new Error(`JHU SIS API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    // The endpoint returns an array of sections; grab description from first section
    const sections = data as Array<Record<string, unknown>>;
    if (!sections.length) return null;

    const first = sections[0];
    const sectionDetails = (
      first.SectionDetails as Array<Record<string, unknown>> | undefined
    )?.[0];

    // Extract course codes (e.g. "EN.500.112") from each prereq's Expression or Description
    const prereqsArr = sectionDetails?.Prerequisites as
      | Array<{ Expression?: string; Description?: string }>
      | undefined;
    const courseCodeRegex = /[A-Z]{2}\.\d{3}\.\d{3}/g;
    const prereqs: string[] = [];
    for (const p of prereqsArr ?? []) {
      const source = p.Expression ?? p.Description ?? "";
      const matches = source.match(courseCodeRegex) ?? [];
      for (const code of matches) {
        if (!prereqs.includes(code)) prereqs.push(code);
      }
    }

    return {
      offeringName: first.OfferingName as string | undefined,
      title: first.Title as string | undefined,
      description:
        typeof sectionDetails?.Description === "string" ? sectionDetails.Description : undefined,
      prereqs: prereqs.length > 0 ? prereqs : undefined,
      credits: first.Credits as number | undefined,
      sections,
    };
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
