import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { PEOPLE } from "./data/seed";
import { useStore } from "./data/store";
import type { PersonId } from "./data/types";
import { Toast } from "./design-system/components";

function navFor(user: PersonId, counts: { approvals: number; clearance: number }) {
  const p = PEOPLE[user];
  const items: Array<{ to: string; label: string; count?: number }> = [];
  if (p.can.includes("approve") || p.can.includes("second-approve")) items.push({ to: "/approvals", label: "Approvals", count: counts.approvals });
  if (p.can.includes("request")) items.push({ to: "/requests", label: "My requests" });
  if (p.can.includes("onboard") || p.can.includes("clear-supplier")) items.push({ to: "/suppliers", label: "Suppliers", count: counts.clearance || undefined });
  if (p.can.includes("audit")) items.push({ to: "/audit", label: "Audit log" });
  return items;
}

export function AppShell() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const approvals = state.requests.filter((r) => {
    const step = r.route.find((s) => !s.decision);
    return step?.person === state.user && (r.status === "in-review" || r.status === "second-review");
  }).length;
  const clearance = state.suppliers.filter((s) => s.status === "in-review" && s.risk && s.onboardedBy !== state.user && PEOPLE[state.user].can.includes("clear-supplier")).length;
  const items = navFor(state.user, { approvals, clearance });

  // Deep links for testers: #/approvals/PR-2026-0322?as=markus
  const [params] = useSearchParams();
  const asParam = params.get("as");
  useEffect(() => {
    if (asParam && asParam in PEOPLE && asParam !== state.user) dispatch({ type: "set-user", user: asParam as PersonId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asParam]);

  // Clear toast after 5s.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "set-user", user: state.user }), 5000);
    return () => clearTimeout(t);
  }, [state.toast, state.user, dispatch]);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm whitespace-nowrap ${
      isActive ? "bg-white/15 font-semibold text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:bg-surface focus:p-2">
        Skip to content
      </a>
      <aside className="bg-petrol text-white md:min-h-dvh md:sticky md:top-0 md:h-dvh flex flex-col">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between md:block">
          <p className="m-0 text-lg font-bold">Clearpath</p>
          <p className="m-0 text-xs text-white/75 hidden md:block">Procurement & supplier due diligence</p>
        </div>
        <nav aria-label="Main" className="px-2 overflow-x-auto">
          <ul className="list-none m-0 p-0 flex md:flex-col gap-1">
            {items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} className={linkCls}>
                  {it.label}
                  {!!it.count && (
                    <span className="rounded-full bg-white text-petrol text-xs font-bold px-2" aria-label={`${it.count} waiting`}>
                      {it.count}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:mt-auto px-4 py-4 border-t border-white/15 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="persona" className="text-xs text-white/80">
              Prototype: viewing as
            </label>
            <select
              id="persona"
              value={state.user}
              onChange={(e) => {
                dispatch({ type: "set-user", user: e.target.value as PersonId });
                navigate("/");
              }}
              className="rounded-[var(--radius-control)] bg-white text-ink text-sm px-2 min-h-9"
            >
              {Object.values(PEOPLE).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}, {p.role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <NavLink to="/screens" className="inline-flex items-center min-h-6 text-white/85 underline underline-offset-4 hover:text-white">
              Screen index
            </NavLink>
            <NavLink to="/design-system" className="inline-flex items-center min-h-6 text-white/85 underline underline-offset-4 hover:text-white">
              Design system
            </NavLink>
            <button type="button" onClick={() => dispatch({ type: "reset" })} className="inline-flex items-center min-h-6 text-white/85 underline underline-offset-4 hover:text-white">
              Reset data
            </button>
          </div>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="px-4 py-6 md:px-10 md:py-8 max-w-[1180px] w-full">
        <Outlet />
      </main>
      <Toast text={state.toast?.text} />
    </div>
  );
}
