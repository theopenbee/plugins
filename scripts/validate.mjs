import { fileURLToPath } from "node:url";
import { createRegistry } from "./lib/npm.mjs";
import { collect } from "./lib/run.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const { errors, repo } = await collect(root, createRegistry());

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  console.error(`${errors.length} error(s)`);
  process.exit(1);
}

console.log(`${repo.entries.length} plugins OK`);
