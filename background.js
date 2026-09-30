chrome.action.onClicked.addListener(async (tab) => {
  try {
    await setBadgeText("", tab);
    await chrome.action.setTitle({ title: "Email page text", tabId: tab.id });

    if (!canCopyPage(tab.url)) {
      await setBadgeText("N/A", tab);
      await chrome.action.setTitle({
        title: "This page cannot be copied. Open a regular HTTP or HTTPS webpage and try again.",
        tabId: tab.id,
      });
      return;
    }

    const [{ result: confirmed }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: confirmCopy,
    });

    if (!confirmed) return;

    await setBadgeText("...", tab);

    const [{ result: page }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageText,
    });

    const email = createEmail(page);
    await chrome.tabs.create({ url: email });
    await setBadgeText("OK", tab);
  } catch (error) {
    console.error("Could not open an email draft:", error);
    await setBadgeText("ERR", tab);
    await chrome.action.setTitle({
      title: `Could not copy the page or open an email draft: ${error.message}`,
      tabId: tab.id,
    });
  }
});

function canCopyPage(url) {
  try {
    const page = new URL(url);
    if (!["http:", "https:"].includes(page.protocol)) return false;
    return page.hostname !== "chromewebstore.google.com" &&
      !(page.hostname === "chrome.google.com" &&
        (page.pathname === "/webstore" || page.pathname.startsWith("/webstore/")));
  } catch {
    return false;
  }
}

async function setBadgeText(text, tab) {
  await chrome.action.setBadgeText({
    text: text,
    tabId: tab.id,
  });
}

function getPageText() {
  const excluded = "script, style, noscript, template, nav, footer, aside, form, button, input, select, textarea, svg, canvas, iframe, [hidden], [aria-hidden='true'], [role='navigation'], [role='banner'], [role='contentinfo']";
  const blocks = new Set([
    "ADDRESS", "ARTICLE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD",
    "FIGCAPTION", "FIGURE", "H1", "H2", "H3", "H4", "H5", "H6",
    "MAIN", "P", "PRE", "SECTION", "UL", "OL", "TABLE",
  ]);

  function isVisible(element) {
    const style = getComputedStyle(element);
    return !element.hidden && element.getAttribute("aria-hidden") !== "true" &&
      style.display !== "none" && style.visibility !== "hidden" &&
      style.visibility !== "collapse";
  }

  function read(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches(excluded) || !isVisible(node)) return "";
    if (node.tagName === "BR") return "\n";
    if (node.tagName === "HR") return "\n\n";

    const text = Array.from(node.childNodes, read).join("");
    if (node.tagName === "A" && text.trim()) {
      const url = node.href;
      if (/^https?:\/\//i.test(url) && text.trim() !== url) return `${text.trim()} (${url})`;
    }
    if (node.tagName === "LI") {
      const bullet = node.parentElement.tagName === "OL"
        ? `${Array.from(node.parentElement.children).indexOf(node) + 1}.`
        : "-";
      return `\n${bullet} ${text.trim()}\n`;
    }
    if (node.tagName === "TR") return `\n${text.trim()}\n`;
    if (node.tagName === "TD" || node.tagName === "TH") return `${text.trim()}\t`;
    return blocks.has(node.tagName) ? `\n\n${text.trim()}\n\n` : text;
  }

  // Prefer the article or main content so menus and other page chrome stay out.
  const root = ["article", "[role='article']", "main", "[role='main']"]
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .find((element) => {
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        if (!isVisible(ancestor)) return false;
      }
      return element.innerText.trim();
    }) || document.body;
  const text = read(root)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new Error("No readable text found on this page.");

  return { title: document.title, url: location.href, text };
}

function confirmCopy() {
  return confirm("Copy this webpage's readable text and open an email draft?\nYou can enter the recipient in your email app.");
}

function createEmail(page) {
  const title = page.title.replace(/[\r\n]+/g, " ").trim() || "Shared webpage";
  const subject = encodeURIComponent(title);
  const content = `${title}\n${page.url}\n\n${page.text}\n\n`;
  const body = encodeURIComponent(content.replace(/\r\n|\r|\n/g, "\r\n"));

  return `mailto:?subject=${subject}&body=${body}`;
}
