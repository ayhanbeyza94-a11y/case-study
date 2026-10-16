import { COST_CENTRES, SECOND_APPROVAL_THRESHOLD } from "./seed";
import type { PersonId, Risk, RouteStep, Supplier } from "./types";

/**
 * Abstract country + industry screen (LkSG risk analysis, first stage).
 * ILLUSTRATIVE ONLY: a real product would use a maintained index
 * (e.g. country risk indices licensed from a data provider), not a hard-coded list.
 */
const ELEVATED_COUNTRIES = ["Vietnam", "Bangladesh", "India", "China", "Turkey", "United Arab Emirates", "Brazil"];
const ELEVATED_INDUSTRIES = ["Electronics manufacturing", "Textiles", "Raw materials trading", "Mining", "Cleaning and facility services", "Agriculture"];

export function screenRisk(country: string, industry: string): { risk: Risk; because: string[] } {
  const because: string[] = [];
  const c = ELEVATED_COUNTRIES.includes(country);
  const i = ELEVATED_INDUSTRIES.includes(industry);
  if (c) because.push(`${country} is on the elevated country list`);
  if (i) because.push(`${industry} is an elevated-risk industry`);
  if (c && i) return { risk: "high", because };
  if (c || i) return { risk: "medium", because };
  return { risk: "low", because: ["No country or industry flags"] };
}

export function needsSecondApproval(amount: number, risk: Risk | undefined) {
  const reasons: string[] = [];
  if (amount > SECOND_APPROVAL_THRESHOLD) reasons.push(`over ${formatEUR(SECOND_APPROVAL_THRESHOLD)}`);
  if (risk === "medium" || risk === "high") reasons.push(`${risk}-risk supplier`);
  return reasons;
}

/** Builds the approval route. Enforces segregation of duties: a requester never approves their own request. */
export function buildRoute(
  requester: PersonId,
  costCentre: string,
  amount: number,
  supplier: Supplier | undefined,
): { route: RouteStep[]; notes: string[] } {
  const notes: string[] = [];
  const owner = (COST_CENTRES.find((c) => c.id === costCentre)?.owner ?? "markus") as PersonId;
  let first: PersonId = owner;
  if (owner === requester) {
    first = "jonas";
    notes.push("You own this cost centre, so your deputy approver Jonas Weber reviews it instead.");
  }
  const route: RouteStep[] = [{ kind: "approval", person: first }];
  const reasons = needsSecondApproval(amount, supplier?.risk);
  if (reasons.length) {
    const second: PersonId = requester === "aylin" ? "jonas" : "aylin";
    const note = reasons.join(" and ");
    route.push({ kind: "second-approval", person: second, note: note.charAt(0).toUpperCase() + note.slice(1) });
  }
  return { route, notes };
}

export const formatEUR = (n: number) =>
  // English UI: €31,750. (de-DE would give "31.750 €", which clashed with copy like "over €25,000".)
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Whole days from today to an ISO date (negative = overdue). */
export const daysUntil = (iso: string) => Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 864e5);
export const neededByLabel = (iso: string) => {
  const d = daysUntil(iso);
  return d < 0 ? `${formatDate(iso)} (overdue by ${-d} days)` : d === 0 ? `${formatDate(iso)} (today)` : `${formatDate(iso)} (in ${d} days)`;
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  // Evaluation fix: audit evidence needs an unambiguous time zone.
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin", timeZoneName: "short" }).format(
    new Date(iso),
  );
