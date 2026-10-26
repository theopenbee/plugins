import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

export function createRegistry({ fetch = globalThis.fetch, url = "https://registry.npmjs.org", attempts = 3, retryDelay = 1000 } = {}) {
  const base = url.replace(/\/+$/, "");

  async function request(target) {
    let failure;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1 && retryDelay > 0) await sleep(retryDelay * (attempt - 1));
      try {
        const res = await fetch(target);
        if (res.status < 500) return res;
        failure = new Error(`GET ${target}: HTTP ${res.status}`);
      } catch (err) {
        failure = new Error(`GET ${target}: ${err.message}`);
      }
    }
    throw failure;
  }

  return {
    async packument(name) {
      const res = await request(`${base}/${name.replace("/", "%2F")}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET ${name}: HTTP ${res.status}`);
      return res.json();
    },
    async download(target) {
      const res = await request(target);
      if (!res.ok) throw new Error(`GET ${target}: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

export function verifyIntegrity(buf, integrity) {
  if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) return false;
  return createHash("sha512").update(buf).digest("base64") === integrity.slice("sha512-".length);
}
