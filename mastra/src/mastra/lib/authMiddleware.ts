export function createAuthMiddleware() {
  return async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => unknown }, next: () => Promise<void>) => {
    const secret = process.env.MASTRA_SERVER_SECRET;
    if (!secret) return next();
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${secret}`) return c.json({ error: "Unauthorized" }, 401);
    return next();
  };
}
