import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Email Worker has its own workspace, dependencies and test command.
  test: { include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
