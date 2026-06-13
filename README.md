# Send link

Chrome extension to clone any HTML article to an open-access url and send the link to your friends/colleagues.

## Requirements

- Chrome
- Email client
- Vercel account - `https://vercel.com/` 
- Vercel token - `https://vercel.com/account/settings/tokens`
- `config.js` file in the project root with your Vercel token defined:

```
const CONFIG = {
  VERCEL_TOKEN: "your_vercel_token",
};

```

## How to install the extension

- Open chrome extensions: `chrome://extensions/` 
- Select `Load unpacked`
- Load the project directory
- Navigate to the page you want to clone
- Click the chrome extensions icon to the right of url, select `send-link` (pin for easy access)
- Once the script runs, click OK on the popup to send the link via email

## Tips

- Set the project Deployment Protection to 'None' in Vercel to enable link access without a Vercel account
