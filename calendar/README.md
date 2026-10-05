# Private family calendar
The tmsteph calendar now opens with a private-link gate. It supports both partners' work and events, shared trips, month/agenda views, printing, server persistence, and revocable partner editing links.

Personal events and capability keys never belong in this repository. Data lives outside the checkout in `/home/debian/.local/share/tmsteph-family-calendar` with directory mode 0700 and files 0600. Owner link: `owner-link.txt` in that directory. Keys are stored as SHA-256 hashes. Do not log Authorization headers or private links. Preserve the directory during deployments and include it in the server's private backup coverage.

The API runs as debian under systemd, listens only on 127.0.0.1:4346, and is exposed through the existing HTTPS Caddy host at `/family-calendar-api/*`. CORS accepts only tmsteph.com and www.tmsteph.com. Request bodies have size/event limits. Revision checks prevent simultaneous edits from silently replacing each other. Owner creates or revokes the partner capability; the partner may edit events but cannot manage access.

To deploy backend source, install `ops/family-calendar-server.mjs` as `/opt/tmsteph-family-calendar/server.mjs`, install the supplied systemd service, daemon-reload, and restart only that service. The saved Caddy config before installation is `/etc/caddy/Caddyfile.before-family-calendar`. Keep the normal portal proxy inside a fallback handle and the planner API in a handle_path.

The Google import is a dated snapshot, not two-way sync. Shared additions and changes remain in this planner. Work shifts preserve their tentative status; blank days do not assert availability. All-day Google date holds have exclusive end dates converted to inclusive display dates. Flexible travel hours remain in notes rather than invented exact timestamps.

Validation: `node --test ops/family-calendar-server.test.mjs`, `npm test -- tests/calendar-view.test.js`, `npm run build`. Browser acceptance checks desktop/mobile rendering, event editing across two independent browser contexts, conflict cards, and revoked-link denial using a disposable private room.
