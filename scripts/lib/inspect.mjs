import { loadCategory } from "./categories.mjs";
import { verifyIntegrity } from "./npm.mjs";
import { readPackageFiles } from "./tar.mjs";

function parseJson(buf) {
  try {
    return { value: JSON.parse(buf.toString("utf8")) };
  } catch (err) {
    return { error: err.message };
  }
}

async function inspectEntry(entry, registry) {
  const { package: name, version } = entry.data;
  const spec = `${name}@${version}`;
  let doc;
  let tgz;
  try {
    doc = await registry.packument(name);
    if (!doc) return { errors: [`package "${name}" not found on npm`] };
    const meta = doc.versions?.[version];
    if (!meta) return { errors: [`${spec} is not published on npm`] };
    if (typeof meta.dist?.integrity !== "string" || typeof meta.dist?.tarball !== "string") {
      return { errors: [`npm metadata of ${spec} has no tarball or integrity`] };
    }
    tgz = await registry.download(meta.dist.tarball);
  } catch (err) {
    return { errors: [`cannot read ${spec} from npm: ${err.message}`] };
  }
  const { integrity, tarball } = doc.versions[version].dist;
  if (!verifyIntegrity(tgz, integrity)) return { errors: [`tarball of ${spec} does not match its integrity`] };
  const category = await loadCategory(entry.category);
  let files;
  try {
    files = readPackageFiles(tgz, ["package.json", category.manifestFile]);
  } catch (err) {
    return { errors: [`cannot read tarball of ${spec}: ${err.message}`] };
  }
  const errors = [];
  const pkgFile = files.get("package.json");
  const pkg = pkgFile ? parseJson(pkgFile).value : undefined;
  if (!pkg || typeof pkg !== "object") {
    errors.push(`package.json is missing or invalid in ${spec}`);
  } else {
    if (pkg.name !== name) errors.push(`package.json name ${JSON.stringify(pkg.name)} does not match "${name}"`);
    if (pkg.version !== version) errors.push(`package.json version ${JSON.stringify(pkg.version)} does not match "${version}"`);
    if (typeof pkg.license !== "string" || pkg.license === "") errors.push("package.json has no license");
  }
  const manifestFile = files.get(category.manifestFile);
  if (!manifestFile) {
    errors.push(`${category.manifestFile} is missing from ${spec}`);
    return { errors };
  }
  const manifest = parseJson(manifestFile);
  if (manifest.error) {
    errors.push(`${category.manifestFile} is not valid JSON: ${manifest.error}`);
    return { errors };
  }
  const result = category.inspectManifest(manifest.value, entry.id);
  errors.push(...result.errors.map((e) => `${category.manifestFile}: ${e}`));
  if (errors.length > 0) return { errors };
  return {
    errors,
    resolved: { info: result.info, license: pkg.license, publishedAt: doc.time?.[version], integrity, tarball },
  };
}

export async function inspectEntries(repo, registry) {
  const results = await Promise.all(repo.entries.map((entry) => inspectEntry(entry, registry)));
  const errors = [];
  const resolved = new Map();
  repo.entries.forEach((entry, i) => {
    errors.push(...results[i].errors.map((e) => `${entry.file}: ${e}`));
    if (results[i].resolved) resolved.set(entry.file, results[i].resolved);
  });
  return { errors, resolved };
}
