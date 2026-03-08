import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: "backend",
          include: ["backend/**/*.test.ts"],
          environment: "edge-runtime",
          server: {
            deps: {
              inline: ["convex-test"],
            },
          },
        },
      },
      {
        plugins: [react()],
        test: {
          name: "frontend",
          include: ["frontend/tests/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          setupFiles: ["frontend/tests/setup.ts"],
          globals: true,
        },
      },
    ],
  },
});
