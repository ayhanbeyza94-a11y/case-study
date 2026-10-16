import { useState } from "react";
import { useNavigate } from "react-router-dom";
import tokens from "../design-system/tokens.json";
import { useStore } from "../data/store";
import type { PersonId } from "../data/types";
import {
  Button,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Panel,
  RequestStatusTag,
  RiskTag,
  Select,
  Steps,
  SupplierStatusTag,
  Table,
  TextInput,
  Timeline,
} from "../design-system/components";

/* ============ Screen index (for reviewers, testers and the handoff) ============ */

const SCREENS: Array<{ id: string; name: string; flow: string; as: PersonId; to: string; states: string }> = [
  { id: "A-01", name: "My requests", flow: "A", as: "lena", to: "/requests", states: "List, empty (switch to Jonas)" },
  { id: "A-02", name: "New request: details", flow: "A", as: "lena", to: "/requests/new", states: "Empty, inline errors + error summary, uncleared supplier warning" },
  { id: "A-03", name: "New request: review and submit", flow: "A", as: "lena", to: "/requests/new", states: "Route preview, second approval, segregation-of-duties swap (as Markus)" },
  { id: "A-04", name: "Request detail", flow: "A", as: "lena", to: "/requests/PR-2026-0297", states: "On hold, in review, changes requested, approved, rejected" },
  { id: "A-05", name: "Approvals inbox", flow: "A", as: "markus", to: "/approvals", states: "Waiting, decided, empty" },
  { id: "A-06", name: "Decision screen with decision rail", flow: "A", as: "markus", to: "/approvals/PR-2026-0322", states: "First approver, second approver (as Aylin after Markus), own request blocked" },
  { id: "A-07", name: "Decision dialog", flow: "A", as: "markus", to: "/approvals/PR-2026-0318", states: "Approve, ask for changes, reject; reason required" },
  { id: "B-01", name: "Suppliers", flow: "B", as: "aylin", to: "/suppliers", states: "All, needs your action, empty filter" },
  { id: "B-02", name: "Add supplier", flow: "B", as: "aylin", to: "/suppliers/new", states: "Live risk screen, validation, duplicate found; requester sees hand-off notice (as Lena)" },
  { id: "B-03", name: "Supplier: awaiting answers", flow: "B", as: "aylin", to: "/suppliers/SUP-0171", states: "Reminder, simulate answers" },
  { id: "B-04", name: "Supplier: assessment", flow: "B", as: "aylin", to: "/suppliers/SUP-0163", states: "Confirm, override with reason, mitigation required" },
  { id: "B-05", name: "Supplier: clearance (second person)", flow: "B", as: "jonas", to: "/suppliers", states: "Clear, send back, reject; assessor blocked from clearing" },
  { id: "C-01", name: "Audit log", flow: "Shared", as: "aylin", to: "/audit", states: "Filter, CSV export" },
];

export function ScreenIndex() {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const go = (as: PersonId, to: string) => {
    dispatch({ type: "set-user", user: as });
    navigate(to);
  };
  return (
    <>
      <PageHeader title="Screen index" meta={<span>Every screen in the two flows, the persona to view it as, and the states to check. Use with the FigJam flow maps.</span>} />
      <Table caption="Screens and states" head={["ID", "Screen", "Flow", "States to check", ""]}>
        {SCREENS.map((s) => (
          <tr key={s.id}>
            <td className="font-semibold whitespace-nowrap">{s.id}</td>
            <td>{s.name}</td>
            <td>{s.flow}</td>
            <td className="text-ink-muted">{s.states}</td>
            <td>
              <Button variant="quiet" onClick={() => go(s.as, s.to)} aria-label={`Open ${s.id} ${s.name}`}>
                Open
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ============ Design system gallery ============ */

function Swatch({ name, value, note }: { name: string; value: string; note?: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="size-10 rounded-[var(--radius-control)] border border-line shrink-0" style={{ background: value }} aria-hidden />
      <span className="text-sm">
        <span className="font-semibold block">{name}</span>
        <span className="text-ink-muted">{value}{note ? `, ${note}` : ""}</span>
      </span>
    </li>
  );
}

export function DesignSystem() {
  const [open, setOpen] = useState(false);
  const colors = Object.entries(tokens.color) as Array<[string, { $value: string; $description?: string }]>;
  const sizes = Object.entries(tokens.font.size) as Array<[string, { $value: string; $description?: string }]>;
  return (
    <>
      <PageHeader title="Design system" meta={<span>Tokens live in src/design-system/tokens.json and components in components.tsx. This page renders them from code.</span>} />
      <div className="flex flex-col gap-6">
        <Panel title="Colour">
          <ul className="list-none m-0 p-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {colors.map(([k, v]) => <Swatch key={k} name={k} value={v.$value} note={v.$description} />)}
          </ul>
          <p className="text-sm text-ink-muted mt-4 mb-0">Risk and status never rely on colour alone: each also has a shape (circle, diamond, triangle, cross, pause) and a word.</p>
        </Panel>
        <Panel title="Type">
          <p className="text-sm text-ink-muted mt-0">Public Sans, one family, tabular figures for amounts.</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {sizes.map(([k, v]) => (
              <li key={k} className="flex items-baseline gap-4">
                <span className="w-20 text-xs text-ink-muted shrink-0">{k}, {v.$value}</span>
                <span style={{ fontSize: v.$value }} className={k === "amount" || k === "xl" ? "font-bold" : ""}>
                  {k === "amount" ? "€31.750" : "Approve the right spend, with the evidence beside it"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Status and risk">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2"><RiskTag risk="low" /><RiskTag risk="medium" /><RiskTag risk="high" /><RiskTag /><RiskTag risk="medium" proposed /></div>
            <div className="flex flex-wrap gap-2">
              {(["draft", "in-review", "second-review", "changes-requested", "on-hold", "approved", "rejected"] as const).map((s) => <RequestStatusTag key={s} status={s} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["awaiting-supplier", "in-review", "cleared", "blocked", "rejected"] as const).map((s) => <SupplierStatusTag key={s} status={s} />)}
            </div>
          </div>
        </Panel>
        <Panel title="Buttons">
          <div className="flex flex-wrap gap-3 items-center">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="text-sm text-ink-muted mb-0">One primary action per view. Labels say what happens: “Approve”, not “Submit”. Minimum target 40px.</p>
        </Panel>
        <Panel title="Form fields">
          <div className="grid gap-5 sm:grid-cols-2 max-w-3xl">
            <Field label="Amount (EUR, net)" hint="Total for the whole order, excluding VAT.">
              {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} defaultValue="31750" />}
            </Field>
            <Field label="Amount (EUR, net)" error="Enter an amount greater than €0">
              {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} defaultValue="0" />}
            </Field>
            <Field label="Cost centre" optional>
              {({ id }) => <Select id={id}><option>CC-4100, Engineering platform</option></Select>}
            </Field>
          </div>
        </Panel>
        <Panel title="Notices">
          <div className="flex flex-col gap-3">
            <Notice tone="info" title="Waiting for Jonas Weber" />
            <Notice tone="warning" title="On hold until the supplier is cleared">The request moves to approval automatically.</Notice>
            <Notice tone="error" title="Fix 2 problems to continue" />
            <Notice tone="success" title="Approved. Raise the purchase order in the ERP." />
          </div>
        </Panel>
        <Panel title="Steps, timeline, description list">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <Steps steps={["Request details", "Review and submit"]} current={1} />
              <DescriptionList items={[["Supplier", "Kestrel Components Ltd."], ["Assessed", "20 May 2026"]]} />
            </div>
            <Timeline
              items={[
                { key: "1", when: "14 Oct 2026, 10:02", who: "Lena Vogt", what: "Submitted request", tone: "done" },
                { key: "2", when: "14 Oct 2026, 15:40", who: "Markus Brandt", what: "Approved request", reason: "Budgeted for Q1.", tone: "done" },
                { key: "3", when: "", who: "Aylin Demir", what: "Waiting for second approval", tone: "pending" },
              ]}
            />
          </div>
        </Panel>
        <Panel title="Table, empty state, dialog">
          <div className="flex flex-col gap-4">
            <Table caption="Example table" head={["Request", "Amount", "Status"]}>
              <tr><td>Sensor boards</td><td className="text-right">€31.750</td><td><RequestStatusTag status="in-review" /></td></tr>
            </Table>
            <EmptyState title="You're up to date">New requests that need your approval appear here.</EmptyState>
            <div><Button variant="secondary" onClick={() => setOpen(true)}>Open dialog example</Button></div>
            <Dialog open={open} onClose={() => setOpen(false)} title="Approve this request?">
              <p className="m-0 text-sm">Dialogs are only for irreversible, logged decisions. They always ask for a reason.</p>
              <div className="flex gap-3"><Button onClick={() => setOpen(false)}>Approve</Button><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button></div>
            </Dialog>
          </div>
        </Panel>
      </div>
    </>
  );
}
