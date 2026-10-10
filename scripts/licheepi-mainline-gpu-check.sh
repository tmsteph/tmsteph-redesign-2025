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
printf '%s\n' '-- DRM device nodes --'
if [ -d /dev/dri ]; then
  ls -l /dev/dri 2>/dev/null || true
else
  printf '/dev/dri is missing\n'
fi
printf '%s\n' '-- DRM drivers --'
for node in /sys/class/drm/card*/device/driver; do
  [ -e "$node" ] || continue
  printf '%s -> %s\n' "$node" "$(readlink "$node" 2>/dev/null || true)"
done
printf '%s\n' '-- PowerVR kernel module --'
if [ -d /sys/module/powervr ]; then
  printf 'powervr module: loaded\n'
else
  printf 'powervr module: not loaded\n'
fi
fw=/lib/firmware/powervr/rogue_36.52.104.182_v1.fw
if [ -r "$fw" ]; then
  printf 'firmware: present (%s)\n' "$fw"
else
  printf 'firmware: MISSING (%s)\n' "$fw"
fi

section "USB / xHCI"
run "USB topology and negotiated speeds" lsusb -t
printf "%s\n" "-- xHCI drivers --"
for node in /sys/bus/platform/drivers/*xhci* /sys/bus/pci/drivers/xhci_hcd; do
  [ -e "$node" ] || continue
  printf "%s\n" "$node"
done

section "display session"
printf 'uid: '; id -u
printf 'session type: %s\n' "${XDG_SESSION_TYPE:-unset}"
printf 'runtime directory: %s\n' "${XDG_RUNTIME_DIR:-unset}"
printf 'Wayland display: %s\n' "${WAYLAND_DISPLAY:-unset}"
printf 'X11 display: %s\n' "${DISPLAY:-unset}"
if [ -n "${XDG_RUNTIME_DIR:-}" ] && [ ! -d "$XDG_RUNTIME_DIR" ]; then
  printf 'WARNING: XDG_RUNTIME_DIR does not exist\n'
fi
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  wayland_name=$WAYLAND_DISPLAY
elif [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
  wayland_name=wayland-0
  printf 'Wayland display unset; checking default wayland-0\n'
else
  wayland_name=
fi
if [ -n "$wayland_name" ]; then
  case "$wayland_name" in
    /*) wayland_socket=$wayland_name ;;
    *) if [ -n "${XDG_RUNTIME_DIR:-}" ]; then
         wayland_socket=${XDG_RUNTIME_DIR%/}/$wayland_name
       else
         wayland_socket=
       fi ;;
  esac
  if [ -n "$wayland_socket" ] && [ -S "$wayland_socket" ]; then
    printf 'Wayland socket: present\n'
  else
    printf 'WARNING: Wayland socket missing or not accessible\n'
  fi
else
  printf 'Wayland socket: not requested (X11 or headless is possible)\n'
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
