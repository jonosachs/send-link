const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(`${__dirname}/background.js`, "utf8");

function harness({ confirmed = true, sendLink = true } = {}) {
  let click;
  const calls = [];
  const context = vm.createContext({
    importScripts() {},
    CONFIG: { VERCEL_TOKEN: "test-token" },
    console: { info() {} },
    confirm(message) {
      calls.push(["confirm", message]);
      return message.startsWith("Copy") ? confirmed : sendLink;
    },
    document: {
      documentElement: {
        cloneNode() {
          calls.push(["scrape"]);
          return { querySelectorAll: () => [], outerHTML: "<html>Article</html>" };
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

test("confirmation precedes scraping and Vercel deployment, then opens a link draft", async () => {
  const { click, calls } = harness();
  await click({ id: 1 });
  assert.deepEqual(calls.map(([type]) => type),
    ["badge", "confirm", "badge", "scrape", "deploy", "badge", "confirm", "email"]);
  const [, endpoint, options] = calls.find(([type]) => type === "deploy");
  assert.match(endpoint, /^https:\/\/api\.vercel\.com\//);
  assert.equal(options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(options.body).files,
    [{ file: "index.html", data: "<!doctype html>\n<html>Article</html>" }]);
  const email = new URL(calls.find(([type]) => type === "email")[1]);
  assert.equal(email.protocol, "mailto:");
  assert.equal(email.searchParams.get("body"), "http://shared.vercel.app");
});

test("declining the email prompt keeps the deployment and opens no draft", async () => {
  const { click, calls } = harness({ sendLink: false });
  await click({ id: 1 });
  assert.equal(calls.filter(([type]) => type === "deploy").length, 1);
  assert.equal(calls.some(([type]) => type === "email"), false);
});
