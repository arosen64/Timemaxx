import { vi, test, expect, beforeEach, afterEach } from "vitest";
import { createAuthMiddleware } from "../mastra/lib/authMiddleware";

const middleware = createAuthMiddleware();

beforeEach(() => {
  process.env.MASTRA_SERVER_SECRET = "correct-secret";
});
afterEach(() => {
  delete process.env.MASTRA_SERVER_SECRET;
});

test("returns 401 when token is wrong", async () => {
  const next = vi.fn();
  const ctx = { req: { header: () => "Bearer wrong" }, json: vi.fn() };
  await middleware(ctx, next);
  expect(next).not.toHaveBeenCalled();
  expect(ctx.json).toHaveBeenCalledWith({ error: "Unauthorized" }, 401);
});

test("returns 401 when Authorization header is missing", async () => {
  const next = vi.fn();
  const ctx = { req: { header: () => undefined }, json: vi.fn() };
  await middleware(ctx, next);
  expect(next).not.toHaveBeenCalled();
  expect(ctx.json).toHaveBeenCalledWith({ error: "Unauthorized" }, 401);
});

test("passes through with correct token", async () => {
  const next = vi.fn();
  const ctx = { req: { header: () => "Bearer correct-secret" }, json: vi.fn() };
  await middleware(ctx, next);
  expect(next).toHaveBeenCalled();
  expect(ctx.json).not.toHaveBeenCalled();
});

test("passes through when secret is unset (local dev no-op)", async () => {
  delete process.env.MASTRA_SERVER_SECRET;
  const next = vi.fn();
  const ctx = { req: { header: () => undefined }, json: vi.fn() };
  await middleware(ctx, next);
  expect(next).toHaveBeenCalled();
  expect(ctx.json).not.toHaveBeenCalled();
});
