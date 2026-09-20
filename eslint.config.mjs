import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "node_modules/**", "preview-site/**", "infra/cloudflare/admin-mail-worker/node_modules/**", "infra/cloudflare/admin-mail-worker/worker-configuration.d.ts", "infra/cloudflare/admin-mail-worker/.wrangler/**"]),
]);
