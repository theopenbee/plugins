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

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg>`;

function withIcon(icon, extra = {}) {
  return {
    "package.json": { name: "@theopenbee/channel-discord", version: "0.1.0", license: "MIT" },
    "openbee.plugin.json": { ...discordManifest, icon },
    ...extra,
  };
}

async function iconErrors(icon, extra) {
  const { errors } = await inspect(npmPackage({ files: withIcon(icon, extra) }).routes);
  return errors;
}

test("embeds the manifest icon", async () => {
  const pkg = npmPackage({ files: withIcon("./assets/icon.svg", { "assets/icon.svg": `\n${iconSvg}\n` }) });
  const { errors, resolved } = await inspect(pkg.routes);
  assert.deepEqual(errors, []);
  assert.equal(resolved.get(discord).info.icon, iconSvg);
});

test("leaves icon out when the manifest has none", async () => {
  const { resolved } = await inspect(npmPackage().routes);
  assert.equal("icon" in resolved.get(discord).info, false);
});

test("reports a missing icon file", async () => {
  assert.deepEqual(await iconErrors("icon.svg"), [
    `${discord}: openbee.plugin.json: icon "icon.svg" is missing from @theopenbee/channel-discord@0.1.0`,
  ]);
});

test("reports an icon that is too large", async () => {
  const big = `<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(32768)}</svg>`;
  assert.deepEqual(await iconErrors("icon.svg", { "icon.svg": big }), [
    `${discord}: openbee.plugin.json: icon "icon.svg" is ${Buffer.byteLength(big)} bytes, larger than 32768`,
  ]);
});

test("reports icons that break the icon rules", async () => {
  const cases = [
    [`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`, "<script> is not allowed"],
    [`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`, 'event attribute "onload" is not allowed'],
    [`<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>`, "links outside the icon are not allowed"],
    [`<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>`, "DOCTYPE and ENTITY declarations are not allowed"],
  ];
  for (const [svg, message] of cases) {
    assert.deepEqual(await iconErrors("icon.svg", { "icon.svg": svg }), [
      `${discord}: openbee.plugin.json: icon "icon.svg": ${message}`,
    ]);
  }
});

test("reports an icon path outside the package before reading it", async () => {
  for (const icon of ["icon.png", "/icon.svg", "../icon.svg", 7]) {
    assert.deepEqual(await iconErrors(icon, { "icon.png": iconSvg }), [
      `${discord}: openbee.plugin.json: icon ${JSON.stringify(icon)} must be a relative path to an .svg file inside the plugin`,
    ]);
  }
});

test("reports icon errors together with package.json errors", async () => {
  const files = { ...withIcon("icon.svg"), "package.json": { name: "@theopenbee/channel-discord", version: "0.1.0" } };
  const { errors } = await inspect(npmPackage({ files }).routes);
  assert.deepEqual(errors, [
    `${discord}: package.json has no license`,
    `${discord}: openbee.plugin.json: icon "icon.svg" is missing from @theopenbee/channel-discord@0.1.0`,
  ]);
});
