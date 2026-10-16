import { useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PEOPLE } from "../data/seed";
import { daysUntil, formatDate, formatEUR, neededByLabel } from "../data/rules";
import { useStore } from "../data/store";
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
  SupplierStatusTag,
  Table,
  TextArea,
  Timeline,
} from "../design-system/components";
import { NotFound, requestHistory } from "./requests";

/* ============ A-05 Approvals inbox ============ */

export function ApprovalsInbox() {
  const { state } = useStore();
  const waiting = state.requests.filter((r) => {
    const step = r.route.find((s) => !s.decision);
    return step?.person === state.user && (r.status === "in-review" || r.status === "second-review");
  });
  waiting.sort((a, b) => (a.neededBy ?? "9999").localeCompare(b.neededBy ?? "9999"));
  const decided = state.requests.filter((r) => r.route.some((s) => s.person === state.user && s.decision));
  const sup = (id: string) => state.suppliers.find((s) => s.id === id);

  return (
    <>
      <PageHeader title="Approvals" meta={<span>{waiting.length ? `${waiting.length} waiting for you` : "Nothing waiting for you"}</span>} />
      <h2 className="text-lg font-semibold mb-3">Waiting for you</h2>
      {waiting.length === 0 ? (
        <EmptyState title="You're up to date">New requests that need your approval appear here, and you'll get an email.</EmptyState>
      ) : (
        <Table caption="Requests waiting for your decision" head={["Request", "Requested by", "Amount", "Needed by", "Supplier risk", "Your step"]}>
          {waiting.map((r) => {
            const s = sup(r.supplierId);
            const step = r.route.find((x) => !x.decision)!;
            return (
              <tr key={r.id}>
                <td>
                  <Link to={`/approvals/${r.id}`} className="font-semibold text-petrol underline underline-offset-4">
                    {r.title}
                  </Link>
                  <div className="text-xs text-ink-muted">
                    {r.id}, waiting since {formatDate(r.createdOn)}
                  </div>
                </td>
                <td>{PEOPLE[r.requester].name}</td>
                <td className="text-right whitespace-nowrap font-semibold">{formatEUR(r.amount)}</td>
                <td className={`whitespace-nowrap ${r.neededBy && daysUntil(r.neededBy) <= 14 ? "font-semibold text-risk-medium" : ""}`}>
                  {r.neededBy ? formatDate(r.neededBy) : "No deadline"}
                </td>
                <td>
                  <RiskTag risk={s?.risk} />
                </td>
                <td>{step.kind === "approval" ? "Budget approval" : "Second approval"}</td>
              </tr>
            );
          })}
        </Table>
      )}
      {decided.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-3">Decided by you</h2>
          <Table caption="Requests you have decided" head={["Request", "Amount", "Status"]}>
            {decided.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/requests/${r.id}`} className="text-petrol underline underline-offset-4">
                    {r.title}
                  </Link>
                </td>
                <td className="text-right whitespace-nowrap">{formatEUR(r.amount)}</td>
                <td>
                  <RequestStatusTag status={r.status} />
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}

/* ============ A-06 Decision screen + A-07 decision dialog ============ */

type Decision = "approved" | "rejected" | "changes-requested";
const DECISION_COPY: Record<Decision, { title: string; button: string; label: string; hint: string; variant: "primary" | "danger" | "secondary" }> = {
  approved: { title: "Approve this request?", button: "Approve", label: "Why are you approving it?", hint: "For example: budgeted for Q1, price checked against last order.", variant: "primary" },
  "changes-requested": { title: "Ask for changes?", button: "Send back for changes", label: "What should the requester change?", hint: "Be specific. The requester sees this exactly as you write it.", variant: "secondary" },
  rejected: { title: "Reject this request?", button: "Reject", label: "Why are you rejecting it?", hint: "The requester sees this. Rejection is final; they would need to start a new request.", variant: "danger" },
};

export function ApprovalDetail() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const descId = useId();

  const r = state.requests.find((x) => x.id === id);
  if (!r) return <NotFound what="request" back="/approvals" />;
  const sup = state.suppliers.find((s) => s.id === r.supplierId);
  const stepIdx = r.route.findIndex((s) => !s.decision);
  const step = r.route[stepIdx];
  const myTurn = step?.person === state.user && (r.status === "in-review" || r.status === "second-review");
  const isRequester = r.requester === state.user;
  const later = r.route.slice(stepIdx + 1);
  const earlier = r.route.slice(0, stepIdx).filter((s) => s.decision);

  const open = (d: Decision) => {
    setDecision(d);
    setReason("");
    setError(undefined);
  };
  const confirm = () => {
    if (reason.trim().length < 10) {
      setError("Write at least 10 characters so the decision can be understood later");
      return;
    }
    dispatch({ type: "decide", requestId: r.id, decision: decision!, reason: reason.trim() });
    setDecision(null);
    navigate("/approvals");
  };
  const copy = decision ? DECISION_COPY[decision] : null;

  return (
    <>
      <PageHeader
        title={r.title}
        back={{ to: "/approvals", label: "Back to approvals" }}
        meta={
          <>
            <span>{r.id}</span>
            <span>
              from {PEOPLE[r.requester].name}, {formatDate(r.createdOn)}
            </span>
            <RequestStatusTag status={r.status} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        {/* The decision rail: amount, risk and four-eyes status in one place.
            Evaluation fix: first in DOM order so keyboard, screen-reader and agent order
            matches the mobile layout; placed in the right column on desktop via grid. */}
        <aside aria-label="Decision" className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6 bg-surface border-2 border-petrol rounded-[var(--radius-panel)]">
          {/* Evaluation fix: label/value pairs as a definition list, not loose paragraphs */}
          <dl className="m-0">
            <div className="px-5 pt-5 pb-4 border-b border-line">
              <dt className="text-sm text-ink-muted">Amount (net)</dt>
              <dd className="m-0 text-amount font-bold leading-tight">{formatEUR(r.amount)}</dd>
              {r.neededBy && (
                <>
                  <dt className="text-sm text-ink-muted mt-2">Needed by</dt>
                  <dd className={`m-0 text-sm ${daysUntil(r.neededBy) <= 14 ? "font-semibold text-risk-medium" : ""}`}>{neededByLabel(r.neededBy)}</dd>
                </>
              )}
            </div>
            <div className="px-5 py-4 border-b border-line flex flex-col gap-2">
              <dt className="text-sm text-ink-muted">Supplier</dt>
              <dd className="m-0 flex flex-col gap-2">
                <span className="font-semibold">{sup?.name}</span>
                <span className="flex flex-wrap gap-2">
                  {sup && <SupplierStatusTag status={sup.status} />}
                  <RiskTag risk={sup?.risk} />
                </span>
              </dd>
            </div>
          </dl>
          <div className="px-5 py-4 border-b border-line">
            <p className="m-0 text-sm text-ink-muted mb-2">Approvals</p>
            <ol className="list-none m-0 p-0 flex flex-col gap-2 text-sm">
              {r.route.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className={s.decision ? "text-risk-low" : i === stepIdx ? "text-petrol" : "text-line-strong"}>
                    {s.decision ? "●" : i === stepIdx ? "◉" : "○"}
                  </span>
                  <span>
                    <span className="font-semibold">{s.person === state.user ? "You" : PEOPLE[s.person].name}</span>
                    {", "}
                    {s.kind === "approval" ? "budget approval" : "second approval"}
                    {s.decision ? ` (${s.decision === "approved" ? "approved" : s.decision})` : i === stepIdx ? " (now)" : " (after you)"}
                    {s.note && <span className="block text-xs text-ink-muted">{s.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="px-5 py-5 flex flex-col gap-3">
            {isRequester ? (
              <Notice tone="info" title="You can't approve your own request">
                Segregation of duties: this goes to {step ? PEOPLE[step.person].name : "another approver"}.
              </Notice>
            ) : !myTurn ? (
              <Notice tone="info" title={step ? `Waiting for ${PEOPLE[step.person].name}` : "This request is decided"} />
            ) : (
              <>
                {earlier.length > 0 && <p className="m-0 text-sm">{PEOPLE[earlier[0].person].name} approved the budget. You give the second approval.</p>}
                {later.length > 0 && <p className="m-0 text-sm">If you approve, it goes to {PEOPLE[later[0].person].name} for a second approval.</p>}
                <Button onClick={() => open("approved")}>Approve</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => open("changes-requested")}>
                    Ask for changes
                  </Button>
                  <Button variant="secondary" onClick={() => open("rejected")} className="!text-risk-high !border-risk-high">
                    Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <Panel title="Request">
            <DescriptionList
              items={[
                ["What", r.title],
                ["Why", r.reason],
                ["Cost centre", r.costCentre],
                ["Requested by", `${PEOPLE[r.requester].name}, ${PEOPLE[r.requester].role}`],
              ]}
            />
          </Panel>
          {sup && (
            <Panel title="Supplier due diligence">
              <div className="flex flex-col gap-4 text-sm">
                <DescriptionList
                  items={[
                    ["Supplier", <Link to={`/suppliers/${sup.id}`} className="text-petrol underline underline-offset-4">{sup.name}</Link>],
                    ["Country, industry", `${sup.country}, ${sup.industry}`],
                    ["Assessed", sup.assessedOn ? `${formatDate(sup.assessedOn)} by compliance` : "Not yet"],
                    ["Re-assessment due", sup.reassessBy ? formatDate(sup.reassessBy) : "Not set"],
                  ]}
                />
                {sup.riskReason && (
                  <div>
                    <p className="m-0 font-semibold">Why this risk level</p>
                    <p className="m-0">{sup.riskReason}</p>
                  </div>
                )}
                {sup.mitigation && (
                  <div>
                    <p className="m-0 font-semibold">Open mitigation</p>
                    <p className="m-0">
                      {sup.mitigation.measure}. Owner {sup.mitigation.owner}, due {formatDate(sup.mitigation.due)}.
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          )}
          <Panel title="History">
            <Timeline items={requestHistory(r, state.audit)} />
          </Panel>
        </div>

      </div>

      <Dialog open={!!decision} onClose={() => setDecision(null)} title={copy?.title ?? ""} describedBy={descId}>
        {copy && (
          <>
            <p id={descId} className="m-0 text-sm">
              {r.title}, <span className="font-semibold">{formatEUR(r.amount)}</span>, from {sup?.name.replace(/\.$/, "")}. Your name, the time and your reason are written to the audit log and can't be changed.
            </p>
            <Field label={copy.label} hint={copy.hint} error={error}>
              {({ id: fid, describedBy, invalid }) => (
                <TextArea id={fid} autoFocus aria-describedby={describedBy} aria-invalid={invalid} value={reason} onChange={(e) => setReason(e.target.value)} />
              )}
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button variant={copy.variant === "secondary" ? "primary" : copy.variant} onClick={confirm}>
                {copy.button}
              </Button>
              <Button variant="quiet" onClick={() => setDecision(null)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
