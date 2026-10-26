import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRepo, checkRepo } from "../scripts/lib/repo.mjs";
import { loadCategory } from "../scripts/lib/categories.mjs";
import { defaultCategories, defaultTags, discordEntry, writeRepo } from "./helpers.mjs";

async function errorsOf(entries, options) {
  const repo = await loadRepo(await writeRepo(entries, options));
  return [...repo.errors, ...(await checkRepo(repo))];
}

const discord = "plugins/channel/discord.json";

test("valid repo has no errors", async () => {
  assert.deepEqual(await errorsOf({ [discord]: discordEntry() }), []);
});

test("loads entries with category, id and file", async () => {
  const repo = await loadRepo(
    await writeRepo({
      [discord]: discordEntry(),
      "plugins/channel/alpha.json": discordEntry({ package: "alpha-channel", repository: "https://example.com/alpha" }),
    }),
  );
  assert.deepEqual(
    repo.entries.map(({ category, id, file }) => ({ category, id, file })),
    [
      { category: "channel", id: "alpha", file: "plugins/channel/alpha.json" },
      { category: "channel", id: "discord", file: discord },
    ],
  );
  assert.deepEqual(repo.categories, defaultCategories);
  assert.deepEqual(repo.tags, defaultTags);
});

test("rejects official field", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ official: true }) });
  assert.deepEqual(errors, [`${discord}: unknown field "official"`]);
});

test("rejects name and description fields", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ name: "Discord", description: "x" }) });
  assert.deepEqual(errors, [`${discord}: unknown field "name"`, `${discord}: unknown field "description"`]);
});

test("rejects version range", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ version: "^0.1.0" }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^plugins\/channel\/discord\.json: version /);
});

test("rejects prerelease version", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ version: "0.2.0-beta.1" }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /version/);
});

test("rejects missing required fields", async () => {
  const entry = discordEntry();
  delete entry.repository;
  const errors = await errorsOf({ [discord]: entry });
  assert.deepEqual(errors, [`${discord}: missing field "repository"`]);
});

test("rejects non-https repository", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ package: "x", repository: "git@github.com:a/b.git" }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /repository/);
});

test("rejects unknown tag", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ tags: ["im", "chat"] }) });
  assert.deepEqual(errors, [`${discord}: unknown tag "chat"`]);
});

test("rejects unknown category dir", async () => {
  const errors = await errorsOf({ "plugins/agent/coder.json": discordEntry() });
  assert.deepEqual(errors, [`plugins/agent/coder.json: unknown category "agent"`]);
});

test("rejects category without a module", async () => {
  const categories = [...defaultCategories, { id: "agent", name: { en: "Agents" } }];
  const errors = await errorsOf({ [discord]: discordEntry() }, { categories });
  assert.deepEqual(errors, [`categories.json: category "agent" has no module scripts/categories/agent.mjs`]);
});

test("rejects channel id local", async () => {
  const errors = await errorsOf({ "plugins/channel/local.json": discordEntry() });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^plugins\/channel\/local\.json: .*reserved/);
});

test("rejects invalid channel id", async () => {
  const errors = await errorsOf({ "plugins/channel/Discord.json": discordEntry() });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /must match/);
});

test("rejects duplicate package", async () => {
  const errors = await errorsOf({
    [discord]: discordEntry(),
    "plugins/channel/discord2.json": discordEntry(),
  });
  assert.deepEqual(errors, [
    `plugins/channel/discord2.json: package "@theopenbee/channel-discord" is already registered in ${discord}`,
  ]);
});

test("rejects official package outside theopenbee repo", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ repository: "https://github.com/someone/channel-discord" }) });
  assert.deepEqual(errors, [`${discord}: official packages must have a repository under https://github.com/theopenbee/`]);
});

test("accepts external package with any https repository", async () => {
  const entry = discordEntry({ package: "openbee-channel-matrix", repository: "https://gitlab.com/someone/matrix", maintainers: ["someone"] });
  assert.deepEqual(await errorsOf({ "plugins/channel/matrix.json": entry }), []);
});

test("rejects empty maintainers", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ maintainers: [] }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /maintainers/);
});

test("rejects invalid GitHub username", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ maintainers: ["not a user"] }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /maintainers/);
});

test("accepts optional fields", async () => {
  const entry = discordEntry({ min_openbee_version: "0.1.0", deprecated: { en: "Use x instead", zh: "请改用 x" } });
  assert.deepEqual(await errorsOf({ [discord]: entry }), []);
});

test("rejects deprecated object without en", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ deprecated: { zh: "弃用" } }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /deprecated/);
});

test("reports bad JSON and still checks others", async () => {
  const errors = await errorsOf({
    "plugins/channel/broken.json": "{ not json",
    [discord]: discordEntry({ tags: ["chat"] }),
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^plugins\/channel\/broken\.json: invalid JSON/);
  assert.equal(errors[1], `${discord}: unknown tag "chat"`);
});

test("rejects unexpected files", async () => {
  const errors = await errorsOf({
    [discord]: discordEntry(),
    "plugins/README.md": "x",
    "plugins/channel/notes.txt": "x",
    "plugins/channel/nested/a.json": "{}",
  });
  assert.deepEqual(errors.sort(), [
    "plugins/README.md: unexpected file",
    "plugins/channel/nested: unexpected file",
    "plugins/channel/notes.txt: unexpected file",
  ]);
});

test("rejects duplicate vocabulary ids", async () => {
  const tags = [...defaultTags, { id: "im", name: { en: "IM" } }];
  const errors = await errorsOf({ [discord]: discordEntry() }, { tags });
  assert.deepEqual(errors, [`tags.json: duplicate id "im"`]);
});

test("rejects malformed vocabulary", async () => {
  const errors = await errorsOf({ [discord]: discordEntry({ tags: [] }) }, { tags: [{ id: "im" }] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^tags\.json: /);
});

test("loadCategory", async () => {
  assert.equal(typeof (await loadCategory("channel")).inspectManifest, "function");
  assert.equal(await loadCategory("agent"), null);
  assert.equal(await loadCategory("../lib/repo"), null);
});
