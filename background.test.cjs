const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(`${__dirname}/background.js`, "utf8");

function element(tag, children = [], attributes = {}) {
  const node = {
    nodeType: 1, tagName: tag.toUpperCase(), ...attributes,
    childNodes: children.map((child) => typeof child === "string"
      ? { nodeType: 3, textContent: child } : child),
    getAttribute(name) { return this[name] ?? null; },
    matches(selector) {
      return selector.split(", ").some((part) => {
        if (part === "[hidden]") return Boolean(this.hidden);
        if (part === "[aria-hidden='true']") return this["aria-hidden"] === "true";
        const role = part.match(/^\[role='(.+)'\]$/);
        return role ? this.role === role[1] : part.toUpperCase() === this.tagName;
      });
    },
  };
  node.children = node.childNodes.filter((child) => child.nodeType === 1);
  node.childNodes.forEach((child) => { child.parentElement = node; });
  node.innerText = node.childNodes.map((child) => child.innerText ?? child.textContent).join("");
  return node;
}

function harness({ body, articles = [], confirmed = true, fail = false } = {}) {
  let click;
  const calls = [];
  const context = vm.createContext({
    URL, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    location: { href: "https://example.com/story" },
    document: {
      title: "A useful article", body,
      querySelectorAll(selector) { return selector === "article" ? articles : []; },
    },
    getComputedStyle(node) { return { display: node.display || "block", visibility: "visible" }; },
    console: { error() {} },
    chrome: {
      action: {
        onClicked: { addListener(fn) { click = fn; } },
        async setBadgeText({ text }) { calls.push(["badge", text]); },
        async setTitle() {},
      },
      scripting: {
        async executeScript({ func }) {
          calls.push(["script", func.name]);
          if (fail) throw new Error("Page inaccessible");
          return [{ result: func.name === "confirmCopy" ? confirmed : func() }];
        },
      },
      tabs: { async create({ url }) { calls.push(["email", url]); } },
    },
  });
  vm.runInContext(source, context);
  return { context, calls, click, extract: () => vm.runInContext("getPageText()", context) };
}

test("extracts article text, headings, lists, and links without menus or hidden content", () => {
  const article = element("article", [
    element("header", [element("h1", ["Readable heading"])]),
    element("p", ["First paragraph with ", element("strong", ["emphasis"]), "."]),
    element("p", ["Visit ", element("a", ["the reference"], { href: "https://example.com/ref?a=1&b=2" }), "."]),
    element("ul", [element("li", ["One"]), element("li", ["Two"])]),
    element("ol", [element("li", ["First"]), element("li", ["Second"])]),
    element("p", ["Hidden content"], { display: "none" }),
    element("p", ["Secret content"], { "aria-hidden": "true" }),
    element("script", ["alert('unwanted')"]),
  ]);
  const body = element("body", [element("nav", ["Menu"]), article, element("footer", ["Footer"])]);
  const page = harness({ body, articles: [article] }).extract();
  assert.match(page.text, /^Readable heading\n\nFirst paragraph with emphasis\./);
  assert.match(page.text, /the reference \(https:\/\/example.com\/ref\?a=1&b=2\)/);
  assert.match(page.text, /- One\n\n?- Two/);
  assert.match(page.text, /1\. First\n\n?2\. Second/);
  assert.doesNotMatch(page.text, /Menu|Footer|Hidden|Secret|alert|<\/?\w/);
});

test("falls back to body and ignores articles inside hidden containers", () => {
  const article = element("article", ["Invisible article"]);
  const body = element("body", [
    element("div", [article], { display: "none" }),
    element("p", ["Visible café & text"]),
  ]);
  assert.equal(harness({ body, articles: [article] }).extract().text, "Visible café & text");
});

test("reports empty pages", () => {
  assert.throws(() => harness({ body: element("body") }).extract(), /No readable text/);
});

test("opens a readable draft with blank recipient after confirmation", async () => {
  const { click, calls } = harness({ body: element("body", [element("p", ["Café & # ? %"])]) });
  await click({ id: 1, url: "https://example.com/story" });
  assert.deepEqual(calls.filter(([type]) => type === "script").map(([, name]) => name), ["confirmCopy", "getPageText"]);
  const email = new URL(calls.find(([type]) => type === "email")[1]);
  assert.equal(email.pathname, "");
  assert.equal(email.searchParams.get("subject"), "A useful article");
  assert.equal(email.searchParams.get("body"), "A useful article\r\nhttps://example.com/story\r\n\r\nCafé & # ? %\r\n\r\n");
  assert.deepEqual(calls.at(-1), ["badge", "OK"]);
});

test("cancel skips copying and opening email", async () => {
  const { click, calls } = harness({ confirmed: false });
  await click({ id: 1, url: "https://example.com/" });
  assert.deepEqual(calls, [["badge", ""], ["script", "confirmCopy"]]);
});

test("restricted pages never trigger extraction or email", async () => {
  for (const url of ["chrome://extensions/", "https://chromewebstore.google.com/", undefined]) {
    const { click, calls } = harness();
    await click({ id: 1, url });
    assert.deepEqual(calls, [["badge", ""], ["badge", "N/A"]]);
  }
});

test("script failures show ERR and open no email", async () => {
  const { click, calls } = harness({ fail: true });
  await click({ id: 1, url: "https://example.com/" });
  assert.deepEqual(calls.at(-1), ["badge", "ERR"]);
  assert.equal(calls.some(([type]) => type === "email"), false);
});
