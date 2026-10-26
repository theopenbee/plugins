import { isOfficial } from "./repo.mjs";

export const SCHEMA_VERSION = 1;

function localized(value) {
  return typeof value === "string" ? { en: value } : value;
}

function compare(a, b) {
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function pluginOf(entry, resolved) {
  const { data } = entry;
  const plugin = {
    category: entry.category,
    id: entry.id,
    package: data.package,
    version: data.version,
    official: isOfficial(data.package),
    name: resolved.info.name,
  };
  if (resolved.info.description !== undefined) plugin.description = resolved.info.description;
  plugin.protocol_version = resolved.info.protocol_version;
  plugin.license = resolved.license;
  plugin.repository = data.repository;
  plugin.maintainers = data.maintainers;
  plugin.tags = data.tags ?? [];
  if (data.min_openbee_version !== undefined) plugin.min_openbee_version = data.min_openbee_version;
  if (data.deprecated !== undefined) plugin.deprecated = localized(data.deprecated);
  if (resolved.publishedAt !== undefined) plugin.published_at = resolved.publishedAt;
  plugin.integrity = resolved.integrity;
  plugin.tarball = resolved.tarball;
  return plugin;
}

export function buildCatalog(repo, resolved) {
  return {
    schema_version: SCHEMA_VERSION,
    categories: repo.categories,
    tags: repo.tags,
    plugins: [...repo.entries].sort(compare).map((entry) => pluginOf(entry, resolved.get(entry.file))),
  };
}

export function serializeCatalog(catalog) {
  return JSON.stringify(catalog, null, 2) + "\n";
}
