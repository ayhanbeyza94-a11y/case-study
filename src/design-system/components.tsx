import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import type { RequestStatus, Risk, SupplierStatus } from "../data/types";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "quiet" | "danger";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 min-h-10 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const btnVariant: Record<Variant, string> = {
  primary: "bg-petrol text-white hover:bg-petrol-hover",
  secondary: "bg-surface text-petrol border border-petrol hover:bg-petrol-tint",
  quiet: "text-petrol underline underline-offset-4 hover:bg-petrol-tint px-2",
  danger: "bg-risk-high text-white hover:bg-[#831a25]",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...rest} className={`${btnBase} ${btnVariant[variant]} ${className}`} />;
}

export function ButtonLink({ variant = "primary", className = "", ...rest }: LinkProps & { variant?: Variant }) {
  return <Link {...rest} className={`${btnBase} ${btnVariant[variant]} ${className}`} />;
}

/* ---------- Form fields ---------- */

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label, hint and error are always wired to the control (aria-describedby / aria-invalid). */
export function Field({ label, hint, error, optional, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-muted m-0">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm text-risk-high font-semibold m-0 flex items-center gap-1">
          <ErrorGlyph /> {error}
        </p>
      )}
      {children({ id, describedBy, invalid: !!error })}
    </div>
  );
}

const control =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 min-h-10 text-base aria-[invalid=true]:border-risk-high aria-[invalid=true]:border-2";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className = "", ...p },
  ref,
) {
  return <input ref={ref} {...p} className={`${control} ${className}`} />;
});
export function Select({ className = "", ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`${control} ${className}`} />;
}
export function TextArea({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${control} py-2 min-h-24 ${className}`} />;
}

/* ---------- Status and risk ---------- */

function Glyph({ shape, className = "" }: { shape: "circle" | "ring" | "diamond" | "triangle" | "cross" | "pause"; className?: string }) {
  const c = `shrink-0 ${className}`;
  switch (shape) {
    case "circle":
      return <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={c}><circle cx="5" cy="5" r="5" fill="currentColor" /></svg>;
    case "ring":
      return <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={c}><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
    case "diamond":
      return <svg aria-hidden width="11" height="11" viewBox="0 0 10 10" className={c}><path d="M5 0L10 5L5 10L0 5z" fill="currentColor" /></svg>;
    case "triangle":
      return <svg aria-hidden width="11" height="10" viewBox="0 0 11 10" className={c}><path d="M5.5 0L11 10H0z" fill="currentColor" /></svg>;
    case "cross":
      return <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={c}><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="2.2" /></svg>;
    case "pause":
      return <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={c}><path d="M1.5 0h2.5v10H1.5zM6 0h2.5v10H6z" fill="currentColor" /></svg>;
  }
}
export const ErrorGlyph = () => <Glyph shape="cross" />;

const tagBase = "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

/** Risk is encoded by shape AND colour AND word, never colour alone. */
export function RiskTag({ risk, proposed = false }: { risk?: Risk; proposed?: boolean }) {
  if (!risk) return <span className={`${tagBase} border border-line text-ink-muted`}><Glyph shape="ring" />Not assessed</span>;
  const map = {
    low: { cls: "bg-risk-low-tint text-risk-low", shape: "circle" as const },
    medium: { cls: "bg-risk-medium-tint text-risk-medium", shape: "diamond" as const },
    high: { cls: "bg-risk-high-tint text-risk-high", shape: "triangle" as const },
  }[risk];
  return (
    <span className={`${tagBase} ${map.cls}`}>
      <Glyph shape={map.shape} />
      {risk.charAt(0).toUpperCase() + risk.slice(1)} risk{proposed ? " (proposed)" : ""}
    </span>
  );
}

const REQUEST_STATUS: Record<RequestStatus, { label: string; cls: string; shape: Parameters<typeof Glyph>[0]["shape"] }> = {
  draft: { label: "Draft", cls: "text-ink-muted border border-line", shape: "ring" },
  "in-review": { label: "In review", cls: "bg-petrol-tint text-petrol", shape: "ring" },
  "second-review": { label: "Second review", cls: "bg-petrol-tint text-petrol", shape: "ring" },
  "changes-requested": { label: "Changes requested", cls: "bg-risk-medium-tint text-risk-medium", shape: "diamond" },
  approved: { label: "Approved", cls: "bg-risk-low-tint text-risk-low", shape: "circle" },
  rejected: { label: "Rejected", cls: "bg-risk-high-tint text-risk-high", shape: "cross" },
  "on-hold": { label: "On hold", cls: "bg-risk-medium-tint text-risk-medium", shape: "pause" },
};
export function RequestStatusTag({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUS[status];
  return <span className={`${tagBase} ${s.cls}`}><Glyph shape={s.shape} /><span className="sr-only">Request status: </span>{s.label}</span>;
}

const SUPPLIER_STATUS: Record<SupplierStatus, { label: string; cls: string; shape: Parameters<typeof Glyph>[0]["shape"] }> = {
  cleared: { label: "Cleared", cls: "bg-risk-low-tint text-risk-low", shape: "circle" },
  "in-review": { label: "In review", cls: "bg-petrol-tint text-petrol", shape: "ring" },
  "awaiting-supplier": { label: "Awaiting supplier", cls: "bg-risk-medium-tint text-risk-medium", shape: "pause" },
  blocked: { label: "Blocked", cls: "bg-risk-high-tint text-risk-high", shape: "cross" },
  rejected: { label: "Rejected", cls: "bg-risk-high-tint text-risk-high", shape: "cross" },
};
export function SupplierStatusTag({ status }: { status: SupplierStatus }) {
  const s = SUPPLIER_STATUS[status];
  return <span className={`${tagBase} ${s.cls}`}><Glyph shape={s.shape} /><span className="sr-only">Supplier status: </span>{s.label}</span>;
}

/* ---------- Layout ---------- */

export function PageHeader({ title, meta, actions, back }: { title: string; meta?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {back && (
        <Link to={back.to} className="text-sm text-petrol underline underline-offset-4 w-fit">
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-bold m-0">{title}</h1>
          {meta && <div className="text-sm text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, children, className = "", headingLevel = 2, actions }: { title?: string; children: ReactNode; className?: string; headingLevel?: 2 | 3; actions?: ReactNode }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`bg-surface border border-line rounded-[var(--radius-panel)] ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <H className="text-lg font-semibold m-0">{title}</H>
          {actions}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function DescriptionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-2 m-0 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="m-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title: string; children?: ReactNode }) {
  const map = {
    // Evaluation fix: only errors are live regions; other notices are static content,
    // so they don't repeat what the toast already announced.
    info: { cls: "border-petrol bg-petrol-tint", shape: "ring" as const, role: undefined },
    warning: { cls: "border-risk-medium bg-risk-medium-tint", shape: "diamond" as const, role: undefined },
    error: { cls: "border-risk-high bg-risk-high-tint", shape: "cross" as const, role: "alert" },
    success: { cls: "border-risk-low bg-risk-low-tint", shape: "circle" as const, role: undefined },
  }[tone];
  return (
    <div role={map.role} className={`border-l-4 ${map.cls} rounded-[var(--radius-control)] px-4 py-3 text-sm`}>
      <p className="m-0 font-semibold flex items-center gap-2"><Glyph shape={map.shape} />{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong rounded-[var(--radius-panel)] px-6 py-10 text-center flex flex-col items-center gap-3">
      <p className="m-0 font-semibold">{title}</p>
      {children && <div className="text-sm text-ink-muted max-w-prose">{children}</div>}
      {action}
    </div>
  );
}

/* ---------- Table ---------- */

export function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-[var(--radius-panel)] overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold text-ink-muted whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Timeline (audit-style history) ---------- */

export function Timeline({ items }: { items: Array<{ key: string; when: string; who: string; what: string; reason?: string; tone?: "done" | "pending" | "bad" }> }) {
  return (
    <ol className="list-none m-0 p-0 flex flex-col">
      {items.map((it, i) => (
        <li key={it.key} className="grid grid-cols-[20px_1fr] gap-x-3">
          <div className="flex flex-col items-center">
            <span
              className={`mt-1.5 ${it.tone === "pending" ? "text-line-strong" : it.tone === "bad" ? "text-risk-high" : "text-petrol"}`}
            >
              <Glyph shape={it.tone === "pending" ? "ring" : it.tone === "bad" ? "cross" : "circle"} />
            </span>
            {i < items.length - 1 && <span aria-hidden className="w-px flex-1 bg-line my-1" />}
          </div>
          <div className="pb-4">
            <p className="m-0 text-sm font-semibold">{it.what}</p>
            <p className="m-0 text-xs text-ink-muted">
              {it.who}
              {it.when && <>, {it.when}</>}
            </p>
            {it.reason && <p className="m-0 mt-1 text-sm border-l-2 border-line pl-3">“{it.reason}”</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Dialog (native <dialog>, focus handled by the browser) ---------- */

export function Dialog({ open, onClose, title, children, describedBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; describedBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[var(--radius-panel)] border border-line p-0 text-ink shadow-[0_8px_32px_rgb(27_35_38/0.18)]"
    >
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        <h2 id={titleId} className="text-lg font-semibold m-0">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

/* ---------- Toast (polite live region) ---------- */

export function Toast({ text }: { text?: string }) {
  return (
    <div aria-live="polite" role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      {text && (
        <div className="bg-ink text-white text-sm font-semibold rounded-[var(--radius-control)] px-4 py-3 shadow-lg max-w-[calc(100vw-32px)]">{text}</div>
      )}
    </div>
  );
}

/* ---------- Steps (for the request flow, a real sequence) ---------- */

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="list-none m-0 p-0 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className={`flex items-center gap-2 ${i === current ? "font-semibold text-ink" : "text-ink-muted"}`}>
          <span
            className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${i < current ? "bg-petrol text-white" : i === current ? "border-2 border-petrol text-petrol" : "border border-line-strong"}`}
            aria-hidden
          >
            {i + 1}
          </span>
          {s}
          {i < current && <span className="sr-only"> (completed)</span>}
        </li>
      ))}
    </ol>
  );
}
