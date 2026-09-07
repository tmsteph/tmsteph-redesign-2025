# postmarketOS + GNOME Mobile contribution track

Goal: help make a mainline-Linux phone practical enough to replace Android without creating a 3DVR-specific fork.

## Upstream-first scope

Prioritize reproducible blockers and fixes in:

- GNOME Shell Mobile / Mutter Mobile touch and small-screen behavior
- modem, calls, SMS and mobile data through ModemManager/NetworkManager
- PipeWire/WirePlumber call and media audio routing
- suspend, wake and power management
- mainline kernel/device enablement
- Waydroid interoperability where Android compatibility is still required
- browser/PWA usability on phone-sized GNOME sessions

## Current baseline — 2026-09-07

postmarketOS currently ships `postmarketos-ui-gnome-mobile` as an experimental Wayland phone UI. Its package depends on GNOME Shell Mobile, the GNOME Mobile base UI, GDM and the GNOME portal stack. The current package line is version 5-r0, while the packaged GNOME Shell Mobile line is based on GNOME 48.

This means the useful contribution boundary is mostly upstream integration and device/runtime reliability rather than inventing another shell.

## Contribution workflow

1. Check existing postmarketOS/GNOME issues before opening anything.
2. Reproduce one concrete failure on supported hardware or in a reproducible environment.
3. Identify the lowest appropriate upstream layer (kernel, ModemManager, PipeWire/WirePlumber, Mutter/GNOME Shell, postmarketOS packaging/configuration).
4. Add the smallest test, diagnostic, documentation fix or code fix that proves the issue.
5. Validate according to that project's contribution rules before submission.
6. Record submitted/reviewed/merged work on `opensource.html`.

## Near-term target

The first hardware-backed pass should capture a compact phone-readiness report rather than changing configuration automatically: kernel/device, compositor/session, modem registration/data, PipeWire/WirePlumber nodes, suspend/wake evidence, GPU renderer, browser WebGL and Waydroid availability. That report can turn the first real failure into an upstream-quality reproduction.

## References

- https://postmarketos.org/
- https://pkgs.postmarketos.org/package/main/postmarketos/aarch64/postmarketos-ui-gnome-mobile
- https://pkgs.postmarketos.org/package/main/postmarketos/x86/gnome-shell-mobile
- https://postmarketos.org/edge/
