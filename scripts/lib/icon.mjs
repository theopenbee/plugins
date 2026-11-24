export const MAX_ICON_SIZE = 32 << 10;

const svgNamespace = "http://www.w3.org/2000/svg";
const forbiddenElements = ["script", "foreignobject"];
const entities = { lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' };
const namePattern = /[A-Za-z_][A-Za-z0-9._-]*(?::[A-Za-z_][A-Za-z0-9._-]*)?/y;
const referencePattern = /&(?:#([0-9]+)|#x([0-9A-Fa-f]+)|([A-Za-z][A-Za-z0-9]*));/y;
const declarationPattern =
  /<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(["'])1\.0\1(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(["'])[Uu][Tt][Ff]-8\2)?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(["'])(?:yes|no)\3)?[ \t\r\n]*\?>/y;
const spacePattern = /[ \t\r\n]*/y;
const invalidCharPattern = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/u;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

class InvalidIcon extends Error {}

export function iconPath(value) {
  if (typeof value !== "string" || !/\.svg$/i.test(value) || value.startsWith("/") || /[\\:]/.test(value)) return null;
  const parts = [];
  for (const part of value.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function isChar(code) {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

function prefixOf(name) {
  const colon = name.indexOf(":");
  return colon === -1 ? null : name.slice(0, colon);
}

function localOf(name) {
  return name.slice(name.indexOf(":") + 1);
}

function scan(text) {
  let pos = 0;
  let seenRoot = false;
  const stack = [];

  const reject = (message) => {
    throw new InvalidIcon(message);
  };
  const malformed = (detail) => reject(`not valid XML: line ${text.slice(0, pos).split("\n").length}: ${detail}`);

  const skipSpace = () => {
    spacePattern.lastIndex = pos;
    spacePattern.exec(text);
    const moved = spacePattern.lastIndex > pos;
    pos = spacePattern.lastIndex;
    return moved;
  };

  const readName = () => {
    namePattern.lastIndex = pos;
    const match = namePattern.exec(text);
    if (!match) malformed("expected a name");
    pos = namePattern.lastIndex;
    return match[0];
  };

  const decode = (raw) => {
    let out = "";
    let i = 0;
    for (;;) {
      const amp = raw.indexOf("&", i);
      if (amp === -1) return out + raw.slice(i);
      referencePattern.lastIndex = amp;
      const match = referencePattern.exec(raw);
      if (!match) malformed('"&" must start a character reference');
      let char;
      if (match[3] !== undefined) {
        if (!Object.hasOwn(entities, match[3])) malformed(`unknown entity &${match[3]};`);
        char = entities[match[3]];
      } else {
        const code = match[1] !== undefined ? Number.parseInt(match[1], 10) : Number.parseInt(match[2], 16);
        if (!isChar(code)) malformed(`invalid character reference ${match[0]}`);
        char = String.fromCodePoint(code);
      }
      out += raw.slice(i, amp) + char;
      i = referencePattern.lastIndex;
    }
  };

  const openElement = (name, attrs) => {
    const local = localOf(name);
    if (stack.length === 0) {
      if (seenRoot || name !== "svg") reject("root element must be <svg>");
      if (attrs.find((a) => a.name === "xmlns")?.value !== svgNamespace) reject(`<svg> must declare xmlns="${svgNamespace}"`);
      seenRoot = true;
    }
    if (forbiddenElements.includes(local.toLowerCase())) reject(`<${local}> is not allowed`);
    for (const attr of attrs) {
      const attrLocal = localOf(attr.name);
      const lower = attrLocal.toLowerCase();
      if (lower.startsWith("on")) reject(`event attribute ${JSON.stringify(attrLocal)} is not allowed`);
      if (lower === "href" && !/^[ \t\r\n]*#/.test(attr.value)) reject("links outside the icon are not allowed");
    }
    const prefixes = new Set(stack.at(-1)?.prefixes ?? ["xml"]);
    for (const attr of attrs) {
      if (prefixOf(attr.name) !== "xmlns") continue;
      if (attr.value === "") malformed(`${attr.name} must not be empty`);
      prefixes.add(localOf(attr.name));
    }
    for (const qualified of [name, ...attrs.map((a) => a.name)]) {
      const prefix = prefixOf(qualified);
      if (prefix === null || prefixes.has(prefix) || (prefix === "xmlns" && qualified !== name)) continue;
      malformed(`namespace prefix "${prefix}" is not declared`);
    }
    return prefixes;
  };

  const startTag = () => {
    pos += 1;
    const name = readName();
    const attrs = [];
    for (;;) {
      const spaced = skipSpace();
      if (text[pos] === ">" || text.startsWith("/>", pos)) break;
      if (!spaced) malformed(`expected ">" or an attribute in <${name}>`);
      const attr = readName();
      skipSpace();
      if (text[pos] !== "=") malformed(`attribute ${attr} in <${name}> has no value`);
      pos += 1;
      skipSpace();
      const quote = text[pos];
      if (quote !== '"' && quote !== "'") malformed(`attribute ${attr} in <${name}> is not quoted`);
      const close = text.indexOf(quote, pos + 1);
      if (close === -1) malformed(`attribute ${attr} in <${name}> is not closed`);
      const raw = text.slice(pos + 1, close);
      if (raw.includes("<")) malformed(`"<" in attribute ${attr} of <${name}>`);
      if (attrs.some((a) => a.name === attr)) malformed(`duplicate attribute ${attr} in <${name}>`);
      attrs.push({ name: attr, value: decode(raw) });
      pos = close + 1;
    }
    const selfClosing = text[pos] === "/";
    pos += selfClosing ? 2 : 1;
    const prefixes = openElement(name, attrs);
    if (!selfClosing) stack.push({ name, prefixes });
  };

  const endTag = () => {
    pos += 2;
    const name = readName();
    skipSpace();
    if (text[pos] !== ">") malformed(`expected ">" after </${name}`);
    pos += 1;
    const open = stack.pop();
    if (!open) malformed(`unexpected </${name}>`);
    if (open.name !== name) malformed(`element <${open.name}> closed by </${name}>`);
  };

  const instruction = () => {
    const start = pos;
    pos += 2;
    const target = readName();
    if (target !== "xml") reject(`processing instruction ${JSON.stringify(target)} is not allowed`);
    if (start !== 0) malformed("the XML declaration must come first");
    declarationPattern.lastIndex = 0;
    if (!declarationPattern.exec(text)) malformed('the XML declaration must be <?xml version="1.0" encoding="UTF-8"?>');
    pos = declarationPattern.lastIndex;
  };

  const comment = () => {
    const close = text.indexOf("-->", pos + 4);
    if (close === -1) malformed("comment is not closed");
    const body = text.slice(pos + 4, close);
    if (body.includes("--") || body.endsWith("-")) malformed('"--" in a comment');
    pos = close + 3;
  };

  const cdata = () => {
    if (stack.length === 0) reject("text outside the <svg> element");
    const close = text.indexOf("]]>", pos + 9);
    if (close === -1) malformed("CDATA section is not closed");
    pos = close + 3;
  };

  const charData = (end) => {
    const chunk = text.slice(pos, end);
    if (stack.length === 0) {
      if (!/^[ \t\r\n]*$/.test(chunk)) reject("text outside the <svg> element");
    } else {
      if (chunk.includes("]]>")) malformed('"]]>" in text');
      decode(chunk);
    }
    pos = end;
  };

  while (pos < text.length) {
    const lt = text.indexOf("<", pos);
    if (lt !== pos) charData(lt === -1 ? text.length : lt);
    else if (text.startsWith("<!--", pos)) comment();
    else if (text.startsWith("<![CDATA[", pos)) cdata();
    else if (text.startsWith("<![", pos)) malformed("invalid <![ section");
    else if (text.startsWith("<!", pos)) reject("DOCTYPE and ENTITY declarations are not allowed");
    else if (text.startsWith("<?", pos)) instruction();
    else if (text.startsWith("</", pos)) endTag();
    else startTag();
  }
  if (stack.length > 0) malformed(`<${stack.at(-1).name}> is not closed`);
  if (!seenRoot) reject("root element must be <svg>");
}

export function validateIcon(data) {
  let text;
  try {
    text = utf8.decode(data);
  } catch {
    return "not valid XML: invalid UTF-8";
  }
  const bad = invalidCharPattern.exec(text);
  if (bad) return `not valid XML: illegal character U+${bad[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
  try {
    scan(text);
    return null;
  } catch (err) {
    if (err instanceof InvalidIcon) return err.message;
    throw err;
  }
}
