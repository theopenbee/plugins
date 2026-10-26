import { SCHEMA_VERSION } from "./catalog.mjs";
import { readPackageFiles } from "./tar.mjs";

const releasePattern = /^(\d+)\.(\d+)\.(\d+)$/;

function latestRelease(versions, major) {
  let latest;
  for (const version of versions) {
    const match = releasePattern.exec(version);
    if (!match) continue;
    const parts = match.slice(1).map(Number);
    if (parts[0] !== major) continue;
    if (!latest || parts[1] > latest.parts[1] || (parts[1] === latest.parts[1] && parts[2] > latest.parts[2])) {
      latest = { version, parts };
    }
  }
  return latest;
}

export async function planRelease({ registry, name = "@theopenbee/plugins", catalog }) {
  const doc = await registry.packument(name);
  if (!doc) return { publish: false, missing: true };
  const latest = latestRelease(Object.keys(doc.versions ?? {}), SCHEMA_VERSION);
  if (!latest) return { publish: true, version: `${SCHEMA_VERSION}.0.0` };
  const tgz = await registry.download(doc.versions[latest.version].dist.tarball);
  const current = readPackageFiles(tgz, ["catalog.json"]).get("catalog.json")?.toString("utf8");
  if (current === catalog) return { publish: false };
  const [major, minor, patch] = latest.parts;
  return { publish: true, version: `${major}.${minor}.${patch + 1}` };
}
