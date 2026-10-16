# Clearpath prototype

A working prototype of **Clearpath**, a fictional B2B platform for purchase approvals and supplier due diligence in companies covered by Germany's Supply Chain Due Diligence Act (LkSG). Built as part of an AI-in-the-design-process case study.

It covers two end-to-end flows:

- **Flow A, purchase request to approval:** request, approval route by amount and risk, segregation of duties, second approval, audit trail.
- **Flow B, supplier onboarding with due diligence:** risk screen, questionnaire, assessment with mitigation, second-person clearance; requests waiting on the supplier are released automatically.

> This is a prototype. Data lives in memory and resets on reload. The country/industry risk screen is an illustrative hard-coded list, not a real risk index. Nothing here is legal advice.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

Switch personas with **Prototype: viewing as** in the sidebar, or deep-link with `?as=`:
`#/approvals/PR-2026-0322?as=markus`. Personas: `lena` (requester), `markus` (approver), `aylin` (compliance), `jonas` (clearer, deputy approver).

## Where things are

| Path | What |
| --- | --- |
| `src/design-system/tokens.json` | Design tokens (W3C draft format). Source of truth for `src/styles.css` `@theme`. |
| `src/design-system/components.tsx` | Components: Button, Field, TextInput, Select, TextArea, RiskTag, RequestStatusTag, SupplierStatusTag, Panel, PageHeader, DescriptionList, Notice, EmptyState, Table, Timeline, Dialog, Toast, Steps |
| `src/data/rules.ts` | Business rules: approval route, second-approval threshold (€25,000), segregation of duties, risk screen |
| `src/data/store.tsx` | State and every action that writes to the audit log |
| `src/screens/` | Screens, labelled with the IDs used in the handoff (A-01 … C-01) |
| `tests/a11y.py` | axe-core WCAG 2.2 AA scan of every screen at 1440px and 390px |
| `tests/e2e.py` | End-to-end checks of both flows and the compliance rules |
| `tests/aria_snapshots.py` | Dumps accessibility trees (what screen readers and AI agents read) |
| `scripts/shoot.py` | Screenshots of every screen and key state |

In-app: **Screen index** lists every screen and the states to check; **Design system** renders tokens and components from code.

## Tests

```bash
pip install playwright && python -m playwright install chromium
npm run build && npx vite preview --port 4173 &
python3 tests/a11y.py http://localhost:4173
python3 tests/e2e.py http://localhost:4173
```

Automated accessibility checks catch only part of WCAG. Manual checks (screen reader, zoom to 400%, real keyboard use) are in the test plan.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds, runs both test suites, and deploys `dist/` on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. Routing uses hash URLs, so no server config is needed.

## Rules encoded in the prototype

| Rule | Where |
| --- | --- |
| A requester never approves their own request; cost-centre owners get a deputy | `buildRoute` in `rules.ts` |
| Second approval when amount > €25,000 or supplier risk is medium/high | `needsSecondApproval` in `rules.ts` |
| Every decision needs a written reason (min. 10 characters) | `ApprovalDetail`, `Clearance` |
| Medium/high risk needs a mitigation plan with owner and future due date | `Assessment` in `suppliers.tsx` |
| The person who assessed a supplier can't clear it | `SupplierProfile` |
| Requests for an uncleared supplier wait on hold and are released on clearance | `clear-supplier` in `store.tsx` |
