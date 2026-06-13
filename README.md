# Send link

Chrome extension to clone any HTML article to a dedicated url and send the link to your friends to read.

## Requirements

- Chrome
- Email client
- Vercel account
- `config.js` file with your Vercel token:

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
