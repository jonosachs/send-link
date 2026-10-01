const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(`${__dirname}/background.js`, "utf8");

function harness({ confirmed = true, pageDocument } = {}) {
  let click;
  const calls = [];
  const context = vm.createContext({
    importScripts() {},
    CONFIG: { VERCEL_TOKEN: "test-token" },
    URL,
    console: { info() {} },
    confirm(message) {
      calls.push(["confirm", message]);
      return confirmed;
    },
    document: pageDocument || {
      baseURI: "https://example.com/story",
      createElement() { return {}; },
      querySelectorAll() { return []; },
      documentElement: {
        cloneNode() {
          calls.push(["scrape"]);
          return {
            querySelectorAll: () => [],
            querySelector: () => ({ prepend() {} }),
            outerHTML: "<html>Article</html>",
          };
        },
      },
    },
    async fetch(url, options) {
      calls.push(["deploy", url, options]);
      return { ok: true, async json() { return { url: "shared.vercel.app" }; } };
    },
    chrome: {
      action: {
        onClicked: { addListener(fn) { click = fn; } },
        async setBadgeText({ text }) { calls.push(["badge", text]); },
      },
      scripting: {
        async executeScript({ func, args = [] }) {
          return [{ result: func(...args) }];
        },
      },
      tabs: { async create({ url }) { calls.push(["email", url]); } },
    },
  });
  vm.runInContext(source, context);
  return { click, calls };
}

test("cancel prevents scraping, deployment, and email", async () => {
  const { click, calls } = harness({ confirmed: false });
  await click({ id: 1 });
  assert.deepEqual(calls.map(([type]) => type), ["badge", "confirm"]);
  assert.equal(calls[0][1], "");
  assert.match(calls[1][1], /publicly accessible/);
});

test("preserves the source base and loaded CSS with stylesheet-relative asset URLs", async () => {
  let copiedBase;
  let copiedStyle;
  let removedBase = false;
  let removedScript = false;
  const stylesheet = {
    media: "screen",
    sheet: {
      href: "https://example.com/css/article.css",
      cssRules: [
        { cssText: '.article { background: url("../images/banner.png"); }' },
        { cssText: "@font-face { src: url(./font.woff2); }" },
        { cssText: '@import "./extra.css" screen;' },
        { cssText: '.icon { filter: url(#shadow); }' },
      ],
    },
  };
  const blockedStylesheet = {
    sheet: { get cssRules() { throw new Error("Cross-origin stylesheet"); } },
  };
  const clone = {
    outerHTML: "<html>Article</html>",
    querySelector: () => ({ prepend(base) { copiedBase = base; } }),
    querySelectorAll(selector) {
      if (selector === "base") return [{ remove() { removedBase = true; } }];
      if (selector === "script") return [{ remove() { removedScript = true; } }];
      return [
        { replaceWith(style) { copiedStyle = style; } },
        { replaceWith() { assert.fail("Keep inaccessible stylesheet links"); } },
      ];
    },
  };
  const { click } = harness({ pageDocument: {
    baseURI: "https://example.com/articles/",
    createElement: () => ({}),
    documentElement: { cloneNode: () => clone },
    querySelectorAll: () => [stylesheet, blockedStylesheet],
  } });
  await click({ id: 1 });
  assert.equal(copiedBase.href, "https://example.com/articles/");
  assert.equal(removedBase, true);
  assert.equal(removedScript, true);
  assert.equal(copiedStyle.media, "screen");
  assert.match(copiedStyle.textContent, /url\("https:\/\/example.com\/images\/banner.png"\)/);
  assert.match(copiedStyle.textContent, /url\("https:\/\/example.com\/css\/font.woff2"\)/);
  assert.match(copiedStyle.textContent, /@import "https:\/\/example.com\/css\/extra.css" screen/);
  assert.match(copiedStyle.textContent, /url\("#shadow"\)/);
});

test("confirmation precedes scraping and Vercel deployment, then opens a link draft", async () => {
  const { click, calls } = harness();
  await click({ id: 1 });
  assert.deepEqual(calls.map(([type]) => type),
    ["badge", "confirm", "badge", "scrape", "deploy", "badge", "email"]);
  assert.match(calls[1][1], /open an email draft/);
  const [, endpoint, options] = calls.find(([type]) => type === "deploy");
  assert.match(endpoint, /^https:\/\/api\.vercel\.com\//);
  assert.equal(options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(options.body).files,
    [{ file: "index.html", data: "<!doctype html>\n<html>Article</html>" }]);
  const email = new URL(calls.find(([type]) => type === "email")[1]);
  assert.equal(email.protocol, "mailto:");
  assert.equal(email.searchParams.get("body"), "http://shared.vercel.app");
});
