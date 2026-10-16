"""Capture every screen in the screen index at desktop and mobile widths.
Usage: python3 scripts/shoot.py <base_url> <out_dir>
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = [
    ("A-01_my-requests", "/requests?as=lena", None),
    ("A-02_new-request", "/requests/new?as=lena", None),
    ("A-02_new-request-errors", "/requests/new?as=lena", "submit_empty"),
    ("A-03_review", "/requests/new?as=lena", "fill_and_review"),
    ("A-04_request-on-hold", "/requests/PR-2026-0297?as=lena", None),
    ("A-05_approvals-inbox", "/approvals?as=markus", None),
    ("A-06_decision-rail", "/approvals/PR-2026-0322?as=markus", None),
    ("A-07_decision-dialog", "/approvals/PR-2026-0322?as=markus", "open_reject"),
    ("B-01_suppliers", "/suppliers?as=aylin", None),
    ("B-02_add-supplier", "/suppliers/new?as=aylin", "fill_supplier"),
    ("B-03_awaiting-answers", "/suppliers/SUP-0171?as=aylin", None),
    ("B-04_assessment", "/suppliers/SUP-0163?as=aylin", "override"),
    ("C-01_audit-log", "/audit?as=aylin", None),
    ("DS_design-system", "/design-system?as=aylin", None),
]


def act(page, action):
    if action == "submit_empty":
        page.get_by_role("button", name="Continue to review").click()
    elif action == "fill_and_review":
        page.get_by_label("What do you want to buy?").fill("Load-test licences for release 4.2")
        page.get_by_label("Why does the team need it?").fill("Release 4.2 must pass the 10k-user load test before 1 December.")
        page.get_by_label("Amount (EUR, net)").fill("27400")
        page.get_by_label("Cost centre").select_option("CC-4100")
        page.get_by_label("Supplier").select_option("SUP-0157")
        page.get_by_role("button", name="Continue to review").click()
    elif action == "open_reject":
        page.get_by_role("button", name="Reject").click()
        page.get_by_role("button", name="Reject").last.click()
    elif action == "fill_supplier":
        page.get_by_label("Legal name").fill("Saigon Textile Works")
        page.get_by_label("Country of registration").select_option("Vietnam")
        page.get_by_label("Main industry").select_option("Textiles")
    elif action == "override":
        page.get_by_label("Low risk").check() if False else page.locator("input[name=risk]").nth(0).check()
    page.wait_for_timeout(300)


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width, suffix in [(1440, "desktop"), (390, "mobile")]:
        ctx = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
        for name, path, action in SHOTS:
            page = ctx.new_page()
            page.goto(f"{BASE}/#{path}")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(400)
            if action:
                act(page, action)
            page.screenshot(path=str(OUT / f"{name}_{suffix}.png"), full_page=True)
            page.close()
        ctx.close()
    browser.close()
print("done")
