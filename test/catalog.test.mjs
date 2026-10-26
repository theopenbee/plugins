import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_VERSION, buildCatalog, serializeCatalog } from "../scripts/lib/catalog.mjs";
import { defaultCategories, defaultTags } from "./helpers.mjs";

function entry(id, data, category = "channel") {
  return { category, id, file: `plugins/${category}/${id}.json`, data };
}

function resolvedFor(id) {
  return {
    info: { name: { en: id }, protocol_version: 1 },
    license: "MIT",
    publishedAt: "2026-10-25T08:00:00.000Z",
    integrity: `sha512-${id}`,
    tarball: `https://registry.npmjs.org/${id}/-/${id}-0.1.0.tgz`,
  };
}

function catalogOf(entries) {
  const repo = { categories: defaultCategories, tags: defaultTags, entries, errors: [] };
  const resolved = new Map(entries.map((e) => [e.file, resolvedFor(e.id)]));
  return buildCatalog(repo, resolved);
}

const official = {
  package: "@theopenbee/channel-discord",
  version: "0.1.0",
  repository: "https://github.com/theopenbee/channel-discord",
  maintainers: ["Qsnh"],
  tags: ["im"],
};

const external = {
  package: "openbee-channel-matrix",
  version: "1.2.3",
  repository: "https://gitlab.com/someone/matrix",
  maintainers: ["someone"],
};

test("top level holds schema version and vocabularies", () => {
  const catalog = catalogOf([]);
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(Object.keys(catalog), ["schema_version", "categories", "tags", "plugins"]);
  assert.equal(catalog.schema_version, 1);
  assert.deepEqual(catalog.categories, defaultCategories);
  assert.deepEqual(catalog.tags, defaultTags);
});

test("derives official", () => {
  const { plugins } = catalogOf([entry("discord", official), entry("matrix", external)]);
  assert.equal(plugins.find((p) => p.id === "discord").official, true);
  assert.equal(plugins.find((p) => p.id === "matrix").official, false);
});

test("writes plugin keys in a fixed order and omits absent optional fields", () => {
  const [plugin] = catalogOf([entry("matrix", external)]).plugins;
  assert.deepEqual(Object.keys(plugin), [
    "category",
    "id",
    "package",
    "version",
    "official",
    "name",
    "protocol_version",
    "license",
    "repository",
    "maintainers",
    "tags",
    "published_at",
    "integrity",
    "tarball",
  ]);
  assert.deepEqual(plugin.tags, []);
});

test("includes optional fields and normalizes deprecated", () => {
  const data = { ...official, min_openbee_version: "0.1.0", deprecated: "Use telegram instead" };
  const repo = { categories: defaultCategories, tags: defaultTags, entries: [entry("discord", data)], errors: [] };
  const resolved = new Map([
    ["plugins/channel/discord.json", { ...resolvedFor("discord"), info: { name: { en: "Discord" }, description: { en: "Bot" }, protocol_version: 1 } }],
  ]);
  const [plugin] = buildCatalog(repo, resolved).plugins;
  assert.deepEqual(plugin.description, { en: "Bot" });
  assert.equal(plugin.min_openbee_version, "0.1.0");
  assert.deepEqual(plugin.deprecated, { en: "Use telegram instead" });
  assert.deepEqual(Object.keys(plugin).slice(5, 8), ["name", "description", "protocol_version"]);
  assert.deepEqual(Object.keys(plugin).slice(-5), ["min_openbee_version", "deprecated", "published_at", "integrity", "tarball"]);
});

test("sorts plugins by category then id", () => {
  const plugins = catalogOf([
    entry("zeta", { ...external, package: "z" }, "channel"),
    entry("coder", { ...external, package: "c" }, "agent"),
    entry("alpha", { ...external, package: "a" }, "channel"),
  ]).plugins;
  assert.deepEqual(
    plugins.map((p) => `${p.category}/${p.id}`),
    ["agent/coder", "channel/alpha", "channel/zeta"],
  );
});

test("serializes deterministically", () => {
  const entries = [entry("discord", official), entry("matrix", external)];
  const a = serializeCatalog(catalogOf(entries));
  const b = serializeCatalog(catalogOf([...entries].reverse()));
  assert.equal(a, b);
  assert.ok(a.endsWith("}\n"));
  assert.equal(a.includes("generated"), false);
});
