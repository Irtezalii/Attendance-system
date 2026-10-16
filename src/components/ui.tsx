import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AttendanceStatus, SessionStatus } from "../../shared/api";
import { ApiRequestError } from "../lib/api";
import { attendanceTone, formatPercentage, type Tone } from "../lib/format";

const toneText: Record<Tone, string> = {
  good: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  neutral: "text-slate-500",
};

const toneBar: Record<Tone, string> = {
  good: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  neutral: "bg-slate-300",
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
    />
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const status = error instanceof ApiRequestError ? error.status : 0;
  const notFound = status === 404 || status === 403;
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
      <p className="font-medium">{notFound ? "Not available" : "Something went wrong"}</p>
      <p className="mt-1 text-sm">{error.message}</p>
      {onRetry && !notFound && (
        <button onClick={onRetry} className="mt-3 text-sm font-medium text-rose-900 underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

export function PercentText({ value, className = "" }: { value: number | null; className?: string }) {
  return <span className={`${toneText[attendanceTone(value)]} ${className}`}>{formatPercentage(value)}</span>;
}

export function ProgressBar({ value }: { value: number | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={`h-full rounded-full ${toneBar[attendanceTone(value)]}`} style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function AttendancePill({ status, sessionStatus }: { status: AttendanceStatus | null; sessionStatus?: SessionStatus }) {
  if (sessionStatus === "cancelled") return <Pill className="bg-slate-100 text-slate-600">Cancelled</Pill>;
  if (status === "present") return <Pill className="bg-emerald-50 text-emerald-700">Present</Pill>;
  if (status === "absent") return <Pill className="bg-rose-50 text-rose-700">Absent</Pill>;
  return <Pill className="bg-amber-50 text-amber-700">Not marked</Pill>;
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

export function SemesterStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-indigo-50 text-indigo-700",
    completed: "bg-slate-100 text-slate-600",
    upcoming: "bg-sky-50 text-sky-700",
  };
  return <Pill className={styles[status] ?? styles.completed}>{status[0].toUpperCase() + status.slice(1)}</Pill>;
}
