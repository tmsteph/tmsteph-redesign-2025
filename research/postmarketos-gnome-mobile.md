# postmarketOS + GNOME Mobile contribution track

Status: active research / contribution scouting

## Why this track

Track the work needed to make a GNOME-based Linux phone practical as an Android replacement, while contributing fixes upstream rather than building a private fork.

## Current upstream baseline (2026-09)

- postmarketOS actively packages `gnome-shell-mobile` on current branches.
- The mobile shell depends on `mutter-mobile` and the broader GNOME stack.
- PipeWire/GStreamer are part of the packaged mobile desktop path.
- postmarketOS explicitly recommends contributing upstream to GNOME and other mobile-shell projects, and recommends device mainlining, testing, documentation, and small reproducible fixes as contribution entry points.

## Contribution priorities

1. **Daily-driver blockers first:** suspend/resume, modem/calls/SMS, Wi-Fi/Bluetooth, audio routing, cameras, sensors, charging and power usage.
2. **GNOME Mobile usability:** touch/gesture behavior, on-screen keyboard, adaptive libadwaita apps, lock screen, notifications, rotation and fractional scaling.
3. **Android compatibility as a bridge:** document and test Waydroid interoperability without making Android the base OS.
4. **Upstream-first device work:** prefer mainline kernel/device-tree/firmware fixes over downstream device hacks.
5. **Reproducible testing:** turn hardware-specific failures into scripts, logs, minimal reproductions, docs, or tests that can be reviewed without owning the exact phone.

## First contribution workflow

- Pick a device we can actually test or emulate.
- Establish a clean postmarketOS baseline and record hardware support.
- Select one reproducible daily-driver failure.
- Locate the true upstream component (kernel, ModemManager, PipeWire/WirePlumber, GNOME Shell/Mutter, postmarketOS packaging, etc.).
- Reproduce and validate before preparing a focused patch or documentation change.
- Record submitted/merged work in `opensource.html`.

## Useful upstream entry point

postmarketOS contribution guide: https://postmarketos.org/contribute/
