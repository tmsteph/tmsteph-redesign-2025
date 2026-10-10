#!/usr/bin/env python3
"""Offline tests for the open-source contribution ledger checker."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

CHECKER = Path(__file__).with_name("check-opensource-ledger.py")
spec = importlib.util.spec_from_file_location("opensource_ledger", CHECKER)
assert spec and spec.loader
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)


class LedgerTests(unittest.TestCase):
    def test_accepted_review_can_have_open_pr(self) -> None:
        self.assertTrue(ledger.status_matches("Review accepted", "Open PR"))
        self.assertFalse(ledger.status_matches("Review accepted", "Merged"))
        self.assertFalse(ledger.status_matches("Review accepted", "Closed unmerged"))

    def test_merge_and_open_statuses_are_strict(self) -> None:
        self.assertTrue(ledger.status_matches("Merged", "Merged"))
        self.assertTrue(ledger.status_matches("Open PR", "Open PR"))
        self.assertFalse(ledger.status_matches("Merged", "Open PR"))
        self.assertFalse(ledger.status_matches("Open PR", "Merged"))

    def test_extracts_review_receipt(self) -> None:
        html = ('<article class="contribution-card">'
                '<span class="contribution-status">Review accepted</span>'
                '<a href="https://github.com/riscv/meta-riscv/pull/707">Review</a>'
                '</article>')
        self.assertEqual(
            ledger.entries(html),
            [("riscv", "meta-riscv", "707", "Review accepted")],
        )


if __name__ == "__main__":
    unittest.main()
