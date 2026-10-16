# Debian ROCm testing autoremoval watch — 2026-10-16

**Scope:** Open-computing packaging research, not a 3DVR product/release decision.

## Receipt and status

Debian's automated autoremoval notice dated **2026-10-15** flags `rocblas 6.4.4-4` for removal from **testing on 2026-10-17**. Similar notices name `rocsolver 6.4.3-2`, `rocfft 6.4.3-1`, `rocsparse 6.4.3-3`, and `hipblas 6.4.4-1`. These are *scheduled warnings*, not proof removal has happened. The rocblas notice lists several release-critical bugs in its (build-)dependency chain, not only the Memray failure: #1146575 (python-memray), #1148339 (mercurial), #1149738 (datatables-extensions), #1149955 (podman). Fixing Memray alone may not avert removal.

- Debian bug: https://bugs.debian.org/1146575 (opened 2026-09-03; `python-memray 1.20.0+dfsg-1`, serious; header reports `030e07f0` while Python runtime expects `030e06f0`).
- Thomas's PR: https://github.com/bloomberg/memray/pull/1048 (closed without merging in favor of maintainer fix).
- Maintainer's PR: https://github.com/bloomberg/memray/pull/1055 (open as checked 2026-10-16). It changes both streaming and aggregating record writers to use runtime Python version, with a compatibility fallback for Python <3.11.
- Debian autoremoval explanation: https://wiki.debian.org/Autoremoval

## Smallest useful next experiment

Once upstream #1055 is merged, test a Debian package build containing that fix under deliberately mismatched compile/runtime Python 3.14 micro versions; run `tests/integration/test_record_writer.py::{test_write_basic_records,test_write_aggregated_records}` and the package's autopkgtest. Record both the actual Python runtime and compile-time version. If Debian's failure persists, investigate how the package test environment mixes versions before proposing a packaging patch. Do not assume the upstream fix alone resolves the Debian migration.

## Boundaries

No tinygrad code or bounty claim; no outreach to Debian or Memray maintainers unless there is a tested new finding. Keep this as an open-computing watch; pass only confirmed architecture implications to the Founder Loop. Check Debian package state after the 2026-10-17 autoremoval date before treating a warning as removal.
