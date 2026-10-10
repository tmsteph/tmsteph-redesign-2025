#!/usr/bin/env python3
"""Check the tmsteph open-source ledger's PR badges against GitHub.

Read-only. Requires GitHub CLI (`gh`) authentication for API requests.
Run: python3 scripts/check-opensource-ledger.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "opensource.html"
PR_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/pull/(\d+)(?:[/?#].*)?$")


class Cards(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.cards: list[dict] = []
        self.current: dict | None = None
        self.in_status = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs = dict(attrs)
        classes = (attrs.get("class") or "").split()
        if tag == "article" and "contribution-card" in classes:
            self.current = {"status": "", "links": []}
        if self.current is None:
            return
        if tag == "span" and "contribution-status" in classes:
            self.in_status = True
        if tag == "a" and attrs.get("href"):
            self.current["links"].append(attrs["href"])

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.in_status:
            self.current["status"] += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "span":
            self.in_status = False
        if tag == "article" and self.current is not None:
            self.cards.append(self.current)
            self.current = None


def entries(html: str) -> list[tuple[str, str, str, str]]:
    parser = Cards()
    parser.feed(html)
    found = []
    for card in parser.cards:
        for url in card["links"]:
            match = PR_RE.match(url)
            if match:
                found.append((*match.groups(), card["status"].strip()))
    return found


def github_status(owner: str, repo: str, number: str) -> str:
    result = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/pulls/{number}"],
        capture_output=True, text=True, check=True,
    )
    pr = json.loads(result.stdout)
    if pr["merged_at"]:
        return "Merged"
    return "Open PR" if pr["state"] == "open" else "Closed unmerged"


def status_matches(badge: str, actual: str) -> bool:
    """Allow an accepted review while its parent PR is still open."""
    return badge == actual or (badge == "Review accepted" and actual == "Open PR")


def main() -> int:
    items = entries(LEDGER.read_text())
    if not items:
        print("ERROR: no GitHub pull requests found in ledger", file=sys.stderr)
        return 2
    failures = 0
    for owner, repo, number, badge in items:
        try:
            actual = github_status(owner, repo, number)
        except (subprocess.CalledProcessError, OSError, ValueError, KeyError) as exc:
            print(f"ERROR {owner}/{repo}#{number}: {exc}", file=sys.stderr)
            failures += 1
            continue
        if not status_matches(badge, actual):
            print(f"MISMATCH {owner}/{repo}#{number}: ledger={badge!r} GitHub={actual!r}")
            failures += 1
    print(f"Checked {len(items)} PR links; {failures} discrepancies/errors.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
