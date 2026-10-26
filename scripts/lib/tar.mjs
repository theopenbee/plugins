import { gunzipSync } from "node:zlib";

const BLOCK = 512;

function field(header, offset, length) {
  const raw = header.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? length : end).toString("utf8");
}

function paxPath(body) {
  let rest = body.toString("utf8");
  while (rest.length > 0) {
    const space = rest.indexOf(" ");
    const length = Number.parseInt(rest.slice(0, space), 10);
    if (!Number.isFinite(length) || length <= 0) return undefined;
    const record = rest.slice(space + 1, length - 1);
    rest = rest.slice(length);
    if (record.startsWith("path=")) return record.slice(5);
  }
  return undefined;
}

function stripRoot(path) {
  const slash = path.indexOf("/");
  return slash === -1 ? "" : path.slice(slash + 1);
}

export function readPackageFiles(tgz, names) {
  const data = gunzipSync(tgz);
  const wanted = new Set(names);
  const found = new Map();
  let offset = 0;
  let longName;
  while (offset + BLOCK <= data.length) {
    const header = data.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const size = Number.parseInt(field(header, 124, 12).trim() || "0", 8);
    const type = field(header, 156, 1) || "0";
    const body = data.subarray(offset + BLOCK, offset + BLOCK + size);
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    if (type === "x") {
      longName = paxPath(body) ?? longName;
      continue;
    }
    if (type === "L") {
      longName = field(body, 0, body.length);
      continue;
    }
    if (type === "g") continue;
    const prefix = field(header, 345, 155);
    const name = longName ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
    longName = undefined;
    if (type !== "0") continue;
    const path = stripRoot(name);
    if (wanted.has(path) && !found.has(path)) found.set(path, Buffer.from(body));
  }
  return found;
}
