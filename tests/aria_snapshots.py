"""Dump the accessibility tree of key screens (what screen readers and AI agents 'see').
Used as the ONLY input for simulated persona walkthroughs, and as an agent-legibility check.
Usage: python3 tests/aria_snapshots.py http://localhost:4173 <out_dir>
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE, OUT = sys.argv[1], Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
SCREENS = {
    "A-02_new-request": "/requests/new?as=lena",
    "A-04_request-on-hold": "/requests/PR-2026-0297?as=lena",
    "A-05_inbox": "/approvals?as=markus",
    "A-06_decision": "/approvals/PR-2026-0322?as=markus",
    "B-01_suppliers": "/suppliers?as=aylin",
    "B-04_assessment": "/suppliers/SUP-0163?as=aylin",
    "C-01_audit": "/audit?as=aylin",
}
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page(viewport={"width": 1280, "height": 900})
    page.goto(BASE); page.wait_for_url("**/#/requests")
    for name, path in SCREENS.items():
        page.goto(f"{BASE}/#{path}"); page.wait_for_timeout(300)
        snap = page.locator("body").aria_snapshot()
        (OUT / f"{name}.yaml").write_text(snap)
        print(name, len(snap), "chars")
    b.close()
