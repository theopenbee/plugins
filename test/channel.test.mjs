import { test } from "node:test";
import assert from "node:assert/strict";
import * as channel from "../scripts/categories/channel.mjs";

function manifest(overrides = {}) {
  return {
    protocol_version: 1,
    id: "discord",
    name: { en: "Discord", zh: "Discord" },
    description: { en: "Discord bot channel", zh: "Discord 机器人渠道" },
    command: ["node", "dist/index.js"],
    config: [
      { key: "token", type: "secret", required: true },
      { key: "allowed_guilds", type: "list" },
      { key: "max_media_size", type: "int", default: 10485760 },
    ],
    ...overrides,
  };
}

function errorsFor(overrides) {
  return channel.inspectManifest(manifest(overrides), "discord").errors;
}

test("manifest file name", () => {
  assert.equal(channel.manifestFile, "openbee.plugin.json");
});

test("accepts the discord manifest", () => {
  const { errors, info } = channel.inspectManifest(manifest(), "discord");
  assert.deepEqual(errors, []);
  assert.deepEqual(info, {
    name: { en: "Discord", zh: "Discord" },
    description: { en: "Discord bot channel", zh: "Discord 机器人渠道" },
    protocol_version: 1,
  });
});

test("rejects protocol_version 2", () => {
  assert.match(errorsFor({ protocol_version: 2 }).join("\n"), /protocol_version/);
});

test("rejects manifest id different from file id", () => {
  assert.match(errorsFor({ id: "telegram" }).join("\n"), /"telegram".*"discord"/);
});

test("rejects empty command", () => {
  assert.match(errorsFor({ command: [] }).join("\n"), /command/);
  assert.match(errorsFor({ command: [""] }).join("\n"), /command/);
});

test("rejects setup with empty command", () => {
  assert.match(errorsFor({ setup: { command: [] } }).join("\n"), /setup/);
});

test("accepts setup with a command", () => {
  assert.deepEqual(errorsFor({ setup: { command: ["node", "dist/setup.js"] } }), []);
});

test("rejects reserved config key", () => {
  assert.match(errorsFor({ config: [{ key: "enabled", type: "bool" }] }).join("\n"), /reserved/);
  assert.match(errorsFor({ config: [{ key: "bot_name", type: "string" }] }).join("\n"), /reserved/);
});

test("rejects duplicate config key", () => {
  const config = [{ key: "token", type: "secret" }, { key: "token", type: "string" }];
  assert.match(errorsFor({ config }).join("\n"), /duplicate/);
});

test("rejects empty config key", () => {
  assert.match(errorsFor({ config: [{ key: "", type: "string" }] }).join("\n"), /key/);
});

test("rejects unknown config type", () => {
  assert.match(errorsFor({ config: [{ key: "ratio", type: "float" }] }).join("\n"), /float/);
});

test("rejects random_default on int", () => {
  const config = [{ key: "port", type: "int", random_default: true }];
  assert.match(errorsFor({ config }).join("\n"), /random_default/);
});

test("rejects a manifest that is not an object", () => {
  const { errors, info } = channel.inspectManifest([], "discord");
  assert.notEqual(errors.length, 0);
  assert.equal(info, null);
});

test("normalizes string name", () => {
  const { info } = channel.inspectManifest(manifest({ name: "Discord", description: "Bot" }), "discord");
  assert.deepEqual(info.name, { en: "Discord" });
  assert.deepEqual(info.description, { en: "Bot" });
});

test("falls back to id when name missing", () => {
  const { info } = channel.inspectManifest(manifest({ name: undefined, description: undefined }), "discord");
  assert.deepEqual(info.name, { en: "discord" });
  assert.equal("description" in info, false);
});

test("validateId", () => {
  assert.equal(channel.validateId("discord"), null);
  assert.equal(channel.validateId("we-com_2"), null);
  assert.match(channel.validateId("local"), /reserved/);
  assert.match(channel.validateId("Discord"), /must match/);
  assert.match(channel.validateId("a"), /must match/);
  assert.match(channel.validateId("a".repeat(33)), /must match/);
});
