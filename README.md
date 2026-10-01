# Send link 🧲

Chrome extension to copy a webpage to Vercel and open an email draft with the public link.

## Requirements

- Chrome
- Email client
- Vercel account - `https://vercel.com/`
- Vercel token - `https://vercel.com/account/settings/tokens`
- `config.js` file in the project root with your Vercel token defined:

```javascript
const CONFIG = {
  VERCEL_TOKEN: "your_vercel_token",
};

```

## Installation

- Open chrome extensions: `chrome://extensions/`
- Select `Load unpacked`
- Load the project directory

After updating the extension, click **Reload** on its card in `chrome://extensions/`. Create a fresh copy to apply changes to deployed pages.

## Usage

- Navigate to the page you want to clone
- Click the chrome extensions icon to the right of url, select `send-link` (pin for easy access)
- One confirmation asks to copy the page, upload it to Vercel, and open an email draft. It appears before scraping. Cancel skips scraping, deployment, and email.
- After deployment succeeds, an email draft opens automatically with the link. Enter the recipient, review, and send from your email app.

> [!Tip]
> Set the project Deployment Protection to 'None' in Vercel to enable link access without a Vercel account

## Copied page formatting

The extension removes scripts, preserves stylesheet rules that Chrome allows it to read, and resolves relative asset URLs against the source page. URLs inside preserved stylesheets resolve against the stylesheet's original URL.

Stylesheets that Chrome prevents the extension from reading stay as external links. External stylesheets, fonts, and images still depend on the source site allowing access. Features that require JavaScript may not work in the copied page.

## Checks

Run `node --test background.test.cjs` to check the single confirmation, cancellation, stylesheet preservation, asset URLs, deployment, and email behavior with mocked DOM, Chrome, and Vercel APIs.
