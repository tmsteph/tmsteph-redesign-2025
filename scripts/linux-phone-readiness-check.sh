#!/bin/sh
# Collect a compact, shareable snapshot for postmarketOS/GNOME Mobile bring-up.
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
[ -r /etc/os-release ] && cat /etc/os-release

section "session"
printf 'XDG_CURRENT_DESKTOP=%s\n' "${XDG_CURRENT_DESKTOP:-}"
printf 'XDG_SESSION_TYPE=%s\n' "${XDG_SESSION_TYPE:-}"
run "GNOME Shell" gnome-shell --version
run "Mutter" mutter --version

section "modem and networking"
run "ModemManager" mmcli --version
run "modems" mmcli -L
run "NetworkManager" nmcli --version
run "radio state" nmcli radio

section "audio"
run "PipeWire" pipewire --version
run "WirePlumber" wireplumber --version
run "audio server" wpctl status

section "power"
run "UPower" upower --dump
if [ -r /sys/power/mem_sleep ]; then
  printf '\n-- suspend modes --\n'
  cat /sys/power/mem_sleep
fi

section "graphics and input"
if [ -d /dev/dri ]; then
  printf '%s\n' '-- DRM device nodes --'
  ls -l /dev/dri 2>/dev/null || true
else
  printf '/dev/dri is missing\n'
fi
run "EGL" eglinfo -B
if [ -r /proc/bus/input/devices ]; then
  printf '\n-- input devices --\n'
  grep -E '^(N:|H:)' /proc/bus/input/devices || true
fi

section "Waydroid"
run "Waydroid" waydroid status

section "recent relevant kernel messages"
if command -v dmesg >/dev/null 2>&1; then
  dmesg 2>/dev/null | grep -Ei 'modem|wwan|qmi|mbim|drm|gpu|touch|input|audio|snd|suspend|resume|firmware' | tail -n 160 || true
fi

printf '\nDone. Review output for device-specific identifiers before attaching it to an upstream report.\n'
