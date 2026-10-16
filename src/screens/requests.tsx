import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { COST_CENTRES, PEOPLE } from "../data/seed";
import { buildRoute, daysUntil, formatDate, formatDateTime, formatEUR, neededByLabel } from "../data/rules";
import { nextId, useStore, type RequestDraft } from "../data/store";
import type { PurchaseRequest } from "../data/types";
import {
  Button,
  ButtonLink,
  DescriptionList,
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
  TextArea,
  TextInput,
  Timeline,
} from "../design-system/components";

/* ============ A-01 My requests ============ */

export function RequestsList() {
  const { state } = useStore();
  const mine = state.requests.filter((r) => r.requester === state.user);
  const sup = (id: string) => state.suppliers.find((s) => s.id === id);
  return (
    <>
      <PageHeader
        title="My requests"
        meta={<span>{mine.length ? `${mine.length} requests` : "No requests yet"}</span>}
        actions={<ButtonLink to="/requests/new">New request</ButtonLink>}
      />
      {mine.length === 0 ? (
        <EmptyState title="You haven't asked to buy anything yet" action={<ButtonLink to="/requests/new">New request</ButtonLink>}>
          Start a request when you need a product or service from a supplier. You'll see its status here.
        </EmptyState>
      ) : (
        <Table caption="My purchase requests" head={["Request", "Supplier", "Amount", "Status", "Waiting on"]}>
          {mine.map((r) => {
            const step = r.route.find((s) => !s.decision);
            const waiting =
              r.status === "on-hold"
                ? "Supplier clearance"
                : r.status === "changes-requested"
                  ? "You"
                  : step && (r.status === "in-review" || r.status === "second-review")
                    ? PEOPLE[step.person].name
                    : "None";
            return (
              <tr key={r.id}>
                <td>
                  <Link to={`/requests/${r.id}`} className="font-semibold text-petrol underline underline-offset-4">
                    {r.title}
                  </Link>
                  <div className="text-xs text-ink-muted">
                    {r.id}, created {formatDate(r.createdOn)}
                  </div>
                </td>
                <td>{sup(r.supplierId)?.name}</td>
                <td className="text-right whitespace-nowrap">{formatEUR(r.amount)}</td>
                <td>
                  <RequestStatusTag status={r.status} />
                </td>
                <td>{waiting}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}

/* ============ A-02 / A-03 New request: details, then review and submit ============ */

type Errors = Partial<Record<keyof RequestDraft, string>>;

function validate(d: RequestDraft): Errors {
  const e: Errors = {};
  if (!d.title.trim()) e.title = "Enter what you want to buy";
  else if (d.title.trim().length < 6) e.title = "Describe what you want to buy in at least 6 characters";
  if (!d.reason.trim()) e.reason = "Explain why the team needs this";
  if (!d.amount || d.amount <= 0) e.amount = "Enter an amount greater than €0";
  else if (d.amount > 500000) e.amount = "Requests over €500,000 go through the capital expenditure process, not Clearpath";
  if (!d.costCentre) e.costCentre = "Choose the cost centre that pays for this";
  if (!d.supplierId) e.supplierId = "Choose a supplier, or add a new one";
  if (d.neededBy && daysUntil(d.neededBy) < 0) e.neededBy = "Choose today or a later date";
  return e;
}

export function NewRequest() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = state.requests.find((r) => r.id === params.get("from"));
  const [draft, setDraft] = useState<RequestDraft>(
    from
      ? { replaces: from.id, title: from.title, reason: from.reason, amount: from.amount, costCentre: from.costCentre, supplierId: from.supplierId, neededBy: from.neededBy }
      : { title: "", reason: "", amount: 0, costCentre: "", supplierId: "" },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<0 | 1>(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const supplier = state.suppliers.find((s) => s.id === draft.supplierId);
  const preview = useMemo(() => buildRoute(state.user, draft.costCentre, draft.amount, supplier), [state.user, draft, supplier]);
  const changeNote = from?.route.find((s) => s.decision === "changes-requested");

  const set = <K extends keyof RequestDraft>(k: K, v: RequestDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const toReview = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setStep(1);
    window.scrollTo(0, 0);
  };

  const submit = () => {
    const id = nextId("PR", state.requests.map((r) => r.id));
    dispatch({ type: "submit-request", draft, id });
    navigate(`/requests/${id}`);
  };

  const errorList = Object.entries(errors);

  return (
    <>
      <PageHeader title={from ? "Edit and resubmit request" : "New purchase request"} back={{ to: "/requests", label: "Back to my requests" }} />
      <div className="mb-6">
        <Steps steps={["Request details", "Review and submit"]} current={step} />
      </div>

      {changeNote && step === 0 && (
        <div className="mb-6 max-w-2xl">
          <Notice tone="warning" title={`${PEOPLE[changeNote.person].name} asked for changes`}>
            “{changeNote.reason}”
          </Notice>
        </div>
      )}

      {step === 0 ? (
        <form onSubmit={toReview} noValidate className="max-w-2xl flex flex-col gap-5">
          {errorList.length > 0 && (
            <div ref={summaryRef} tabIndex={-1} className="outline-none">
              <Notice tone="error" title={`Fix ${errorList.length} ${errorList.length === 1 ? "problem" : "problems"} to continue`}>
                <ul className="m-0 pl-5 flex flex-col gap-1">
                  {errorList.map(([k, msg]) => (
                    <li key={k}>
                      <a href={`#field-${k}`} onClick={(e) => { e.preventDefault(); document.querySelector<HTMLElement>(`[data-field="${k}"]`)?.focus(); }} className="underline inline-block py-0.5">
                        {msg}
                      </a>
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}

          <Field label="What do you want to buy?" hint="A short name your approver will recognise, e.g. “Sensor boards for test rigs”." error={errors.title}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} data-field="title" aria-describedby={describedBy} aria-invalid={invalid} value={draft.title} onChange={(e) => set("title", e.target.value)} />
            )}
          </Field>

          <Field label="Why does the team need it?" hint="Approvers decide faster when they see the business reason and the deadline." error={errors.reason}>
            {({ id, describedBy, invalid }) => (
              <TextArea id={id} data-field="reason" aria-describedby={describedBy} aria-invalid={invalid} value={draft.reason} onChange={(e) => set("reason", e.target.value)} />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Amount (EUR, net)" hint="Total for the whole order, excluding VAT." error={errors.amount}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  data-field="amount"
                  inputMode="decimal"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={draft.amount ? String(draft.amount) : ""}
                  onChange={(e) => set("amount", Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                />
              )}
            </Field>
            <Field label="Cost centre" hint="The budget that pays for this." error={errors.costCentre}>
              {({ id, describedBy, invalid }) => (
                <Select id={id} data-field="costCentre" aria-describedby={describedBy} aria-invalid={invalid} value={draft.costCentre} onChange={(e) => set("costCentre", e.target.value)}>
                  <option value="">Choose a cost centre</option>
                  {COST_CENTRES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id}, {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Needed by" optional hint="Approvers see this date. Leave empty if there's no deadline." error={errors.neededBy}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} type="date" data-field="neededBy" className="sm:max-w-56" aria-describedby={describedBy} aria-invalid={invalid} value={draft.neededBy ?? ""} onChange={(e) => set("neededBy", e.target.value)} />
            )}
          </Field>

          <Field
            label="Supplier"
            hint={
              <>
                Only cleared suppliers can be approved. Not listed?{" "}
                <Link to="/suppliers/new" className="text-petrol underline">
                  Ask compliance to add a supplier
                </Link>
                .
              </>
            }
            error={errors.supplierId}
          >
            {({ id, describedBy, invalid }) => (
              <Select id={id} data-field="supplierId" aria-describedby={describedBy} aria-invalid={invalid} value={draft.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                <option value="">Choose a supplier</option>
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status === "blocked" || s.status === "rejected"}>
                    {s.name} ({s.status === "cleared" ? "cleared" : s.status === "blocked" || s.status === "rejected" ? "blocked, cannot be used" : "not cleared yet"})
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {supplier && supplier.status !== "cleared" && (
            <Notice tone="warning" title={`${supplier.name} is not cleared yet`}>
              You can still submit. The request will wait on hold and go to your approver as soon as compliance clears the supplier.
            </Notice>
          )}

          <div className="flex gap-3">
            <Button type="submit">Continue to review</Button>
            <ButtonLink to="/requests" variant="quiet">
              Cancel
            </ButtonLink>
          </div>
        </form>
      ) : (
        <div className="max-w-2xl flex flex-col gap-5">
          <Panel title="Your request" actions={<Button variant="quiet" onClick={() => setStep(0)}>Change</Button>}>
            <DescriptionList
              items={[
                ["What", draft.title],
                ["Why", draft.reason],
                ["Amount", formatEUR(draft.amount)],
                ["Needed by", draft.neededBy ? neededByLabel(draft.neededBy) : "No deadline"],
                ["Cost centre", COST_CENTRES.find((c) => c.id === draft.costCentre)?.name ?? draft.costCentre],
                [
                  "Supplier",
                  <span className="flex flex-wrap items-center gap-2">
                    {supplier?.name} {supplier && <SupplierStatusTag status={supplier.status} />} {supplier && <RiskTag risk={supplier.risk} />}
                  </span>,
                ],
              ]}
            />
          </Panel>
          <Panel title="Who will approve it">
            <ol className="m-0 pl-5 flex flex-col gap-2 text-sm">
              {preview.route.map((s, i) => (
                <li key={i}>
                  <span className="font-semibold">{PEOPLE[s.person].name}</span>, {s.kind === "approval" ? "budget approval" : "second approval"}
                  {s.note && <span className="text-ink-muted"> ({s.note})</span>}
                </li>
              ))}
            </ol>
            {preview.notes.map((n) => (
              <p key={n} className="text-sm text-ink-muted mt-3 mb-0">
                {n}
              </p>
            ))}
            {supplier?.status !== "cleared" && (
              <p className="text-sm mt-3 mb-0">Approval starts after the supplier is cleared.</p>
            )}
          </Panel>
          <p className="text-sm text-ink-muted m-0">Submitting records your name and the time in the audit log. You can't edit the request after this unless an approver asks for changes.</p>
          <div className="flex gap-3">
            <Button onClick={submit}>{from ? "Resubmit request" : "Submit request"}</Button>
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back to details
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============ A-04 Request detail (requester view) ============ */

type HistoryItem = { key: string; when: string; who: string; what: string; reason?: string; tone: "done" | "pending" | "bad" };

export function requestHistory(r: PurchaseRequest, audit: ReturnType<typeof useStore>["state"]["audit"]): HistoryItem[] {
  return audit
    .filter((e) => e.target === r.id)
    .map((e) => ({
      key: e.id,
      when: formatDateTime(e.at),
      who: e.actor === "system" ? "Clearpath" : PEOPLE[e.actor].name,
      what: e.action,
      reason: e.reason,
      tone: e.action.startsWith("Rejected") ? "bad" : "done",
    }));
}

export function RequestDetail() {
  const { id } = useParams();
  const { state } = useStore();
  const r = state.requests.find((x) => x.id === id);
  if (!r) return <NotFound what="request" back="/requests" />;
  const sup = state.suppliers.find((s) => s.id === r.supplierId);
  const next = r.route.find((s) => !s.decision);
  const changes = r.route.find((s) => s.decision === "changes-requested");
  const history = requestHistory(r, state.audit);
  if (next && (r.status === "in-review" || r.status === "second-review" || r.status === "on-hold")) {
    // Fix from evaluation: an on-hold request waits on compliance, not on the approver.
    history.push(
      r.status === "on-hold" && sup
        ? {
            key: "next",
            when: "",
            who: `${PEOPLE[sup.onboardedBy].name}, compliance`,
            what: sup.status === "awaiting-supplier" ? "Waiting for the supplier to answer the due-diligence questionnaire" : "Compliance is assessing the supplier",
            tone: "pending",
          }
        : { key: "next", when: "", who: PEOPLE[next.person].name, what: `Waiting for ${next.kind === "approval" ? "approval" : "second approval"}`, tone: "pending" },
    );
  }
  const isRequester = r.requester === state.user;

  return (
    <>
      <PageHeader
        title={r.title}
        back={isRequester ? { to: "/requests", label: "Back to my requests" } : { to: "/approvals", label: "Back to approvals" }}
        meta={
          <>
            <span>{r.id}</span>
            <RequestStatusTag status={r.status} />
          </>
        }
        actions={isRequester && r.status === "changes-requested" ? <ButtonLink to={`/requests/new?from=${r.id}`}>Edit and resubmit</ButtonLink> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          {r.status === "on-hold" && (
            <Notice tone="warning" title="On hold until the supplier is cleared">
              {sup?.name} is in due diligence ({sup?.status === "awaiting-supplier" ? "waiting for the supplier's answers" : "being assessed by compliance"}). {sup && PEOPLE[sup.onboardedBy].name} owns this step. You don't need to do anything; the request moves to approval automatically.
              {r.neededBy && daysUntil(r.neededBy) <= 14 && (
                <span className="block mt-1 font-semibold">You need this by {formatDate(r.neededBy)}. If that's at risk, tell {sup && PEOPLE[sup.onboardedBy].name} now.</span>
              )}
            </Notice>
          )}
          {r.status === "changes-requested" && changes && (
            <Notice tone="warning" title={`${PEOPLE[changes.person].name} asked for changes`}>
              “{changes.reason}” Edit the request and resubmit it; the original stays in the audit log.
            </Notice>
          )}
          {r.status === "approved" && <Notice tone="success" title="Approved. Raise the purchase order in the ERP with this request number." />}
          {r.status === "rejected" && <Notice tone="error" title="This request was rejected. The reason is in the history below." />}
          {r.status === "superseded" && <Notice tone="info" title="This version was replaced after changes were requested. The history shows the new request number." />}
          <Panel title="Details">
            <DescriptionList
              items={[
                ["Why", r.reason],
                ["Amount", formatEUR(r.amount)],
                ["Needed by", r.neededBy ? neededByLabel(r.neededBy) : "No deadline"],
                ["Cost centre", r.costCentre],
                ["Requested by", `${PEOPLE[r.requester].name}, ${formatDate(r.createdOn)}`],
              ]}
            />
          </Panel>
          <Panel title="History">
            <Timeline items={history} />
          </Panel>
        </div>
        <Panel title="Supplier" headingLevel={2} className="h-fit">
          {sup && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="m-0 font-semibold">{sup.name}</p>
              <div className="flex flex-wrap gap-2">
                <SupplierStatusTag status={sup.status} />
                <RiskTag risk={sup.risk} />
              </div>
              <p className="m-0 text-ink-muted">
                {sup.country}, {sup.industry}
              </p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export function NotFound({ what, back }: { what: string; back: string }) {
  return (
    <EmptyState title={`This ${what} doesn't exist or you don't have access to it`} action={<ButtonLink to={back} variant="secondary">Go back</ButtonLink>}>
      Check the link, or ask the person who shared it to confirm the number.
    </EmptyState>
  );
}
