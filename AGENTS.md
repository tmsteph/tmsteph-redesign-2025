# Agent Notes

- GUN data sync: the shopping list uses a relay peer and a shareable `?list=` URL param. Brave can block localStorage/IndexedDB by default, so rely on the share link to move a list between browsers and avoid assuming local persistence.
- When testing shopping list changes, include UI checks (share link controls, form submission) alongside data-sync behavior.
