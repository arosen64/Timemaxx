import "dotenv/config";
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.CONVEX_URL);

const id = await client.mutation("mutations/random:insertRandom", {
  value: Math.random().toString(36).slice(2),
});

console.log("Inserted:", id);
const rows = await client.query("queries/random:listRandoms", {})
console.log(rows);