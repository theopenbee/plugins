import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.write("        ", 148, 8, "ascii");
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return header;
}

export function makeTgz(files, root = "package") {
  const blocks = [];
  for (const [name, value] of Object.entries(files)) {
    const content = Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
    blocks.push(tarHeader(`${root}/${name}`, content.length));
    blocks.push(content);
    const pad = (512 - (content.length % 512)) % 512;
    blocks.push(Buffer.alloc(pad));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

export function fakeFetch(routes) {
  const served = new Map();
  const fetch = async (url) => {
    fetch.calls.push(url);
    const key = url.split("?")[0];
    const route = routes[key];
    let spec = route ?? { status: 404, json: { error: "Not found" } };
    if (Array.isArray(route)) {
      const index = served.get(key) ?? 0;
      served.set(key, index + 1);
      spec = route[Math.min(index, route.length - 1)];
    }
    if (spec.error) throw new TypeError("fetch failed");
    const status = spec.status ?? 200;
    const body = spec.body ?? Buffer.from(JSON.stringify(spec.json ?? {}));
    const read = async () => {
      if (spec.bodyError) throw new TypeError("terminated");
      return body;
    };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse((await read()).toString()),
      arrayBuffer: async () => {
        const buf = await read();
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
      },
    };
  };
  fetch.calls = [];
  return fetch;
}

export const defaultCategories = [{ id: "channel", name: { en: "Channels", zh: "渠道" } }];

export const defaultTags = [
  { id: "im", name: { en: "Instant messaging", zh: "即时通讯" } },
  { id: "global", name: { en: "Global platforms", zh: "海外平台" } },
];

export function discordEntry(overrides = {}) {
  return {
    package: "@theopenbee/channel-discord",
    version: "0.1.0",
    repository: "https://github.com/theopenbee/channel-discord",
    maintainers: ["Qsnh"],
    tags: ["im", "global"],
    ...overrides,
  };
}

export async function writeRepo(entries, { categories = defaultCategories, tags = defaultTags } = {}) {
  const root = await mkdtemp(join(tmpdir(), "catalog-"));
  const files = { "categories.json": categories, "tags.json": tags, ...entries };
  for (const [path, value] of Object.entries(files)) {
    if (value === undefined) continue;
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }
  return root;
}

export const discordManifest = {
  protocol_version: 1,
  id: "discord",
  name: { en: "Discord", zh: "Discord" },
  description: { en: "Discord bot channel", zh: "Discord 机器人渠道" },
  command: ["node", "dist/index.js"],
  config: [{ key: "token", type: "secret", required: true }],
};

export function npmPackage({
  name = "@theopenbee/channel-discord",
  version = "0.1.0",
  files,
  integrity,
  time = "2026-10-25T08:00:00.000Z",
} = {}) {
  const tgz = makeTgz(files ?? { "package.json": { name, version, license: "MIT" }, "openbee.plugin.json": discordManifest });
  const base = name.split("/").pop();
  const tarball = `https://registry.npmjs.org/${name}/-/${base}-${version}.tgz`;
  const dist = { tarball, integrity: integrity ?? "sha512-" + createHash("sha512").update(tgz).digest("base64") };
  return {
    tarball,
    integrity: dist.integrity,
    routes: {
      [`https://registry.npmjs.org/${name.replace("/", "%2F")}`]: {
        json: { name, versions: { [version]: { name, version, dist } }, time: { [version]: time } },
      },
      [tarball]: { body: tgz },
    },
  };
}
