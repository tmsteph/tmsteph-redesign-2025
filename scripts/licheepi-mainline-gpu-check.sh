#!/bin/sh
# Collect a compact, shareable snapshot of the LicheePi 4A mainline graphics stack.
# Read-only: this script does not install packages or change system state.
set -u

section() { printf '\n== %s ==\n' "$1"; }
run() {
  label=$1; shift
  printf '\n-- %s --\n' "$label"
  if command -v "$1" >/dev/null 2>&1; then
    "$@" 2>&1 || true
  else
    printf 'not installed: %s\n' "$1"
  fi
}

section "system"
printf 'date: '; date -u '+%Y-%m-%dT%H:%M:%SZ'
printf 'kernel: '; uname -a
[ -r /proc/device-tree/model ] && { printf 'model: '; tr '\000' '\n' </proc/device-tree/model; }

section "driver and firmware"
for node in /sys/class/drm/card*/device/driver; do
  [ -e "$node" ] || continue
  printf '%s -> %s\n' "$node" "$(readlink "$node" 2>/dev/null || true)"
done
fw=/lib/firmware/powervr/rogue_36.52.104.182_v1.fw
if [ -r "$fw" ]; then
  printf 'firmware: present (%s)\n' "$fw"
else
  printf 'firmware: MISSING (%s)\n' "$fw"
fi

section "graphics userspace"
run "Vulkan summary" vulkaninfo --summary
run "EGL" eglinfo -B
run "OpenGL / GLX" glxinfo -B

section "Mesa packages"
if command -v dpkg-query >/dev/null 2>&1; then
  dpkg-query -W -f='${Package}\t${Version}\n' 'libgl1-mesa*' 'libegl-mesa*' 'mesa-vulkan-drivers' 2>/dev/null || true
else
  printf 'dpkg-query unavailable\n'
fi

section "browser versions"
run "Chromium" chromium --version
run "Firefox" firefox --version

section "media and audio"
run "VA-API" vainfo
run "PipeWire" pipewire --version
run "WirePlumber" wireplumber --version

section "kernel messages"
if command -v dmesg >/dev/null 2>&1; then
  dmesg 2>/dev/null | grep -Ei 'powervr|pvr|drm|firmware|gpu' | tail -n 120 || true
fi

printf '\nDone. Attach this output to a bug or bring-up report; review it for host-specific details first.\n'
