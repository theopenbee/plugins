import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

export function createRegistry({
  fetch = globalThis.fetch,
  url = "https://registry.npmjs.org",
  attempts = 3,
  retryDelay = 1000,
  now = Date.now,
} = {}) {
  const base = url.replace(/\/+$/, "");

  async function request(target, read, { allowMissing = false } = {}) {
    let failure;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1 && retryDelay > 0) await sleep(retryDelay * (attempt - 1));
      let res;
      try {
        res = await fetch(target);
      } catch (err) {
        failure = new Error(`GET ${target}: ${err.message}`);
        continue;
      }
      if (res.status >= 500) {
        failure = new Error(`GET ${target}: HTTP ${res.status}`);
        continue;
      }
      if (res.status === 404 && allowMissing) return null;
      if (!res.ok) throw new Error(`GET ${target}: HTTP ${res.status}`);
      try {
        return await read(res);
      } catch (err) {
        failure = new Error(`GET ${target}: ${err.message}`);
      }
    }
    throw failure;
  }

  return {
    packument(name) {
      return request(`${base}/${name.replace("/", "%2F")}?t=${now()}`, (res) => res.json(), { allowMissing: true });
    },
    download(target) {
      return request(target, async (res) => Buffer.from(await res.arrayBuffer()));
    },
  };
}

export function verifyIntegrity(buf, integrity) {
  if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) return false;
  return createHash("sha512").update(buf).digest("base64") === integrity.slice("sha512-".length);
}
