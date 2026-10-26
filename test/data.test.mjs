import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { checkRepo, loadRepo } from "../scripts/lib/repo.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("repository data passes offline checks", async () => {
  const repo = await loadRepo(root);
  assert.deepEqual([...repo.errors, ...(await checkRepo(repo))], []);
  assert.notEqual(repo.entries.length, 0);
});
