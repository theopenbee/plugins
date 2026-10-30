import { test } from "node:test";
import assert from "node:assert/strict";
import * as engine from "../scripts/categories/engine.mjs";
import * as channel from "../scripts/categories/channel.mjs";

function manifest(overrides = {}) {
  return {
    protocol_version: 1,
    type: "engine",
    id: "pi",
    name: { en: "Pi", zh: "Pi" },
    description: { en: "Runs tasks with the pi coding agent", zh: "用 pi 编程助手执行任务" },
    command: ["node", "dist/index.js"],
    config: [{ key: "path", type: "string" }],
    ...overrides,
  };
}

function errorsFor(overrides) {
  return engine.inspectManifest(manifest(overrides), "pi").errors;
}

test("manifest file name", () => {
  assert.equal(engine.manifestFile, "openbee.plugin.json");
});

test("accepts an engine manifest", () => {
  const { errors, info } = engine.inspectManifest(manifest(), "pi");
  assert.deepEqual(errors, []);
  assert.deepEqual(info, {
    name: { en: "Pi", zh: "Pi" },
    description: { en: "Runs tasks with the pi coding agent", zh: "用 pi 编程助手执行任务" },
    protocol_version: 1,
  });
});

test("requires type engine", () => {
  assert.match(errorsFor({ type: undefined }).join("\n"), /type/);
  assert.match(errorsFor({ type: "channel" }).join("\n"), /"channel"/);
});

test("rejects setup", () => {
  const { errors, info } = engine.inspectManifest(manifest({ setup: { command: ["node", "dist/setup.js"] } }), "pi");
  assert.match(errors.join("\n"), /setup/);
  assert.equal(info, null);
});

test("applies the shared manifest rules", () => {
  assert.match(errorsFor({ protocol_version: 2 }).join("\n"), /protocol_version/);
  assert.match(errorsFor({ id: "claude" }).join("\n"), /"claude".*"pi"/);
  assert.match(errorsFor({ command: [] }).join("\n"), /command/);
  assert.match(errorsFor({ config: [{ key: "bot_name", type: "string" }] }).join("\n"), /reserved/);
});

test("rejects a manifest that is not an object", () => {
  const { errors, info } = engine.inspectManifest([], "pi");
  assert.notEqual(errors.length, 0);
  assert.equal(info, null);
});

test("validateId", () => {
  assert.equal(engine.validateId("pi"), null);
  assert.match(engine.validateId("local"), /reserved/);
});

test("channel entries reject engine manifests", () => {
  const { errors, info } = channel.inspectManifest(manifest(), "pi");
  assert.match(errors.join("\n"), /"engine"/);
  assert.equal(info, null);
});

test("channel entries accept an explicit channel type", () => {
  assert.deepEqual(channel.inspectManifest(manifest({ type: "channel" }), "pi").errors, []);
});
