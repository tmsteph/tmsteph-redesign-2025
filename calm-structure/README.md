# Calm Structure

Calm Structure is a private household rhythm for meals, proactive ownership, check-ins, repair, and safety.

The principle is:

```txt
Awareness -> structure -> action -> repair -> trust
```

This first version is intentionally local-only. It does not connect to GunJS yet and does not sync sensitive household data. The goal is to make the workflow useful before adding authentication, encryption, and shared storage.

## Route

```txt
/calm-structure/
```

## Phase One

- Today dashboard
- Owned tasks
- Meal rhythm
- Grocery generation from seed meals
- Emotional check-ins
- Trigger/support maps
- Repair log
- Safety resources
- Local-only safety notes
- Settings for household/self labels

## Safety

This tool is for planning, grounding, and repair. It is not therapy, legal advice, or emergency support. If anyone is in immediate danger, call 911.

Safety notes are saved only in this browser's `localStorage` in phase one. They are not shared, synced, or sent to analytics.

Current resource sources:

- City of San Diego Domestic Violence page: `https://www.sandiego.gov/police/services/domestic-violence`
- Your Safe Place / San Diego Family Justice Center: `https://www.sandiego.gov/sdfjc`
- San Diego Regional Domestic Violence Resources Phone Guide: `https://www.sdcourt.ca.gov/sites/default/files/2021-08/San%20Diego%20Regional%20DOMESTIC%20VIOLENCE%20RESOURCES%20Phone%20Guide.pdf`

## Data

Phase one stores non-synced demo data at:

```txt
localStorage["tmstephCalmStructure.v1"]
localStorage["tmstephCalmStructure.safetyNotes.v1"]
```

Seed meal data lives at:

```txt
/data/seed-meals.json
```

Safety resource data lives at:

```txt
/data/safety-resources.json
```

## Future GunJS/SEA Plan

The shared storage phase should use GunJS plus SEA, but only after encryption is implemented.

Rules for the next phase:

1. Do not write sensitive relationship data to plaintext public Gun paths.
2. Use SEA auth for identity.
3. Generate a household key for shared records.
4. Encrypt every shared task, check-in, support map, repair, and meal note before writing it to Gun.
5. Keep safety notes local-only by default.
6. Do not add diagnostics, scoring, surveillance, or blame language.

Suggested paths:

```txt
tmsteph/calm/v1/households/{householdId}/meta
tmsteph/calm/v1/households/{householdId}/members/{memberPub}
tmsteph/calm/v1/households/{householdId}/records/{recordId}
~{userPub}/calm/v1/profile
~{userPub}/calm/v1/privateNotes/{noteId}
```

## Local Development

From the repo root:

```bash
npm install
npm run start
```

Then open:

```txt
http://localhost:8000/calm-structure/
```
