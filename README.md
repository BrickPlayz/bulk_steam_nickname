# Bulk Steam Nickname – Browser Extension

Bulk Steam Nickname is a cross-browser extension (Chrome & Firefox) that lets you **mass apply nicknames** to Steam users directly from the Steam Friends page — even if they're not already on your friends list.

This extension is especially useful for teams or communities (e.g. Rust clans) that want to apply consistent prefixes, tags, or labels to group members.

---

## Features

- ✅ Bulk apply nicknames from a table or CSV input
- ✅ Supports optional nickname prefixes (e.g. `[TEAM] - `)
- ✅ Automatically **unnicknames users** who currently have the prefix but are not included in the provided CSV
- ✅ Detects and prevents duplicate or invalid SteamIDs
- ✅ Displays real-time status (✅ / ❌) for each nickname applied
- ✅ Shows a cleanup log with the old nickname when removing outdated prefixes
- 🔁 Fully ported from the original Tampermonkey userscript to a standalone browser extension
- 💾 Nickname data and prefix are saved using `chrome.storage.local` / `browser.storage.local`

---

## Installation

### Firefox Add-on Store  
   **https://addons.mozilla.org/en-US/firefox/addon/bulk-steam-nickname/**

Install the extension and it will run automatically when you visit: https://steamcommunity.com/friends

### Chrome Web Store  
   **https://chrome.google.com/webstore/detail/bulk-steam-nickname/EXTENSION_ID_HERE** _(placeholder link)_

---

## How to Use

1. Visit your Steam **Friends** page in the browser while logged in.
2. Click the **“Bulk Nickname”** button added to the page.
3. Add SteamID64 and nickname pairs manually or paste them using the **CSV input**.
4. (Optional) Add a **prefix** to automatically tag all nicknames (e.g. `[TEAM] - `).
5. Click **Apply** to:
   - Apply all nicknames from your table
   - Cleanup nicknames: automatically remove any **nickname with your prefix** that is *not* in your table
6. Results will be shown with ✅/❌ status and a cleanup log including the old nickname for each cleared user

---

## Example CSV Format

76560000000000001,User1  
76560000000000002,User2  
76560000000000003,User3  

---

## Technical Notes

- Uses `fetch()` with `credentials: "include"` — you must be logged into Steam in your browser
- Nicknames are applied through Steam’s private `ajaxsetnickname` endpoint
- SessionID is extracted from `window.g_sessionID` or Steam cookies
- Throttled requests are used to avoid Steam rate limits
- CSV data and prefix are saved in `browser.storage.local`

---

## Credits

This project is based on the original userscript created by
**jxtt-dev** – https://github.com/jxtt-dev/bulk_steam_nickname

Enhancements and WebExtension conversion by **Brick_Playz**, including:
- Browser extension port from Tampermonkey
- Cleanup logic to unnickname users not included in the CSV
- Added visual results log under **“🔁 Unnickname Cleanup Results”**

---

## 📄 License

MIT License — free to use, fork, and modify.
Not affiliated with Valve, Steam, or any related entities.
