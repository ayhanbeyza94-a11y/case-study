"""End-to-end checks of both flows and the compliance rules.
Usage: python3 tests/e2e.py http://localhost:4173
"""
import sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1]
results = []


def check(name, fn):
    try:
        fn()
        results.append((name, "pass", ""))
    except Exception as e:  # noqa: BLE001
        call = [l.strip() for l in str(e).splitlines() if "waiting for" in l or "Expect" in l][:1]
        results.append((name, "FAIL", f"{str(e).splitlines()[0][:80]} | {call} | at {page.url}"))


def as_(page, who, path):
    page.goto(f"{BASE}/#{path}?as={who}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(250)  # let hash navigation and persona switch settle


def decide(page, label, reason):
    page.get_by_role("button", name=label, exact=True).first.click()
    page.get_by_role("dialog").get_by_role("textbox").fill(reason)
    page.get_by_role("dialog").get_by_role("button").first.click()


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.goto(BASE)
    page.wait_for_url("**/#/requests")  # initial redirect must finish before tests navigate

    # ---------- Flow A: request -> first approval -> second approval ----------
    def flow_a_happy():
        as_(page, "lena", "/requests/new")
        page.get_by_label("What do you want to buy?").fill("Load-test licences")
        page.get_by_label("Why does the team need it?").fill("Release 4.2 load test before 1 December.")
        page.get_by_label("Amount (EUR, net)").fill("27400")
        page.get_by_label("Cost centre").select_option("CC-4100")
        page.get_by_label("Supplier").select_option("SUP-0142")
        page.get_by_role("button", name="Continue to review").click()
        expect(page.get_by_text("second approval (Over €25,000)")).to_be_visible()
        page.get_by_role("button", name="Submit request").click()
        expect(page.get_by_text("In review").first).to_be_visible()
        rid = page.url.split("/requests/")[1].split("?")[0]
        as_(page, "markus", f"/approvals/{rid}")
        decide(page, "Approve", "Budgeted in Q4 plan, price matches quote.")
        as_(page, "aylin", f"/approvals/{rid}")
        expect(page.get_by_text("Markus Brandt approved the budget")).to_be_visible()
        decide(page, "Approve", "Supplier cleared, low risk, within policy.")
        as_(page, "lena", f"/requests/{rid}")
        expect(page.get_by_text("Approved. Raise the purchase order")).to_be_visible()

    check("Flow A: submit, budget approval, second approval, requester sees outcome", flow_a_happy)

    def flow_a_reason_required():
        as_(page, "markus", "/approvals/PR-2026-0318")
        page.get_by_role("button", name="Reject").click()
        page.get_by_role("dialog").get_by_role("button", name="Reject").click()
        expect(page.get_by_role("dialog").get_by_text("Write at least 10 characters")).to_be_visible()
        page.keyboard.press("Escape")

    check("Flow A: decision without a reason is blocked", flow_a_reason_required)

    def flow_a_changes():
        as_(page, "markus", "/approvals/PR-2026-0318")
        decide(page, "Ask for changes", "Please attach the capacity forecast for Q1.")
        as_(page, "lena", "/requests/PR-2026-0318")
        expect(page.get_by_role("link", name="Edit and resubmit")).to_be_visible()

    check("Flow A: changes requested returns request to requester with reason", flow_a_changes)

    def flow_a_sod():
        as_(page, "markus", "/requests/new")
        page.get_by_label("What do you want to buy?").fill("Finance BI dashboard seats")
        page.get_by_label("Why does the team need it?").fill("Month-end close reporting.")
        page.get_by_label("Amount (EUR, net)").fill("4000")
        page.get_by_label("Cost centre").select_option("CC-1100")
        page.get_by_label("Supplier").select_option("SUP-0142")
        page.get_by_role("button", name="Continue to review").click()
        expect(page.get_by_text("deputy approver Jonas Weber")).to_be_visible()
        page.get_by_role("button", name="Submit request").click()
        rid = page.url.split("/requests/")[1].split("?")[0]
        as_(page, "markus", f"/approvals/{rid}")
        expect(page.get_by_text("You can't approve your own request")).to_be_visible()
        expect(page.get_by_role("button", name="Approve")).to_have_count(0)

    check("Rule: requester never approves own request (deputy swap)", flow_a_sod)

    def flow_a_validation():
        as_(page, "lena", "/requests/new")
        page.get_by_role("button", name="Continue to review").click()
        expect(page.get_by_text("Fix 5 problems to continue")).to_be_visible()
        expect(page.get_by_label("What do you want to buy?")).to_have_attribute("aria-invalid", "true")

    check("Flow A: empty form shows error summary and marks fields invalid", flow_a_validation)

    # ---------- Flow B: onboard -> answers -> assess -> clear -> on-hold request released ----------
    def flow_b_happy():
        as_(page, "aylin", "/suppliers/new")
        page.get_by_label("Legal name").fill("Saigon Textile Works")
        page.get_by_label("VAT ID").fill("VN0399887766")
        page.get_by_label("Country of registration").select_option("Vietnam")
        page.get_by_label("Main industry").select_option("Textiles")
        page.get_by_label("Supplier contact for due diligence").fill("esg@saigontextile.example")
        expect(page.get_by_text("High risk (proposed)")).to_be_visible()
        page.get_by_role("button", name="Add supplier and send questionnaire").click()
        sid = page.url.split("/suppliers/")[1].split("?")[0]
        # Lena requests from the uncleared supplier -> on hold
        as_(page, "lena", "/requests/new")
        page.get_by_label("What do you want to buy?").fill("Team T-shirts for trade fair")
        page.get_by_label("Why does the team need it?").fill("Hannover Messe booth staff, April.")
        page.get_by_label("Amount (EUR, net)").fill("2100")
        page.get_by_label("Cost centre").select_option("CC-4100")
        page.get_by_label("Supplier").select_option(sid)
        page.get_by_role("button", name="Continue to review").click()
        page.get_by_role("button", name="Submit request").click()
        expect(page.get_by_role("main").get_by_text("On hold until the supplier is cleared")).to_be_visible()
        rid = page.url.split("/requests/")[1].split("?")[0]
        # Aylin gets answers and assesses
        as_(page, "aylin", f"/suppliers/{sid}")
        page.get_by_role("button", name="Prototype: simulate supplier answers").click()
        page.get_by_role("button", name="Send for clearance").click()
        expect(page.get_by_text("Describe the preventive or remedial measure")).to_be_visible()
        page.get_by_label("Measure").fill("Third-party social audit before first order")
        page.get_by_label("Owner").fill("Aylin Demir")
        page.get_by_label("Due date").fill("2027-02-15")
        page.get_by_role("button", name="Send for clearance").click()
        expect(page.get_by_text("Waiting for a second person to clear this supplier")).to_be_visible()
        # Jonas clears
        as_(page, "jonas", f"/suppliers/{sid}")
        page.get_by_role("button", name="Clear supplier").first.click()
        page.get_by_role("dialog").get_by_role("textbox").fill("Checked answers, audit plan and owner; acceptable with mitigation.")
        page.get_by_role("dialog").get_by_role("button", name="Clear supplier").click()
        expect(page.get_by_text("Cleared").first).to_be_visible()
        # On-hold request released to approval
        as_(page, "lena", f"/requests/{rid}")
        expect(page.get_by_text("Waiting for approval")).to_be_visible()

    check("Flow B: onboard, mitigation required for high risk, second-person clearance, request released", flow_b_happy)

    def flow_b_duplicate():
        as_(page, "aylin", "/suppliers/new")
        page.get_by_label("Legal name").fill("Some new name")
        page.get_by_label("VAT ID").fill("DE287654321")
        page.get_by_label("Country of registration").select_option("Germany")
        page.get_by_label("Main industry").select_option("IT services")
        page.get_by_label("Supplier contact for due diligence").fill("a@b.example")
        page.get_by_role("button", name="Add supplier and send questionnaire").click()
        expect(page.get_by_text("Nordlicht Cloud GmbH is already in Clearpath")).to_be_visible()

    check("Flow B: duplicate VAT ID is caught", flow_b_duplicate)

    def audit_written():
        as_(page, "aylin", "/audit")
        expect(page.get_by_text("Cleared supplier").first).to_be_visible()
        expect(page.get_by_text("Budgeted in Q4 plan").first).to_be_visible()

    check("Rule: every decision appears in the audit log with its reason", audit_written)

    # ---------- Keyboard-only: reach and use the decision rail ----------
    def keyboard():
        as_(page, "markus", "/approvals/PR-2026-0322")
        for _ in range(40):
            page.keyboard.press("Tab")
            if page.evaluate("document.activeElement.textContent") == "Approve":
                break
        else:
            raise AssertionError("Approve button not reachable by Tab within 40 presses")
        page.keyboard.press("Enter")
        expect(page.get_by_role("dialog")).to_be_visible()
        focused = page.evaluate("document.activeElement.tagName")
        assert focused == "TEXTAREA", f"focus went to {focused}, expected the reason field"
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog")).to_be_hidden()

    check("Keyboard: reach Approve, dialog opens with focus in reason, Esc closes", keyboard)

    b.close()

w = max(len(n) for n, _, _ in results)
for n, s, msg in results:
    print(f"{s:4}  {n.ljust(w)}  {msg}")
fails = sum(1 for _, s, _ in results if s != "pass")
print(f"\n{len(results) - fails}/{len(results)} passed")
sys.exit(1 if fails else 0)
