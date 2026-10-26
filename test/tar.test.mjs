import { test } from "node:test";
import assert from "node:assert/strict";
import { readPackageFiles } from "../scripts/lib/tar.mjs";
import { makeTgz } from "./helpers.mjs";

const files = {
  "package.json": { name: "x", version: "1.0.0" },
  "openbee.plugin.json": { id: "x" },
  "dist/index.js": "console.log(1)",
};

test("reads requested files", () => {
  const out = readPackageFiles(makeTgz(files), ["package.json", "openbee.plugin.json"]);
  assert.deepEqual(JSON.parse(out.get("package.json")), { name: "x", version: "1.0.0" });
  assert.deepEqual(JSON.parse(out.get("openbee.plugin.json")), { id: "x" });
});

test("ignores files not requested", () => {
  const out = readPackageFiles(makeTgz(files), ["package.json"]);
  assert.deepEqual([...out.keys()], ["package.json"]);
});

test("strips any root directory", () => {
  const out = readPackageFiles(makeTgz(files, "node-pkg"), ["openbee.plugin.json"]);
  assert.deepEqual(JSON.parse(out.get("openbee.plugin.json")), { id: "x" });
});

test("returns empty map for missing file", () => {
  const out = readPackageFiles(makeTgz(files), ["README.md"]);
  assert.equal(out.size, 0);
});

test("reads files larger than one block", () => {
  const big = "a".repeat(1300);
  const out = readPackageFiles(makeTgz({ "big.txt": big, "package.json": "{}" }), ["big.txt", "package.json"]);
  assert.equal(out.get("big.txt").toString(), big);
  assert.equal(out.get("package.json").toString(), "{}");
});
