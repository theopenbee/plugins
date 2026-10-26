import { test } from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../scripts/lib/npm.mjs";
import { planRelease } from "../scripts/lib/release.mjs";
import { fakeFetch, makeTgz } from "./helpers.mjs";

const packumentUrl = "https://registry.npmjs.org/@theopenbee%2Fplugins";

function published(versions, catalogs = {}) {
  const routes = {};
  const doc = { name: "@theopenbee/plugins", versions: {} };
  for (const version of versions) {
    const tarball = `https://registry.npmjs.org/@theopenbee/plugins/-/plugins-${version}.tgz`;
    doc.versions[version] = { version, dist: { tarball } };
    routes[tarball] = { body: makeTgz({ "package.json": { version }, "catalog.json": catalogs[version] ?? `{"v":"${version}"}\n` }) };
  }
  routes[packumentUrl] = { json: doc };
  return routes;
}

function plan(routes, catalog = '{"new":true}\n') {
  return planRelease({ registry: createRegistry({ fetch: fakeFetch(routes) }), catalog });
}

test("unpublished package is 1.0.0", async () => {
  assert.deepEqual(await plan({}), { publish: true, version: "1.0.0" });
});

test("first release of this schema is 1.0.0", async () => {
  assert.deepEqual(await plan(published(["0.9.0", "2.0.0"])), { publish: true, version: "1.0.0" });
});

test("same catalog skips publish", async () => {
  const catalog = '{"same":true}\n';
  const routes = published(["1.0.0", "1.0.1"], { "1.0.1": catalog });
  assert.deepEqual(await plan(routes, catalog), { publish: false });
});

test("changed catalog bumps patch of the highest version", async () => {
  assert.deepEqual(await plan(published(["1.0.0", "1.0.10", "1.0.9"])), { publish: true, version: "1.0.11" });
});

test("ignores 2.x and prerelease versions", async () => {
  const routes = published(["1.0.3", "1.1.0-beta.1", "2.0.0"]);
  assert.deepEqual(await plan(routes), { publish: true, version: "1.0.4" });
});

test("compares against the highest version only", async () => {
  const catalog = '{"old":true}\n';
  const routes = published(["1.0.0", "1.0.1"], { "1.0.0": catalog });
  assert.deepEqual(await plan(routes, catalog), { publish: true, version: "1.0.2" });
});
