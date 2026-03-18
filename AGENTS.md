# Agent Notes

- GUN data sync: the shopping list uses a relay peer and a shareable `?list=` URL param. Brave can block localStorage/IndexedDB by default, so rely on the share link to move a list between browsers and avoid assuming local persistence.
- When testing shopping list changes, include UI checks (share link controls, form submission) alongside data-sync behavior.
- Playwright on Termux: prefer the repo scripts instead of launching Playwright directly. `npm run test:e2e` and `npm run test:e2e:headed` already load `scripts/playwright-termux-platform.cjs` and point Playwright at `/data/data/com.termux/files/usr/bin/chromium-browser` through `playwright.config.cjs`.
- For full manual browser debugging on Termux, Debian `proot` remains a valid path. Use it when the native Termux Chromium/Playwright route is flaky or when you need a closer-to-desktop browser environment.
