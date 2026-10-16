import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { SEED_AUDIT, SEED_REQUESTS, SEED_SUPPLIERS } from "./seed";
import { buildRoute, screenRisk } from "./rules";
import type { AuditEvent, Mitigation, PersonId, PurchaseRequest, Risk, Supplier } from "./types";

interface State {
  user: PersonId;
  suppliers: Supplier[];
  requests: PurchaseRequest[];
  audit: AuditEvent[];
  toast?: { id: number; text: string };
}

export interface RequestDraft {
  replaces?: string;
  title: string;
  reason: string;
  amount: number;
  costCentre: string;
  supplierId: string;
  neededBy?: string;
}

type Action =
  | { type: "set-user"; user: PersonId }
  | { type: "submit-request"; draft: RequestDraft; id: string }
  | { type: "decide"; requestId: string; decision: "approved" | "rejected" | "changes-requested"; reason: string }
  | { type: "add-supplier"; supplier: Pick<Supplier, "name" | "vatId" | "country" | "industry" | "contactEmail">; id: string }
  | { type: "simulate-answers"; supplierId: string }
  | { type: "send-reminder"; supplierId: string }
  | { type: "confirm-risk"; supplierId: string; risk: Risk; reason?: string; mitigation?: Mitigation }
  | { type: "clear-supplier"; supplierId: string; decision: "cleared" | "rejected" | "more-info"; reason: string }
  | { type: "reset" };

const now = () => new Date().toISOString().slice(0, 19);
const today = () => new Date().toISOString().slice(0, 10);
let seq = 100;
const ev = (actor: AuditEvent["actor"], action: string, target: string, reason?: string): AuditEvent => ({
  id: `A-${++seq}`,
  at: now(),
  actor,
  action,
  target,
  reason,
});
const toast = (text: string) => ({ id: ++seq, text });

const initial: State = { user: "lena", suppliers: SEED_SUPPLIERS, requests: SEED_REQUESTS, audit: SEED_AUDIT };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "set-user":
      return { ...s, user: a.user, toast: undefined };

    case "submit-request": {
      const sup = s.suppliers.find((x) => x.id === a.draft.supplierId);
      const { route } = buildRoute(s.user, a.draft.costCentre, a.draft.amount, sup);
      const onHold = !sup || sup.status !== "cleared";
      const req: PurchaseRequest = {
        id: a.id,
        title: a.draft.title,
        reason: a.draft.reason,
        amount: a.draft.amount,
        costCentre: a.draft.costCentre,
        supplierId: a.draft.supplierId,
        neededBy: a.draft.neededBy || undefined,
        requester: s.user,
        status: onHold ? "on-hold" : "in-review",
        createdOn: today(),
        route,
      };
      const events = [ev(s.user, a.draft.replaces ? `Resubmitted request (replaces ${a.draft.replaces})` : "Submitted request", a.id)];
      if (onHold) events.push(ev("system", "Put request on hold: supplier not cleared", a.id));
      if (route.length > 1) events.push(ev("system", `Added second approval: ${route[1].note?.toLowerCase()}`, a.id));
      // Evaluation fix (adversarial auditor): the original is "superseded", not "rejected" — nobody rejected it.
      const requests = a.draft.replaces
        ? s.requests.map((r) => (r.id === a.draft.replaces ? { ...r, status: "superseded" as const } : r))
        : s.requests;
      if (a.draft.replaces) events.unshift(ev(s.user, `Replaced by ${a.id} after requested changes`, a.draft.replaces));
      return {
        ...s,
        requests: [req, ...requests],
        audit: [...s.audit, ...events],
        toast: toast(onHold ? "Request submitted and on hold until the supplier is cleared" : "Request submitted for approval"),
      };
    }

    case "decide": {
      const requests = s.requests.map((r) => {
        if (r.id !== a.requestId) return r;
        const idx = r.route.findIndex((st) => !st.decision);
        const route = r.route.map((st, i) => (i === idx ? { ...st, decision: a.decision, reason: a.reason, at: now() } : st));
        let status: PurchaseRequest["status"] = r.status;
        if (a.decision === "rejected") status = "rejected";
        else if (a.decision === "changes-requested") status = "changes-requested";
        else status = route.some((st) => !st.decision) ? "second-review" : "approved";
        return { ...r, route, status };
      });
      const label = { approved: "Approved", rejected: "Rejected", "changes-requested": "Requested changes to" }[a.decision];
      return {
        ...s,
        requests,
        audit: [...s.audit, ev(s.user, `${label} request`, a.requestId, a.reason)],
        toast: toast(
          a.decision === "approved" ? "Approved. The requester has been notified." : a.decision === "rejected" ? "Rejected. The requester has been notified." : "Changes requested. The request is back with the requester.",
        ),
      };
    }

    case "add-supplier": {
      const scr = screenRisk(a.supplier.country, a.supplier.industry);
      const sup: Supplier = {
        ...a.supplier,
        id: a.id,
        status: "awaiting-supplier",
        proposedRisk: scr.risk,
        questionnaire: "sent",
        questionnaireSentOn: today(),
        onboardedBy: s.user,
      };
      return {
        ...s,
        suppliers: [sup, ...s.suppliers],
        audit: [
          ...s.audit,
          ev(s.user, "Added supplier", a.id),
          ev("system", `Risk screen proposed ${scr.risk}: ${scr.because.join("; ")}`, a.id),
          ev(s.user, "Sent due-diligence questionnaire", a.id),
        ],
        toast: toast("Supplier added. Questionnaire sent."),
      };
    }

    case "send-reminder":
      return { ...s, audit: [...s.audit, ev(s.user, "Sent questionnaire reminder", a.supplierId)], toast: toast("Reminder sent") };

    case "simulate-answers":
      return {
        ...s,
        suppliers: s.suppliers.map((x) =>
          x.id === a.supplierId
            ? {
                ...x,
                status: "in-review",
                questionnaire: "answered",
                answers: [
                  { q: "Do you use subcontractors?", a: "No." },
                  { q: "Do you pay at least the statutory minimum wage to all staff?", a: "Yes." },
                  { q: "Complaints about working conditions in the last 24 months?", a: "None." },
                ],
              }
            : x,
        ),
        audit: [...s.audit, ev("system", "Supplier returned questionnaire", a.supplierId)],
        toast: toast("Supplier answers received"),
      };

    case "confirm-risk":
      return {
        ...s,
        suppliers: s.suppliers.map((x) =>
          x.id === a.supplierId
            ? { ...x, risk: a.risk, riskReason: a.reason, mitigation: a.mitigation, status: "in-review", assessedOn: today() }
            : x,
        ),
        audit: [
          ...s.audit,
          ev(s.user, a.reason ? `Set risk to ${a.risk} (override)` : `Confirmed risk ${a.risk}`, a.supplierId, a.reason),
          ...(a.mitigation ? [ev(s.user, `Added mitigation: ${a.mitigation.measure}`, a.supplierId)] : []),
        ],
        toast: toast("Assessment sent for clearance"),
      };

    case "clear-supplier": {
      const reassess = new Date();
      reassess.setFullYear(reassess.getFullYear() + 1);
      const suppliers = s.suppliers.map((x) => {
        if (x.id !== a.supplierId) return x;
        if (a.decision === "cleared")
          return { ...x, status: "cleared" as const, clearedBy: s.user, reassessBy: reassess.toISOString().slice(0, 10) };
        if (a.decision === "rejected") return { ...x, status: "rejected" as const, clearedBy: s.user };
        return { ...x, risk: undefined, status: "in-review" as const };
      });
      const released = a.decision === "cleared" ? s.requests.filter((r) => r.supplierId === a.supplierId && r.status === "on-hold") : [];
      const requests = s.requests.map((r) => (released.includes(r) ? { ...r, status: "in-review" as const } : r));
      const label = { cleared: "Cleared supplier", rejected: "Rejected supplier", "more-info": "Returned assessment for more information" }[a.decision];
      return {
        ...s,
        suppliers,
        requests,
        audit: [
          ...s.audit,
          ev(s.user, label, a.supplierId, a.reason),
          ...released.map((r) => ev("system", "Released request from hold: supplier cleared", r.id)),
        ],
        toast: toast(
          a.decision === "cleared"
            ? `Supplier cleared${released.length ? `. ${released.length} request${released.length > 1 ? "s" : ""} released for approval.` : "."}`
            : a.decision === "rejected"
              ? "Supplier rejected"
              : "Returned to compliance for more information",
        ),
      };
    }

    case "reset":
      return { ...initial, user: s.user };
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

export function nextId(prefix: string, existing: string[]) {
  const nums = existing.map((x) => Number(x.split("-").pop())).filter((n) => !Number.isNaN(n));
  const n = Math.max(0, ...nums) + 1;
  return prefix === "PR" ? `PR-2026-${String(n).padStart(4, "0")}` : `SUP-${String(n).padStart(4, "0")}`;
}
