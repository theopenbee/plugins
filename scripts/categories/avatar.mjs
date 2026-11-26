import { inspectCommon, isObject, manifestFile, validateId, withErrors } from "./channel.mjs";

export { manifestFile, validateId };

function isFolderPath(value) {
  if (typeof value !== "string" || value.startsWith("/") || /[\\:]/.test(value)) return false;
  const parts = value.split("/").filter((part) => part !== "" && part !== ".");
  return parts.length > 0 && !parts.includes("..");
}

export function inspectManifest(manifest, id) {
  const result = inspectCommon(manifest, id, { command: false });
  if (!isObject(manifest)) return result;
  const errors = [];
  if (manifest.type !== "avatar") errors.push(`manifest type ${JSON.stringify(manifest.type)} must be "avatar"`);
  for (const key of ["command", "setup", "config"]) {
    if (manifest[key] !== undefined) errors.push(`avatar plugins cannot declare ${key}`);
  }
  if (!isFolderPath(manifest.avatars)) errors.push("avatars must be a relative path to a folder inside the plugin");
  return withErrors(result, errors);
}
