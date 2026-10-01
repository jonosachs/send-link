importScripts("config.js");

chrome.action.onClicked.addListener(async (tab) => {
  await setBadgeText("", tab);

  const [{ result: confirmed }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: confirmCopy,
  });

  if (!confirmed) return;

  await setBadgeText("...", tab);

  const [{ result: html }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: getHtml,
  });

  const deployment = await deploy(html);

  await setBadgeText("OK", tab);

  const url = `http://${deployment.url}`;

  const email = createEmail(url);
  await chrome.tabs.create({ url: email });
});

async function setBadgeText(text, tab) {
  await chrome.action.setBadgeText({
    text: text,
    tabId: tab.id,
  });
}

function confirmCopy() {
  return confirm("Copy this webpage, upload it to Vercel to create a publicly accessible link, and open an email draft?");
}

function getHtml() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll("script").forEach((script) => script.remove());

  // Resolve relative images, links, and inline CSS against the source page.
  clone.querySelectorAll("base").forEach((base) => base.remove());
  const base = document.createElement("base");
  base.href = document.baseURI;
  clone.querySelector("head").prepend(base);

  // Save loaded stylesheet rules so readable CSS survives a change of origin.
  const originalLinks = document.querySelectorAll('link[rel~="stylesheet"]');
  const copiedLinks = clone.querySelectorAll('link[rel~="stylesheet"]');
  originalLinks.forEach((link, index) => {
    if (!link.sheet || link.disabled) return;
    let rules;
    try {
      rules = Array.from(link.sheet.cssRules, (rule) => rule.cssText).join("\n");
    } catch {
      // Cross-origin stylesheets may forbid access; keep their original link.
      return;
    }
    const stylesheetUrl = link.sheet.href || document.baseURI;
    const resolveUrl = (url) => {
      if (url.startsWith("#")) return url;
      try { return new URL(url, stylesheetUrl).href; } catch { return url; }
    };
    const style = document.createElement("style");
    style.textContent = rules
      .replace(/url\(\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s)]*))\s*\)/gi,
        (match, doubleQuoted, singleQuoted, unquoted) => {
          const url = doubleQuoted ?? singleQuoted ?? unquoted;
          // Preserve CSS escapes rather than treating them as URL characters.
          return url.includes("\\") ? match : `url(${JSON.stringify(resolveUrl(url))})`;
        })
      .replace(/(@import\s+)(["'])([^"'\\]+)\2/gi,
        (match, prefix, quote, url) => `${prefix}${JSON.stringify(resolveUrl(url))}`);
    style.media = link.media;
    copiedLinks[index].replaceWith(style);
  });

  return `<!doctype html>\n${clone.outerHTML}`;
}

async function deploy(html) {
  console.info("Deploying..");
  const response = await fetch(
    "https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "send-link",
        files: [
          {
            file: "index.html",
            data: html,
          },
        ],
        target: "production",
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel deployment failed: ${error}`);
  }

  const deployment = await response.json();
  return deployment;
}

function createEmail(url) {
  const subject = encodeURIComponent("Jono has sent you a link");
  const body = encodeURIComponent(`${url}`);

  return `mailto:?subject=${subject}&body=${body}`;
}
