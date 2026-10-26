import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRegistry, verifyIntegrity } from "../scripts/lib/npm.mjs";
import { fakeFetch } from "./helpers.mjs";

const url = "https://registry.npmjs.org/@theopenbee%2Fchannel-discord";

test("encodes scoped names and bypasses the registry cache", async () => {
  const fetch = fakeFetch({ [url]: { json: { name: "@theopenbee/channel-discord" } } });
  const doc = await createRegistry({ fetch, now: () => 42 }).packument("@theopenbee/channel-discord");
  assert.deepEqual(fetch.calls, [`${url}?t=42`]);
  assert.equal(doc.name, "@theopenbee/channel-discord");
});

test("retries when the packument body is cut off", async () => {
  const fetch = fakeFetch({ [url]: [{ bodyError: true }, { json: { name: "ok" } }] });
  const doc = await createRegistry({ fetch, retryDelay: 0 }).packument("@theopenbee/channel-discord");
  assert.equal(doc.name, "ok");
  assert.equal(fetch.calls.length, 2);
});

test("retries when the tarball body is cut off", async () => {
  const tgz = "https://registry.npmjs.org/x/-/x-1.0.0.tgz";
  const fetch = fakeFetch({ [tgz]: [{ bodyError: true }, { body: Buffer.from("abc") }] });
  const buf = await createRegistry({ fetch, retryDelay: 0 }).download(tgz);
  assert.equal(buf.toString(), "abc");
  assert.equal(fetch.calls.length, 2);
});

test("does not retry client errors", async () => {
  const fetch = fakeFetch({ [url]: { status: 403 } });
  await assert.rejects(createRegistry({ fetch, retryDelay: 0 }).packument("@theopenbee/channel-discord"), /403/);
  assert.equal(fetch.calls.length, 1);
});

test("returns null for 404", async () => {
  const fetch = fakeFetch({});
  assert.equal(await createRegistry({ fetch }).packument("@theopenbee/channel-discord"), null);
});

test("retries a 503 then succeeds", async () => {
  const fetch = fakeFetch({ [url]: [{ status: 503 }, { error: true }, { json: { name: "ok" } }] });
  const doc = await createRegistry({ fetch, retryDelay: 0 }).packument("@theopenbee/channel-discord");
  assert.equal(doc.name, "ok");
  assert.equal(fetch.calls.length, 3);
});

test("throws after three failures", async () => {
  const fetch = fakeFetch({ [url]: [{ status: 500 }] });
  await assert.rejects(createRegistry({ fetch, retryDelay: 0 }).packument("@theopenbee/channel-discord"), /500/);
  assert.equal(fetch.calls.length, 3);
});

test("downloads a tarball", async () => {
  const tgz = "https://registry.npmjs.org/x/-/x-1.0.0.tgz";
  const fetch = fakeFetch({ [tgz]: { body: Buffer.from("abc") } });
  const buf = await createRegistry({ fetch }).download(tgz);
  assert.equal(buf.toString(), "abc");
});

test("download fails on 404", async () => {
  const fetch = fakeFetch({});
  await assert.rejects(createRegistry({ fetch }).download("https://registry.npmjs.org/x/-/x-1.0.0.tgz"), /404/);
});

test("verifyIntegrity accepts matching and rejects other hashes", () => {
  const buf = Buffer.from("tarball");
  const good = "sha512-" + createHash("sha512").update(buf).digest("base64");
  const other = "sha512-" + createHash("sha512").update("other").digest("base64");
  assert.equal(verifyIntegrity(buf, good), true);
  assert.equal(verifyIntegrity(buf, other), false);
  assert.equal(verifyIntegrity(buf, "sha1-abc"), false);
});
