import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import Ajv from "ajv";
import { categoryModulePath, loadCategory } from "./categories.mjs";

const entrySchema = JSON.parse(await readFile(new URL("../../schema/entry.schema.json", import.meta.url), "utf8"));

const vocabularySchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name"],
    properties: {
      id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
      name: {
        type: "object",
        required: ["en"],
        additionalProperties: { type: "string", minLength: 1 },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
const validateEntry = ajv.compile(entrySchema);
const validateVocabulary = ajv.compile(vocabularySchema);

const fieldMessages = {
  package: "package must be a valid npm package name",
  version: "version must be an exact version like 1.2.3 (no ranges or prereleases)",
  repository: "repository must be an https URL",
  maintainers: "maintainers must be a non-empty list of unique GitHub usernames",
  tags: "tags must be a list of unique tag ids",
  min_openbee_version: "min_openbee_version must be an exact version like 1.2.3",
  deprecated: 'deprecated must be a non-empty string or an object of texts with an "en" key',
};

const officialScope = "@theopenbee/";
const officialRepository = "https://github.com/theopenbee/";

export function isOfficial(packageName) {
  return packageName.startsWith(officialScope);
}

async function readJson(root, file, errors) {
  let text;
  try {
    text = await readFile(join(root, file), "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      errors.push(`${file}: missing file`);
      return undefined;
    }
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    errors.push(`${file}: invalid JSON: ${err.message}`);
    return undefined;
  }
}

async function listDir(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export async function loadRepo(root) {
  const errors = [];
  const categories = await readJson(root, "categories.json", errors);
  const tags = await readJson(root, "tags.json", errors);
  const entries = [];
  for (const dir of (await listDir(join(root, "plugins"))).sort(byName)) {
    if (!dir.isDirectory()) {
      errors.push(`plugins/${dir.name}: unexpected file`);
      continue;
    }
    for (const item of (await listDir(join(root, "plugins", dir.name))).sort(byName)) {
      const file = `plugins/${dir.name}/${item.name}`;
      if (!item.isFile() || !item.name.endsWith(".json")) {
        errors.push(`${file}: unexpected file`);
        continue;
      }
      const data = await readJson(root, file, errors);
      if (data === undefined) continue;
      entries.push({ category: dir.name, id: item.name.slice(0, -".json".length), file, data });
    }
  }
  return { categories, tags, entries, errors };
}

function vocabularyErrors(list, file) {
  if (list === undefined) return [];
  if (!validateVocabulary(list)) {
    return validateVocabulary.errors.map((e) => `${file}: ${e.instancePath || "/"} ${e.message}`);
  }
  const errors = [];
  const seen = new Set();
  for (const { id } of list) {
    if (seen.has(id)) errors.push(`${file}: duplicate id "${id}"`);
    seen.add(id);
  }
  return errors;
}

function ids(list) {
  return new Set(Array.isArray(list) ? list.map((item) => item?.id) : []);
}

function schemaErrors(data) {
  if (validateEntry(data)) return [];
  const messages = [];
  for (const e of validateEntry.errors) {
    let message;
    if (e.keyword === "additionalProperties" && e.instancePath === "") {
      message = `unknown field "${e.params.additionalProperty}"`;
    } else if (e.keyword === "required" && e.instancePath === "") {
      message = `missing field "${e.params.missingProperty}"`;
    } else if (e.instancePath === "") {
      message = "entry must be a JSON object";
    } else {
      const field = e.instancePath.split("/")[1];
      message = fieldMessages[field] ?? `${e.instancePath} ${e.message}`;
    }
    if (!messages.includes(message)) messages.push(message);
  }
  return messages;
}

export async function checkRepo(repo) {
  const errors = [...vocabularyErrors(repo.categories, "categories.json"), ...vocabularyErrors(repo.tags, "tags.json")];
  const categoryIds = ids(repo.categories);
  const tagIds = ids(repo.tags);
  const modules = new Map();
  for (const id of categoryIds) {
    if (typeof id !== "string") continue;
    const mod = await loadCategory(id);
    if (mod) modules.set(id, mod);
    else errors.push(`categories.json: category "${id}" has no module ${categoryModulePath(id)}`);
  }
  const packages = new Map();
  for (const entry of repo.entries) {
    const report = (message) => errors.push(`${entry.file}: ${message}`);
    if (!categoryIds.has(entry.category)) {
      report(`unknown category "${entry.category}"`);
      continue;
    }
    const mod = modules.get(entry.category);
    const idError = mod?.validateId(entry.id);
    if (idError) report(idError);
    const fieldErrors = schemaErrors(entry.data);
    fieldErrors.forEach(report);
    if (fieldErrors.length > 0) continue;
    const { data } = entry;
    for (const tag of data.tags ?? []) {
      if (!tagIds.has(tag)) report(`unknown tag "${tag}"`);
    }
    const previous = packages.get(data.package);
    if (previous) report(`package "${data.package}" is already registered in ${previous}`);
    else packages.set(data.package, entry.file);
    if (isOfficial(data.package) && !data.repository.startsWith(officialRepository)) {
      report(`official packages must have a repository under ${officialRepository}`);
    }
  }
  return errors;
}
