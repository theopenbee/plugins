import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ICON_SIZE, iconPath, validateIcon } from "../scripts/lib/icon.mjs";

const ns = 'xmlns="http://www.w3.org/2000/svg"';
const svg = `<svg ${ns} viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg>`;

function check(text) {
  return validateIcon(Buffer.from(text));
}

test("max icon size is 32 KiB", () => {
  assert.equal(MAX_ICON_SIZE, 32768);
});

test("iconPath normalizes paths inside the package", () => {
  assert.equal(iconPath("icon.svg"), "icon.svg");
  assert.equal(iconPath("./assets/icon.svg"), "assets/icon.svg");
  assert.equal(iconPath("assets//icon.svg"), "assets/icon.svg");
  assert.equal(iconPath("assets/../icon.svg"), "icon.svg");
  assert.equal(iconPath("Icon.SVG"), "Icon.SVG");
});

test("iconPath rejects paths that are not an svg inside the package", () => {
  for (const value of [
    "",
    "icon.png",
    "icon.svg/",
    "icon",
    "/icon.svg",
    "../icon.svg",
    "assets/../../icon.svg",
    "C:/icon.svg",
    "assets\\icon.svg",
    42,
    null,
    ["icon.svg"],
  ]) {
    assert.equal(iconPath(value), null, JSON.stringify(value));
  }
});

test("accepts plain icons", () => {
  for (const text of [
    svg,
    `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`,
    `<?xml version='1.0' encoding='utf-8' standalone='no'?>${svg}`,
    `<!-- mark -->${svg}<!-- end -->`,
    `<svg ${ns}><defs><path id="a" d="M0 0h1v1z"/></defs><use href="#a"/></svg>`,
    `<svg ${ns} xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href=" #a"/></svg>`,
    `<svg ${ns} xml:space="preserve"><style><![CDATA[ a > b { fill: red } ]]></style><text>A &amp; B &#x41;&#65;</text></svg>`,
    `<svg\r\n  ${ns}\r\n></svg >`,
  ]) {
    assert.equal(check(text), null, text);
  }
});

test("rejects icons that are not well-formed XML", () => {
  for (const text of [
    `<svg ${ns}><path></svg>`,
    `<svg ${ns}><g>`,
    `<svg ${ns} a=b/>`,
    `<svg ${ns} a/>`,
    `<svg ${ns} a="<"/>`,
    `<svg ${ns} a="1" a="2"/>`,
    `<svg ${ns}>&foo;</svg>`,
    `<svg ${ns}>&constructor;</svg>`,
    `<svg ${ns}>a & b</svg>`,
    `<svg ${ns}>&#0;</svg>`,
    `<svg ${ns}>\u0001</svg>`,
    `<svg ${ns}><!-- a -- b --></svg>`,
    `<svg ${ns}><x:path/></svg>`,
    `<svg ${ns} a:b:c="1"/>`,
    `<?xml version="1.1"?>${svg}`,
    `<?xml version="1.0" encoding="ISO-8859-1"?>${svg}`,
    ` <?xml version="1.0"?>${svg}`,
  ]) {
    assert.match(check(text), /^not valid XML: /, text);
  }
  assert.equal(validateIcon(Buffer.from([0x3c, 0xff, 0x3e])), "not valid XML: invalid UTF-8");
});

test("requires a single svg root in the SVG namespace", () => {
  assert.equal(check(""), "root element must be <svg>");
  assert.equal(check("<!-- only a comment -->"), "root element must be <svg>");
  assert.equal(check(`<html><svg ${ns}/></html>`), "root element must be <svg>");
  assert.equal(check(`<svg ${ns}/><svg ${ns}/>`), "root element must be <svg>");
  assert.equal(check(`<svg viewBox="0 0 1 1"/>`), '<svg> must declare xmlns="http://www.w3.org/2000/svg"');
  assert.equal(check(`<svg xmlns="http://www.w3.org/1999/xhtml"/>`), '<svg> must declare xmlns="http://www.w3.org/2000/svg"');
  assert.equal(check(`hello${svg}`), "text outside the <svg> element");
  assert.equal(check(`\ufeff${svg}`), "text outside the <svg> element");
});

test("rejects script and foreignObject in any case or prefix", () => {
  assert.equal(check(`<svg ${ns}><script>alert(1)</script></svg>`), "<script> is not allowed");
  assert.equal(check(`<svg ${ns}><SCRIPT/></svg>`), "<SCRIPT> is not allowed");
  assert.equal(check(`<svg ${ns} xmlns:x="u"><x:script/></svg>`), "<script> is not allowed");
  assert.equal(check(`<svg ${ns}><foreignObject><div/></foreignObject></svg>`), "<foreignObject> is not allowed");
});

test("rejects event attributes", () => {
  assert.equal(check(`<svg ${ns} onload="alert(1)"/>`), 'event attribute "onload" is not allowed');
  assert.equal(check(`<svg ${ns}><path OnClick="x"/></svg>`), 'event attribute "OnClick" is not allowed');
  assert.equal(check(`<svg ${ns} xmlns:x="u" x:onload="x"/>`), 'event attribute "onload" is not allowed');
});

test("allows only fragment links", () => {
  const links = "links outside the icon are not allowed";
  assert.equal(check(`<svg ${ns}><image href="https://example.com/a.png"/></svg>`), links);
  assert.equal(check(`<svg ${ns}><a HREF="https://example.com"/></svg>`), links);
  assert.equal(check(`<svg ${ns} xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="other.svg#a"/></svg>`), links);
  assert.equal(check(`<svg ${ns}><a href="&#x6a;avascript:alert(1)"/></svg>`), links);
  assert.equal(check(`<svg ${ns}><use href="&#35;a"/></svg>`), null);
});

test("rejects DOCTYPE and processing instructions", () => {
  assert.equal(check(`<!DOCTYPE svg [<!ENTITY a "x">]>${svg}`), "DOCTYPE and ENTITY declarations are not allowed");
  assert.equal(check(`<svg ${ns}><!ENTITY a "x"></svg>`), "DOCTYPE and ENTITY declarations are not allowed");
  assert.equal(check(`<?xml-stylesheet href="a.css"?>${svg}`), 'processing instruction "xml-stylesheet" is not allowed');
  assert.equal(check(`<svg ${ns}><?php echo 1 ?></svg>`), 'processing instruction "php" is not allowed');
});
