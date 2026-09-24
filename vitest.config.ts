import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against the real Supabase project (and, for the API tests, the running dev server),
// so the same `.env.local` the app uses is loaded up front.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: unit tests still run; the integration tests fail with a clear message.
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
