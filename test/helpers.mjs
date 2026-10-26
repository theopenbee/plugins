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
    const route = routes[url];
    let spec = route ?? { status: 404, json: { error: "Not found" } };
    if (Array.isArray(route)) {
      const index = served.get(url) ?? 0;
      served.set(url, index + 1);
      spec = route[Math.min(index, route.length - 1)];
    }
    if (spec.error) throw new TypeError("fetch failed");
    const status = spec.status ?? 200;
    const body = spec.body ?? Buffer.from(JSON.stringify(spec.json ?? {}));
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(body.toString()),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
    };
  };
  fetch.calls = [];
  return fetch;
}
