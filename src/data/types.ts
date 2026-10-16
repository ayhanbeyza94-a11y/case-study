export type Risk = "low" | "medium" | "high";
export type SupplierStatus = "cleared" | "in-review" | "awaiting-supplier" | "blocked" | "rejected";
export type RequestStatus =
  | "draft"
  | "in-review"
  | "second-review"
  | "changes-requested"
  | "approved"
  | "rejected"
  | "on-hold";

export type PersonId = "lena" | "markus" | "aylin" | "jonas";

export interface Person {
  id: PersonId;
  name: string;
  role: string;
  /** What this person can do in the prototype */
  can: Array<"request" | "approve" | "second-approve" | "onboard" | "clear-supplier" | "audit">;
}

export interface Mitigation {
  measure: string;
  owner: string;
  due: string; // ISO date
}

export interface Supplier {
  id: string;
  name: string;
  vatId: string;
  country: string;
  industry: string;
  contactEmail: string;
  status: SupplierStatus;
  proposedRisk: Risk;
  risk?: Risk;
  riskReason?: string;
  questionnaire: "not-sent" | "sent" | "answered";
  questionnaireSentOn?: string;
  answers?: Array<{ q: string; a: string; flag?: boolean }>;
  mitigation?: Mitigation;
  onboardedBy: PersonId;
  clearedBy?: PersonId;
  assessedOn?: string;
  reassessBy?: string;
}

export interface RouteStep {
  kind: "approval" | "second-approval";
  person: PersonId;
  decision?: "approved" | "rejected" | "changes-requested";
  reason?: string;
  at?: string;
  note?: string;
}

export interface PurchaseRequest {
  id: string;
  title: string;
  reason: string;
  amount: number;
  costCentre: string;
  supplierId: string;
  requester: PersonId;
  status: RequestStatus;
  createdOn: string;
  route: RouteStep[];
}

export interface AuditEvent {
  id: string;
  at: string; // ISO datetime
  actor: PersonId | "system";
  action: string;
  target: string; // request or supplier id
  reason?: string;
}
