"""Automated accessibility check (axe-core, WCAG 2.0/2.1/2.2 A and AA) on every screen.
Usage: python3 tests/a11y.py http://localhost:4173
Automated checks find roughly a third of WCAG issues; manual checks are in the test plan.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1]
AXE = Path(__file__).resolve().parent.parent / "node_modules/axe-core/axe.min.js"
PAGES = [
    ("A-01", "/requests?as=lena", None),
    ("A-02", "/requests/new?as=lena", None),
    ("A-02 errors", "/requests/new?as=lena", "submit"),
    ("A-04", "/requests/PR-2026-0297?as=lena", None),
    ("A-05", "/approvals?as=markus", None),
    ("A-06", "/approvals/PR-2026-0322?as=markus", None),
    ("A-07 dialog", "/approvals/PR-2026-0322?as=markus", "dialog"),
    ("B-01", "/suppliers?as=aylin", None),
    ("B-02", "/suppliers/new?as=aylin", None),
    ("B-03", "/suppliers/SUP-0171?as=aylin", None),
    ("B-04", "/suppliers/SUP-0163?as=aylin", None),
    ("C-01", "/audit?as=aylin", None),
    ("DS", "/design-system?as=aylin", None),
]
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for width in (1440, 390):
        ctx = b.new_context(viewport={"width": width, "height": 900})
        for name, path, action in PAGES:
            page = ctx.new_page()
            page.goto(f"{BASE}/#{path}")
            page.wait_for_load_state("networkidle")
            if action == "submit":
                page.get_by_role("button", name="Continue to review").click()
            if action == "dialog":
                page.get_by_role("button", name="Approve").click()
            page.wait_for_timeout(200)
            page.add_script_tag(path=str(AXE))
            res = page.evaluate(f"axe.run(document, {{runOnly: {json.dumps(TAGS)}}})")
            v = res["violations"]
            total += len(v)
            status = "pass" if not v else f"{len(v)} violation(s)"
            print(f"[{width}px] {name}: {status}")
            for item in v:
                print(f"    - {item['id']} ({item['impact']}): {item['help']} x{len(item['nodes'])}")
                for n in item["nodes"][:2]:
                    print(f"        {n['target']} :: {n['failureSummary'].splitlines()[-1].strip()}")
            page.close()
        ctx.close()
    b.close()
print(f"TOTAL violations: {total}")
sys.exit(1 if total else 0)
