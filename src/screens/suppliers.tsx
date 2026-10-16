import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PEOPLE } from "../data/seed";
import { formatDate, formatDateTime, screenRisk } from "../data/rules";
import { nextId, useStore } from "../data/store";
import type { Risk, Supplier } from "../data/types";
import {
  Button,
  ButtonLink,
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
  SupplierStatusTag,
  Table,
  TextArea,
  TextInput,
  Timeline,
} from "../design-system/components";
import { NotFound } from "./requests";

const COUNTRIES = ["Germany", "Austria", "Netherlands", "Poland", "Czechia", "Turkey", "India", "Vietnam", "China", "Bangladesh", "Brazil", "United Arab Emirates", "United States"];
const INDUSTRIES = ["IT services", "Software", "Consulting", "Printing", "Logistics", "Electronics manufacturing", "Textiles", "Cleaning and facility services", "Raw materials trading", "Mining", "Agriculture"];

/* ============ B-01 Suppliers ============ */

export function SuppliersList() {
  const { state } = useStore();
  const [filter, setFilter] = useState<"all" | "action">("all");
  const canOnboard = PEOPLE[state.user].can.includes("onboard");
  const needsMe = (s: Supplier) =>
    (s.status === "in-review" && !s.risk && state.user === s.onboardedBy) ||
    (s.status === "in-review" && !!s.risk && s.onboardedBy !== state.user && PEOPLE[state.user].can.includes("clear-supplier"));
  const rows = filter === "all" ? state.suppliers : state.suppliers.filter(needsMe);
  const actionCount = state.suppliers.filter(needsMe).length;

  return (
    <>
      <PageHeader
        title="Suppliers"
        meta={<span>{state.suppliers.length} suppliers, {state.suppliers.filter((s) => s.status === "cleared").length} cleared</span>}
        actions={canOnboard ? <ButtonLink to="/suppliers/new">Add supplier</ButtonLink> : undefined}
      />
      <fieldset className="border-0 p-0 m-0 mb-4 flex gap-4 text-sm">
        <legend className="sr-only">Show</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="f" checked={filter === "all"} onChange={() => setFilter("all")} /> All suppliers
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="f" checked={filter === "action"} onChange={() => setFilter("action")} /> Needs your action ({actionCount})
        </label>
      </fieldset>
      {rows.length === 0 ? (
        <EmptyState title="Nothing needs your action">Suppliers waiting for your assessment or clearance appear here.</EmptyState>
      ) : (
        <Table caption="Suppliers" head={["Supplier", "Country", "Status", "Risk", "Next step"]}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/suppliers/${s.id}`} className="font-semibold text-petrol underline underline-offset-4">
                  {s.name}
                </Link>
                <div className="text-xs text-ink-muted">
                  {s.id}, {s.industry}
                </div>
              </td>
              <td>{s.country}</td>
              <td>
                <SupplierStatusTag status={s.status} />
              </td>
              <td>
                <RiskTag risk={s.risk ?? s.proposedRisk} proposed={!s.risk} />
              </td>
              <td className="text-sm">{nextStep(s)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function nextStep(s: Supplier) {
  if (s.status === "awaiting-supplier") return `Supplier answers questionnaire (sent ${s.questionnaireSentOn ? formatDate(s.questionnaireSentOn) : ""})`;
  if (s.status === "in-review" && !s.risk) return "Compliance reviews answers";
  if (s.status === "in-review" && s.risk) return "Second person clears";
  if (s.status === "cleared") return s.reassessBy ? `Re-assess by ${formatDate(s.reassessBy)}` : "None";
  return "None";
}

/* ============ B-02 Add supplier ============ */

export function AddSupplier() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", vatId: "", country: "", industry: "", contactEmail: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [dup, setDup] = useState<Supplier>();
  const summary = useRef<HTMLDivElement>(null);
  const canOnboard = PEOPLE[state.user].can.includes("onboard");
  const screen = f.country && f.industry ? screenRisk(f.country, f.industry) : null;

  if (!canOnboard)
    return (
      <>
        <PageHeader title="Add a supplier" back={{ to: "/requests/new", label: "Back to new request" }} />
        <div className="max-w-2xl">
          <Notice tone="info" title="Compliance adds new suppliers">
            Send the supplier's legal name, VAT ID and a contact email to Aylin Demir (procurement & compliance). You can submit your request now; it waits on hold until the supplier is cleared.
          </Notice>
        </div>
      </>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!f.name.trim()) er.name = "Enter the supplier's legal name";
    if (!/^[A-Z]{2}[A-Z0-9]{6,12}$/.test(f.vatId.replace(/\s/g, "").toUpperCase())) er.vatId = "Enter a VAT ID starting with the country code, e.g. DE123456789";
    if (!f.country) er.country = "Choose the country where the supplier is registered";
    if (!f.industry) er.industry = "Choose the supplier's main industry";
    if (!/^\S+@\S+\.\S+$/.test(f.contactEmail)) er.contactEmail = "Enter an email address like name@company.com";
    setErrors(er);
    if (Object.keys(er).length) return requestAnimationFrame(() => summary.current?.focus());
    const vat = f.vatId.replace(/\s/g, "").toUpperCase();
    const existing = state.suppliers.find((s) => s.vatId === vat || s.name.toLowerCase() === f.name.trim().toLowerCase());
    if (existing) return setDup(existing);
    const id = nextId("SUP", state.suppliers.map((s) => s.id));
    dispatch({ type: "add-supplier", id, supplier: { ...f, name: f.name.trim(), vatId: vat } });
    navigate(`/suppliers/${id}`);
  };

  const errs = Object.values(errors);
  return (
    <>
      <PageHeader title="Add a supplier" back={{ to: "/suppliers", label: "Back to suppliers" }} />
      <form onSubmit={submit} noValidate className="max-w-2xl flex flex-col gap-5">
        {errs.length > 0 && (
          <div ref={summary} tabIndex={-1} className="outline-none">
            <Notice tone="error" title={`Fix ${errs.length} ${errs.length === 1 ? "problem" : "problems"} to continue`}>
              <ul className="m-0 pl-5">{errs.map((m) => <li key={m}>{m}</li>)}</ul>
            </Notice>
          </div>
        )}
        {dup && (
          <Notice tone="warning" title={`${dup.name} is already in Clearpath`}>
            It matches by {dup.vatId === f.vatId.replace(/\s/g, "").toUpperCase() ? "VAT ID" : "name"}.{" "}
            <Link to={`/suppliers/${dup.id}`} className="underline font-semibold">Open {dup.name}</Link> instead of creating a duplicate.
          </Notice>
        )}
        <Field label="Legal name" hint="As on the commercial register, including the legal form (GmbH, Ltd., S.A.)." error={errors.name}>
          {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
        </Field>
        <Field label="VAT ID" error={errors.vatId}>
          {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={f.vatId} onChange={(e) => setF({ ...f, vatId: e.target.value })} autoComplete="off" />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Country of registration" error={errors.country}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-describedby={describedBy} aria-invalid={invalid} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
                <option value="">Choose a country</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Main industry" error={errors.industry}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-describedby={describedBy} aria-invalid={invalid} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}>
                <option value="">Choose an industry</option>
                {INDUSTRIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Supplier contact for due diligence" hint="We send the questionnaire to this address." error={errors.contactEmail}>
          {({ id, describedBy, invalid }) => <TextInput id={id} type="email" aria-describedby={describedBy} aria-invalid={invalid} value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />}
        </Field>
        {screen && (
          <Panel title="Initial risk screen" headingLevel={2}>
            <div className="flex flex-col gap-2 text-sm">
              <div>
                <RiskTag risk={screen.risk} proposed />
              </div>
              <ul className="m-0 pl-5">{screen.because.map((b) => <li key={b}>{b}</li>)}</ul>
              <p className="m-0 text-ink-muted">This is a first screen based on country and industry only. You confirm or change it after reading the supplier's answers.</p>
            </div>
          </Panel>
        )}
        <div className="flex gap-3">
          <Button type="submit">Add supplier and send questionnaire</Button>
          <ButtonLink to="/suppliers" variant="quiet">Cancel</ButtonLink>
        </div>
      </form>
    </>
  );
}

/* ============ B-03 Supplier profile, B-04 assessment, B-05 clearance ============ */

export function SupplierProfile() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const s = state.suppliers.find((x) => x.id === id);
  if (!s) return <NotFound what="supplier" back="/suppliers" />;
  const linked = state.requests.filter((r) => r.supplierId === s.id);
  const history = state.audit
    .filter((e) => e.target === s.id)
    .map((e) => ({
      key: e.id,
      when: formatDateTime(e.at),
      who: e.actor === "system" ? "Clearpath" : PEOPLE[e.actor].name,
      what: e.action,
      reason: e.reason,
      tone: (e.action.startsWith("Rejected") ? "bad" : "done") as "bad" | "done",
    }));
  const isOnboarder = state.user === s.onboardedBy;
  const canAssess = s.status === "in-review" && !s.risk && isOnboarder;
  const awaitingClearance = s.status === "in-review" && !!s.risk;
  const canClear = awaitingClearance && !isOnboarder && PEOPLE[state.user].can.includes("clear-supplier");

  return (
    <>
      <PageHeader
        title={s.name}
        back={{ to: "/suppliers", label: "Back to suppliers" }}
        meta={
          <>
            <span>{s.id}</span>
            <SupplierStatusTag status={s.status} />
            <RiskTag risk={s.risk ?? s.proposedRisk} proposed={!s.risk} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <div className="flex flex-col gap-6">
          {s.status === "awaiting-supplier" && (
            <Panel title="Waiting for the supplier's answers">
              <div className="flex flex-col gap-3 text-sm">
                <p className="m-0">
                  Questionnaire sent to {s.contactEmail} on {s.questionnaireSentOn ? formatDate(s.questionnaireSentOn) : "—"}. Suppliers have 14 days to answer; we send a reminder after 7.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => dispatch({ type: "send-reminder", supplierId: s.id })}>Send reminder now</Button>
                  <Button variant="quiet" onClick={() => dispatch({ type: "simulate-answers", supplierId: s.id })}>Prototype: simulate supplier answers</Button>
                </div>
              </div>
            </Panel>
          )}
          {s.answers && (
            <Panel title="Questionnaire answers">
              <dl className="m-0 flex flex-col gap-4 text-sm">
                {s.answers.map((a) => (
                  <div key={a.q}>
                    <dt className="font-semibold">{a.q}</dt>
                    <dd className="m-0 mt-1 flex items-start gap-2">
                      {a.a}
                      {a.flag && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-risk-medium px-2 py-0.5 text-xs font-semibold text-risk-medium">
                          Check this answer
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
          {canAssess && <Assessment s={s} />}
          {s.status === "in-review" && !s.risk && !isOnboarder && (
            <Notice tone="info" title={`${PEOPLE[s.onboardedBy].name} is reviewing the answers`}>You'll be asked to clear the supplier once the assessment is done.</Notice>
          )}
          {awaitingClearance && isOnboarder && (
            <Notice tone="info" title="Waiting for a second person to clear this supplier">
              You assessed this supplier, so someone else must clear it (four-eyes rule). Jonas Weber has been asked.
            </Notice>
          )}
          {canClear && <Clearance s={s} />}
          {s.status === "blocked" && <Notice tone="error" title="Blocked: requests can't use this supplier">{s.riskReason}</Notice>}

          <Panel title="History">
            <Timeline items={history} />
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Details">
            <DescriptionList
              items={[
                ["VAT ID", s.vatId],
                ["Country", s.country],
                ["Industry", s.industry],
                ["Contact", s.contactEmail],
                ["Added by", PEOPLE[s.onboardedBy].name],
                ["Cleared by", s.clearedBy ? PEOPLE[s.clearedBy].name : "Not yet"],
                ["Re-assess by", s.reassessBy ? formatDate(s.reassessBy) : "Set on clearance"],
              ]}
            />
            {s.mitigation && (
              <div className="mt-4 text-sm">
                <p className="m-0 font-semibold">Mitigation</p>
                <p className="m-0">{s.mitigation.measure}</p>
                <p className="m-0 text-ink-muted">{s.mitigation.owner}, due {formatDate(s.mitigation.due)}</p>
              </div>
            )}
          </Panel>
          <Panel title="Requests using this supplier">
            {linked.length === 0 ? (
              <p className="m-0 text-sm text-ink-muted">None yet.</p>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-3 text-sm">
                {linked.map((r) => (
                  <li key={r.id} className="flex flex-col items-start gap-1">
                    <Link to={`/requests/${r.id}`} className="text-petrol underline underline-offset-4">{r.title}</Link>
                    <RequestStatusTag status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Assessment({ s }: { s: Supplier }) {
  const { dispatch } = useStore();
  const [risk, setRisk] = useState<Risk>(s.proposedRisk);
  const [reason, setReason] = useState("");
  const [m, setM] = useState({ measure: "", owner: "", due: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const override = risk !== s.proposedRisk;
  const needsPlan = risk !== "low";

  const send = () => {
    const e: Record<string, string> = {};
    if (override && reason.trim().length < 10) e.reason = "Explain why you changed the proposed risk (at least 10 characters)";
    if (needsPlan) {
      if (!m.measure.trim()) e.measure = "Describe the preventive or remedial measure";
      if (!m.owner.trim()) e.owner = "Name the person responsible";
      if (!m.due) e.due = "Set a due date";
      else if (new Date(m.due) <= new Date()) e.due = "Choose a date in the future";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    dispatch({ type: "confirm-risk", supplierId: s.id, risk, reason: override ? reason.trim() : undefined, mitigation: needsPlan ? m : undefined });
  };

  return (
    <Panel title="Your assessment">
      <div className="flex flex-col gap-5">
        <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
          <legend className="text-sm font-semibold mb-1">Risk level</legend>
          <p className="m-0 text-xs text-ink-muted">The screen proposed {s.proposedRisk}. Base your decision on the answers above.</p>
          {(["low", "medium", "high"] as Risk[]).map((r) => (
            <label key={r} className="flex items-center gap-3 text-sm">
              <input type="radio" name="risk" checked={risk === r} onChange={() => setRisk(r)} />
              <RiskTag risk={r} />
              {r === s.proposedRisk && <span className="text-ink-muted">(proposed)</span>}
            </label>
          ))}
        </fieldset>
        {override && (
          <Field label="Why are you changing the proposed level?" hint="Recorded in the audit log. Name the evidence, e.g. a certificate or audit report." error={errors.reason}>
            {({ id, describedBy, invalid }) => <TextArea id={id} aria-describedby={describedBy} aria-invalid={invalid} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        )}
        {needsPlan && (
          <fieldset className="border border-line rounded-[var(--radius-panel)] p-4 m-0 flex flex-col gap-4">
            <legend className="text-sm font-semibold px-1">Mitigation plan (required for {risk} risk)</legend>
            <Field label="Measure" hint="What will reduce the risk, e.g. on-site audit, contract clause, corrective action plan." error={errors.measure}>
              {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={m.measure} onChange={(e) => setM({ ...m, measure: e.target.value })} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" error={errors.owner}>
                {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={m.owner} onChange={(e) => setM({ ...m, owner: e.target.value })} />}
              </Field>
              <Field label="Due date" error={errors.due}>
                {({ id, describedBy, invalid }) => <TextInput id={id} type="date" aria-describedby={describedBy} aria-invalid={invalid} value={m.due} onChange={(e) => setM({ ...m, due: e.target.value })} />}
              </Field>
            </div>
          </fieldset>
        )}
        <div>
          <Button onClick={send}>Send for clearance</Button>
        </div>
      </div>
    </Panel>
  );
}

function Clearance({ s }: { s: Supplier }) {
  const { dispatch } = useStore();
  const [d, setD] = useState<null | "cleared" | "rejected" | "more-info">(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string>();
  const copy = {
    cleared: { title: `Clear ${s.name}?`, btn: "Clear supplier", label: "What did you check?" },
    rejected: { title: `Reject ${s.name}?`, btn: "Reject supplier", label: "Why are you rejecting this supplier?" },
    "more-info": { title: "Send back to compliance?", btn: "Send back", label: "What's missing?" },
  };
  return (
    <Panel title="Clear this supplier">
      <div className="flex flex-col gap-4 text-sm">
        <DescriptionList
          items={[
            ["Assessed risk", <RiskTag risk={s.risk} />],
            ["Proposed by screen", <RiskTag risk={s.proposedRisk} />],
            ["Assessor's reason", s.riskReason ?? "Confirmed the proposed level"],
            ["Mitigation", s.mitigation ? `${s.mitigation.measure} (${s.mitigation.owner}, due ${formatDate(s.mitigation.due)})` : "Not required for low risk"],
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setD("cleared")}>Clear supplier</Button>
          <Button variant="secondary" onClick={() => setD("more-info")}>Send back for more information</Button>
          <Button variant="secondary" className="!text-risk-high !border-risk-high" onClick={() => setD("rejected")}>Reject supplier</Button>
        </div>
      </div>
      <Dialog open={!!d} onClose={() => setD(null)} title={d ? copy[d].title : ""}>
        {d && (
          <>
            <p className="m-0 text-sm">Your decision and reason are written to the audit log and kept for seven years.</p>
            <Field label={copy[d].label} error={err}>
              {({ id, describedBy, invalid }) => <TextArea id={id} autoFocus aria-describedby={describedBy} aria-invalid={invalid} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
            <div className="flex gap-3">
              <Button
                variant={d === "rejected" ? "danger" : "primary"}
                onClick={() => {
                  if (reason.trim().length < 10) return setErr("Write at least 10 characters so the decision can be understood later");
                  dispatch({ type: "clear-supplier", supplierId: s.id, decision: d, reason: reason.trim() });
                  setD(null);
                  setReason("");
                  setErr(undefined);
                }}
              >
                {copy[d].btn}
              </Button>
              <Button variant="quiet" onClick={() => setD(null)}>Cancel</Button>
            </div>
          </>
        )}
      </Dialog>
    </Panel>
  );
}

/* ============ C-01 Audit log ============ */

export function AuditLog() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const rows = [...state.audit].reverse().filter((e) => !q || `${e.target} ${e.action} ${e.reason ?? ""} ${e.actor}`.toLowerCase().includes(q.toLowerCase()));
  const [copied, setCopied] = useState<string>();
  const csv = () =>
    ["time,actor,action,record,reason", ...state.audit.map((e) => [e.at, e.actor === "system" ? "Clearpath" : PEOPLE[e.actor].name, e.action, e.target, e.reason ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([csv()], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "clearpath-audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  // Evaluation fix: file downloads are blocked in some embedded viewers, so offer a copy route too.
  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv());
      setCopied("Audit log copied as CSV. Paste it into a spreadsheet.");
    } catch {
      setCopied("Copying isn't allowed here. Use Download CSV instead.");
    }
  };
  return (
    <>
      <PageHeader title="Audit log" meta={<span>Read-only. Entries can't be edited or deleted and are kept for seven years.</span>} actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>Download CSV</Button>
            <Button variant="quiet" onClick={copyCsv}>Copy as CSV</Button>
          </>
        }
      />
      {copied && <p role="status" className="text-sm m-0 mb-4">{copied}</p>}
      <div className="max-w-md mb-4">
        <Field label="Filter by record, action or reason">
          {({ id }) => <TextInput id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. PR-2026-0322" />}
        </Field>
      </div>
      <Table caption="Audit log" head={["Time", "Who", "Action", "Record", "Reason"]}>
        {rows.map((e) => (
          <tr key={e.id}>
            <td className="whitespace-nowrap">{formatDateTime(e.at)}</td>
            <td>{e.actor === "system" ? "Clearpath" : PEOPLE[e.actor].name}</td>
            <td>{e.action}</td>
            <td>
              <Link to={e.target.startsWith("PR") ? `/requests/${e.target}` : `/suppliers/${e.target}`} className="text-petrol underline underline-offset-4 whitespace-nowrap">
                {e.target}
              </Link>
            </td>
            <td className="max-w-xs">{e.reason}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
