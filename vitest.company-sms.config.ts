import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "node", include: ["src/lib/company-sms*.vitest.ts", "src/lib/balance-claim-db.test.ts", "src/lib/payment-review-db.test.ts"] },
});