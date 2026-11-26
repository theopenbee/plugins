import { test } from "node:test";
import assert from "node:assert/strict";
import * as avatar from "../scripts/categories/avatar.mjs";
import * as channel from "../scripts/categories/channel.mjs";

function manifest(overrides = {}) {
  return {
    protocol_version: 1,
    type: "avatar",
    id: "mfers",
    name: { en: "mfers", zh: "mfers" },
    description: { en: "300 mfers by sartoshi as worker avatars (CC0)" },
    avatars: "avatars",
    ...overrides,
  };
}

function errorsFor(overrides) {
  return avatar.inspectManifest(manifest(overrides), "mfers").errors;
}

test("manifest file name", () => {
  assert.equal(avatar.manifestFile, "openbee.plugin.json");
});

test("accepts an avatar manifest without a command", () => {
  const { errors, info } = avatar.inspectManifest(manifest(), "mfers");
  assert.deepEqual(errors, []);
  assert.deepEqual(info, {
    name: { en: "mfers", zh: "mfers" },
    description: { en: "300 mfers by sartoshi as worker avatars (CC0)" },
    protocol_version: 1,
  });
});

test("requires type avatar", () => {
  assert.match(errorsFor({ type: undefined }).join("\n"), /type/);
  assert.match(errorsFor({ type: "engine" }).join("\n"), /"engine"/);
});

test("rejects command, setup and config", () => {
  assert.match(errorsFor({ command: ["node", "index.js"] }).join("\n"), /cannot declare command/);
  assert.match(errorsFor({ setup: { command: ["node"] } }).join("\n"), /cannot declare setup/);
  assert.match(errorsFor({ config: [] }).join("\n"), /cannot declare config/);
});

test("requires a folder inside the plugin", () => {
  for (const avatars of [undefined, "", ".", "/abs", "../up", "a/../../b", "C:\\x", 3]) {
    assert.match(errorsFor({ avatars }).join("\n"), /avatars must be a relative path/, String(avatars));
  }
  assert.deepEqual(errorsFor({ avatars: "./images/avatars" }), []);
});

test("applies the shared manifest rules", () => {
  assert.match(errorsFor({ protocol_version: 2 }).join("\n"), /protocol_version/);
  assert.match(errorsFor({ id: "nouns" }).join("\n"), /"nouns".*"mfers"/);
  assert.match(errorsFor({ icon: "../icon.svg" }).join("\n"), /icon/);
  assert.equal(avatar.inspectManifest(manifest({ icon: "icon.svg" }), "mfers").icon, "icon.svg");
});

test("channels still need a command", () => {
  const { errors } = channel.inspectManifest({ protocol_version: 1, id: "x1", command: [] }, "x1");
  assert.match(errors.join("\n"), /command/);
});
