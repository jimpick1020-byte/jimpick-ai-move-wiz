import { defineConfig } from "vitest/config";
// No Start RPC transformation: exercise the actual handlers with synthetic
// authentication, isolated PostgreSQL and a fake provider, never hosted writes.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "node", include: ["src/lib/payapp*.test.ts", "src/lib/payapp*.vitest.ts"] },
});