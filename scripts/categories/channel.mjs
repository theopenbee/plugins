export const manifestFile = "openbee.plugin.json";

const protocolVersion = 1;
const idPattern = /^[a-z][a-z0-9_-]{1,31}$/;
const reservedIds = ["local"];
const reservedConfigKeys = ["enabled", "bot_name"];
const fieldTypes = ["string", "secret", "bool", "int", "list"];

export function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocalized(value) {
  if (typeof value === "string") return true;
  return isObject(value) && Object.values(value).every((v) => typeof v === "string");
}

function localized(value) {
  return typeof value === "string" ? { en: value } : value;
}

function isCommand(value) {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string") && value[0] !== "";
}

export function validateId(id) {
  if (!idPattern.test(id)) return `invalid plugin id "${id}": must match ${idPattern.source}`;
  if (reservedIds.includes(id)) return `plugin id "${id}" is reserved`;
  return null;
}

function configErrors(config) {
  if (config === undefined) return [];
  if (!Array.isArray(config)) return ["config must be an array"];
  const errors = [];
  const seen = new Set();
  for (const field of config) {
    if (!isObject(field)) {
      errors.push("config fields must be objects");
      continue;
    }
    const { key, type } = field;
    if (typeof key !== "string" || key === "") {
      errors.push("config field key must not be empty");
      continue;
    }
    if (reservedConfigKeys.includes(key)) errors.push(`config field key "${key}" is reserved`);
    if (seen.has(key)) errors.push(`duplicate config field key "${key}"`);
    seen.add(key);
    if (!fieldTypes.includes(type)) errors.push(`config field "${key}" has unknown type "${type}"`);
    if (field.random_default && type !== "string") errors.push(`config field "${key}": random_default needs type "string"`);
    for (const text of ["label", "help"]) {
      if (field[text] !== undefined && !isLocalized(field[text])) errors.push(`config field "${key}": ${text} must be a string or an object of strings`);
    }
  }
  return errors;
}

export function inspectCommon(manifest, id) {
  if (!isObject(manifest)) return { errors: [`${manifestFile} must be a JSON object`], info: null };
  const errors = [];
  if (manifest.protocol_version !== protocolVersion) {
    errors.push(`unsupported protocol_version ${JSON.stringify(manifest.protocol_version)} (supported: ${protocolVersion})`);
  }
  if (manifest.id !== id) errors.push(`manifest id ${JSON.stringify(manifest.id)} does not match entry id "${id}"`);
  if (!isCommand(manifest.command)) errors.push("manifest command must not be empty");
  if (manifest.setup !== undefined && !(isObject(manifest.setup) && isCommand(manifest.setup.command))) {
    errors.push("manifest setup command must not be empty");
  }
  for (const text of ["name", "description"]) {
    if (manifest[text] !== undefined && !isLocalized(manifest[text])) errors.push(`${text} must be a string or an object of strings`);
  }
  errors.push(...configErrors(manifest.config));
  if (errors.length > 0) return { errors, info: null };
  const { en, ...names } = localized(manifest.name ?? {});
  const info = { name: { en: en || id, ...names } };
  if (manifest.description !== undefined) info.description = localized(manifest.description);
  info.protocol_version = manifest.protocol_version;
  return { errors, info };
}

export function withErrors(result, errors) {
  if (errors.length === 0) return result;
  return { errors: [...result.errors, ...errors], info: null };
}

export function inspectManifest(manifest, id) {
  const result = inspectCommon(manifest, id);
  if (!isObject(manifest) || manifest.type === undefined || manifest.type === "channel") return result;
  return withErrors(result, [`manifest type ${JSON.stringify(manifest.type)} is not a channel`]);
}
