#!/usr/bin/env python3
"""Integration checks for LicheePi Wayland session diagnostics."""
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("licheepi-mainline-gpu-check.sh")

class WaylandSessionTests(unittest.TestCase):
    def test_display_session_detection(self):
        with tempfile.TemporaryDirectory(prefix="licheepi-wayland-") as directory:
            runtime = Path(directory)
            with socket.socket(socket.AF_UNIX) as first, socket.socket(socket.AF_UNIX) as second:
                first.bind(str(runtime / "wayland-1"))
                second.bind(str(runtime / "wayland-0"))
                (runtime / "wayland-not-socket").write_text("not a socket\n")
                cases = [
                    ("headless", {}, "Wayland socket: not requested"),
                    ("relative", {"XDG_RUNTIME_DIR": str(runtime), "WAYLAND_DISPLAY": "wayland-1"}, "Wayland socket: present"),
                    ("absolute", {"WAYLAND_DISPLAY": str(runtime / "wayland-1")}, "Wayland socket: present"),
                    ("missing socket", {"XDG_RUNTIME_DIR": str(runtime), "WAYLAND_DISPLAY": "wayland-2"}, "WARNING: Wayland socket missing"),
                    ("regular file is not socket", {"XDG_RUNTIME_DIR": str(runtime), "WAYLAND_DISPLAY": "wayland-not-socket"}, "WARNING: Wayland socket missing"),
                    ("x11 with explicit wayland", {"XDG_SESSION_TYPE": "x11", "XDG_RUNTIME_DIR": str(runtime), "WAYLAND_DISPLAY": "wayland-1"}, "Wayland socket: present"),
                    ("missing runtime", {"XDG_RUNTIME_DIR": str(runtime / "missing"), "WAYLAND_DISPLAY": "wayland-1"}, "WARNING: XDG_RUNTIME_DIR does not exist"),
                    ("default", {"XDG_SESSION_TYPE": "wayland", "XDG_RUNTIME_DIR": str(runtime)}, "Wayland socket: present"),
                    ("missing default", {"XDG_SESSION_TYPE": "wayland", "XDG_RUNTIME_DIR": str(runtime / "missing")}, "WARNING: Wayland socket missing"),
                    ("x11", {"XDG_SESSION_TYPE": "x11", "DISPLAY": ":0"}, "Wayland socket: not requested"),
                ]
                for label, changes, expected in cases:
                    with self.subTest(label=label):
                        env = {k: v for k, v in os.environ.items() if k not in
                               ("WAYLAND_DISPLAY", "XDG_SESSION_TYPE", "XDG_RUNTIME_DIR", "DISPLAY")}
                        env.update(changes)
                        result = subprocess.run(["sh", str(SCRIPT)], env=env,
                                                capture_output=True, text=True, timeout=20)
                        self.assertEqual(result.returncode, 0, result.stderr[-500:])
                        self.assertIn(expected, result.stdout)

if __name__ == "__main__":
    unittest.main()
