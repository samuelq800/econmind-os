// Local frontend only. Uses the project's existing public browser key; never
// passes a service-role/management token to Next or writes credentials to disk.
import { execFileSync, spawn } from "node:child_process";
const project = "vimksjrhaxdpnkvgsavz";
const keys = JSON.parse(
  execFileSync(
    "/opt/homebrew/bin/supabase",
    ["projects", "api-keys", "--project-ref", project, "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const publicKey = keys.find((key) => key.name === "anon")?.api_key;
if (!publicKey)
  throw new Error("The approved project public browser key is unavailable");
const port = process.env.SEASON1_PREVIEW_PORT ?? "3047";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid preview port");
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      ![
        "SUPABASE_ACCESS_TOKEN",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_DB_PASSWORD",
        "DATABASE_URL",
      ].includes(key),
  ),
);
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", port],
  {
    stdio: "inherit",
    env: {
      ...environment,
      NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
      NEXT_PUBLIC_SUPABASE_PROXY_URL: "https://supabase.econmind.group",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
console.log(
  `Season 1 connected preview: http://localhost:${port}/season1/countries (real account required; real saves enabled)`,
);
