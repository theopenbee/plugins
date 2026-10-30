import { inspectCommon, isObject, manifestFile, validateId, withErrors } from "./channel.mjs";

export { manifestFile, validateId };

export function inspectManifest(manifest, id) {
  const result = inspectCommon(manifest, id);
  if (!isObject(manifest)) return result;
  const errors = [];
  if (manifest.type !== "engine") errors.push(`manifest type ${JSON.stringify(manifest.type)} must be "engine"`);
  if (manifest.setup !== undefined) errors.push("engine plugins cannot declare setup");
  return withErrors(result, errors);
}
