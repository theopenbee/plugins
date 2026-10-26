import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildCatalog, serializeCatalog } from "./lib/catalog.mjs";
import { createRegistry } from "./lib/npm.mjs";
import { collect } from "./lib/run.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const { errors, repo, resolved } = await collect(root, createRegistry());

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  console.error(`${errors.length} error(s)`);
  process.exit(1);
}

await writeFile(new URL("../catalog.json", import.meta.url), serializeCatalog(buildCatalog(repo, resolved)));
console.log(`wrote catalog.json with ${repo.entries.length} plugins`);
