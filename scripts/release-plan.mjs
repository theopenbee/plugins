import { appendFile, readFile } from "node:fs/promises";
import { createRegistry } from "./lib/npm.mjs";
import { planRelease } from "./lib/release.mjs";

const catalog = await readFile(new URL("../catalog.json", import.meta.url), "utf8");
const plan = await planRelease({ registry: createRegistry(), catalog });

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `publish=${plan.publish}\nversion=${plan.version ?? ""}\n`);
}

console.log(plan.publish ? `publish ${plan.version}` : "catalog unchanged, nothing to publish");
