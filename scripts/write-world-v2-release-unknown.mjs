import { writeFile } from "node:fs/promises";
import path from "node:path";

const [flag, output] = process.argv.slice(2);
if (flag !== "--output" || !output) {
  process.stderr.write("WORLD_V2_RELEASE_UNKNOWN_ARGUMENTS_INVALID\n");
  process.exitCode = 1;
} else {
  await writeFile(
    path.resolve(output),
    `${JSON.stringify(
      {
        status: "WORLD_V2_RELEASE_UNKNOWN",
        reason: "TRANSPORT_OR_RESPONSE_EVIDENCE_UNAVAILABLE",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write("WORLD_V2_RELEASE_UNKNOWN\n");
}
