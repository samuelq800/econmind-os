import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "node_modules/**", "backup/**", "preview-site/**", "infra/cloudflare/*/node_modules/**", "infra/cloudflare/*/worker-configuration.d.ts", "infra/cloudflare/*/.wrangler/**"]),
]);
