import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const idPattern = /^[a-z][a-z0-9-]*$/;

export function categoryModulePath(id) {
  return `scripts/categories/${id}.mjs`;
}

export async function loadCategory(id) {
  if (!idPattern.test(id)) return null;
  const url = new URL(`../categories/${id}.mjs`, import.meta.url);
  if (!existsSync(fileURLToPath(url))) return null;
  return import(url.href);
}
