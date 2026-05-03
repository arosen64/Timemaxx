import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "dist/**",
        "frontend/dist/**",
        "frontend/tests/**",
        "backend/convex/_generated/**",
        "backend/convex-tests/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
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
        test: {
          name: "mastra",
          include: ["mastra/src/**/*.test.ts"],
          environment: "node",
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
