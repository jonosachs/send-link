importScripts("config.js");

chrome.action.onClicked.addListener(async (tab) => {
  await setBadgeText("...", tab);

  const [{ result: html }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: getHtml,
  });

  const deployment = await deploy(html);

  await setBadgeText("OK", tab);

  const url = `http://${deployment.url}`;

  const [{ result: sendLink }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: confirmSendLink,
    args: [url],
  });

  if (sendLink) {
    const email = createEmail(url);
    await chrome.tabs.create({ url: email });
  }
});

async function setBadgeText(text, tab) {
  await chrome.action.setBadgeText({
    text: text,
    tabId: tab.id,
  });
}

function getHtml() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll("script").forEach((script) => script.remove());

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

function confirmSendLink(url) {
  return confirm(`✅ Page copied.\nURL: ${url}\nSend link?`);
}

function createEmail(url) {
  const subject = encodeURIComponent("Jono has sent you a link");
  const body = encodeURIComponent(`${url}`);

  return `mailto:?subject=${subject}&body=${body}`;
}
