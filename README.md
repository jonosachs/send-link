# Send link 🧲

Chrome extension to share a webpage's readable text by email. Confirm before copying, then enter the recipient in the email draft and send when ready.

## What it does

- Asks for confirmation before copying the page.
- Extracts readable text, preserving paragraph breaks, headings, lists, and link URLs.
- Uses the page title as the email subject and includes the title and source URL in the body.
- Adds two line breaks after the copied text for spacing in the draft.
- Opens your email app with the recipient blank so you can review and send the message.

## Requirements

- Chrome
- An email app or webmail handler configured to open `mailto:` links

No Vercel account, token, `config.js`, additional email authentication, or local helper is required. Apple Mail uses your existing email account.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Select **Load unpacked** and choose the project directory.
4. Pin **send-link** from Chrome's extensions menu for easy access.

After updating the extension, click **Reload** on its card in `chrome://extensions/`.

## Usage

1. Open the webpage you want to share.
2. Click **send-link** in Chrome's toolbar.
3. Confirm the popup to copy the text and open an email draft. Cancel skips copying and opens no draft.
4. Enter the recipient, review the text, and send from your email app.

For Apple Mail, set Mail as your default email reader in **Mail > Settings > General**. The extension opens drafts through `mailto:` links.

## Content and limitations

The draft contains readable plain text. The extension prefers article or main content and skips menus, forms, scripts, and hidden text. On pages without article or main content, it reads the page body. Extraction depends on how the website structures its content.

Images and webpage styling are omitted. The extension does not send the email automatically.

`mailto:` links have size limits that vary by browser and email app. Large webpages may fail to open or have their content truncated. Check the draft before sending.

Open a regular HTTP or HTTPS webpage before clicking the extension. Chrome internal pages such as `chrome://extensions/`, new tabs, and the Chrome Web Store cannot be copied. The extension shows an `N/A` badge on unsupported pages; hover over its icon for the explanation.

## Status badges

| Badge | Meaning |
| --- | --- |
| `...` | Copying text and opening the email draft. |
| `OK` | The mailto link was opened. Check that your email app populated the draft. |
| `N/A` | Unsupported page. Hover over the icon for an explanation. |
| `ERR` | Copying or opening the draft failed. Hover over the icon for the error. |

For further error details, open the extension's service worker console from `chrome://extensions/`.

## Checks

Run `node --test background.test.cjs` to check text extraction and email draft behavior using DOM and Chrome API fixtures.
