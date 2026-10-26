import { test } from "node:test";
import assert from "node:assert/strict";
import { createRegistry } from "../scripts/lib/npm.mjs";
import { inspectEntries } from "../scripts/lib/inspect.mjs";
import { loadRepo } from "../scripts/lib/repo.mjs";
import { collect } from "../scripts/lib/run.mjs";
import { discordEntry, discordManifest, fakeFetch, npmPackage, writeRepo } from "./helpers.mjs";

const discord = "plugins/channel/discord.json";

async function inspect(routes, entry = discordEntry()) {
  const repo = await loadRepo(await writeRepo({ [discord]: entry }));
  const fetch = fakeFetch(routes);
  return inspectEntries(repo, createRegistry({ fetch, retryDelay: 0 }));
}

test("resolves a valid entry", async () => {
  const pkg = npmPackage();
  const { errors, resolved } = await inspect(pkg.routes);
  assert.deepEqual(errors, []);
  assert.deepEqual(resolved.get(discord), {
    info: {
      name: { en: "Discord", zh: "Discord" },
      description: { en: "Discord bot channel", zh: "Discord 机器人渠道" },
      protocol_version: 1,
    },
    license: "MIT",
    publishedAt: "2026-10-25T08:00:00.000Z",
    integrity: pkg.integrity,
    tarball: pkg.tarball,
  });
});

test("reports package not found on npm", async () => {
  const { errors } = await inspect({});
  assert.deepEqual(errors, [`${discord}: package "@theopenbee/channel-discord" not found on npm`]);
});

test("reports version not published", async () => {
  const { errors } = await inspect(npmPackage({ version: "0.0.9" }).routes);
  assert.deepEqual(errors, [`${discord}: @theopenbee/channel-discord@0.1.0 is not published on npm`]);
});

test("reports npm being unreachable", async () => {
  const routes = { "https://registry.npmjs.org/@theopenbee%2Fchannel-discord": { error: true } };
  const { errors } = await inspect(routes);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^plugins\/channel\/discord\.json: cannot read @theopenbee\/channel-discord@0\.1\.0 from npm: /);
});

test("reports integrity mismatch", async () => {
  const { errors } = await inspect(npmPackage({ integrity: "sha512-AAAA" }).routes);
  assert.deepEqual(errors, [`${discord}: tarball of @theopenbee/channel-discord@0.1.0 does not match its integrity`]);
});

test("reports package.json version differs", async () => {
  const files = {
    "package.json": { name: "@theopenbee/channel-discord", version: "0.2.0", license: "MIT" },
    "openbee.plugin.json": discordManifest,
  };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.deepEqual(errors, [`${discord}: package.json version "0.2.0" does not match "0.1.0"`]);
});

test("reports package.json name differs", async () => {
  const files = {
    "package.json": { name: "channel-discord", version: "0.1.0", license: "MIT" },
    "openbee.plugin.json": discordManifest,
  };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.deepEqual(errors, [`${discord}: package.json name "channel-discord" does not match "@theopenbee/channel-discord"`]);
});

test("reports missing license", async () => {
  const files = {
    "package.json": { name: "@theopenbee/channel-discord", version: "0.1.0" },
    "openbee.plugin.json": discordManifest,
  };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.deepEqual(errors, [`${discord}: package.json has no license`]);
});

test("reports missing openbee.plugin.json", async () => {
  const files = { "package.json": { name: "@theopenbee/channel-discord", version: "0.1.0", license: "MIT" } };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.deepEqual(errors, [`${discord}: openbee.plugin.json is missing from @theopenbee/channel-discord@0.1.0`]);
});

test("reports invalid openbee.plugin.json", async () => {
  const files = {
    "package.json": { name: "@theopenbee/channel-discord", version: "0.1.0", license: "MIT" },
    "openbee.plugin.json": "{ nope",
  };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^plugins\/channel\/discord\.json: openbee\.plugin\.json is not valid JSON/);
});

test("reports manifest errors from the category module", async () => {
  const files = {
    "package.json": { name: "@theopenbee/channel-discord", version: "0.1.0", license: "MIT" },
    "openbee.plugin.json": { ...discordManifest, id: "telegram" },
  };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.deepEqual(errors, [`${discord}: openbee.plugin.json: manifest id "telegram" does not match entry id "discord"`]);
});

test("collect skips npm checks when offline checks fail", async () => {
  const root = await writeRepo({ [discord]: discordEntry({ tags: ["chat"] }) });
  const fetch = fakeFetch(npmPackage().routes);
  const { errors } = await collect(root, createRegistry({ fetch }));
  assert.deepEqual(errors, [`${discord}: unknown tag "chat"`]);
  assert.deepEqual(fetch.calls, []);
});

test("collect returns npm errors and resolved entries", async () => {
  const root = await writeRepo({ [discord]: discordEntry() });
  const { errors, repo, resolved } = await collect(root, createRegistry({ fetch: fakeFetch(npmPackage().routes) }));
  assert.deepEqual(errors, []);
  assert.equal(repo.entries.length, 1);
  assert.equal(resolved.size, 1);
});
