import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AttendanceStatus, EnrollmentStatus, OfferingInfo, SessionStatus, Shift } from "../../shared/api";
import { ApiRequestError } from "../lib/api";
import { attendanceTone, formatPercentage, type Tone } from "../lib/format";

const toneText: Record<Tone, string> = {
  good: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  neutral: "text-slate-500",
};

const toneBar: Record<Tone, string> = {
  good: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-slate-300",
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block size-5 animate-spin rounded-full border-2 border-slate-300 border-t-ku-maroon-700 ${className}`}
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
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
      <p className="font-medium">{notFound ? "Not available" : "Something went wrong"}</p>
      <p className="mt-1 text-sm">{error.message}</p>
      {onRetry && !notFound && (
        <button onClick={onRetry} className="mt-3 text-sm font-medium text-red-900 underline">
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

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ku-maroon-700">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold break-words sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ku-maroon-700">
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
      <p className="mt-1 text-2xl font-semibold text-ku-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function AttendancePill({ status, sessionStatus }: { status: AttendanceStatus | null; sessionStatus?: SessionStatus }) {
  if (sessionStatus === "cancelled") return <Pill className="bg-slate-100 text-slate-600">Cancelled</Pill>;
  if (status === "present") return <Pill className="bg-emerald-50 text-emerald-700">Present</Pill>;
  if (status === "absent") return <Pill className="bg-red-50 text-red-700">Absent</Pill>;
  return <Pill className="bg-amber-50 text-amber-700">Not marked</Pill>;
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function SemesterStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-ku-maroon-50 text-ku-maroon-700",
    completed: "bg-slate-100 text-slate-600",
    upcoming: "bg-ku-navy-50 text-ku-navy-700",
  };
  return <Pill className={styles[status] ?? styles.completed}>{status[0].toUpperCase() + status.slice(1)}</Pill>;
}

export function EnrollmentPill({ status }: { status: EnrollmentStatus }) {
  return status === "dropped" ? <Pill className="bg-slate-100 text-slate-600">Dropped</Pill> : null;
}

export function ProgrammeBadge({ code }: { code: string }) {
  return <Pill className="bg-ku-gold-100 text-ku-gold-700 ring-1 ring-ku-gold-400/50">{code}</Pill>;
}

export function ShiftPill({ shift }: { shift: Shift }) {
  return shift === "evening" ? (
    <Pill className="bg-ku-navy-900 text-white">Evening</Pill>
  ) : (
    <Pill className="bg-sky-50 text-sky-800 ring-1 ring-sky-200">Morning</Pill>
  );
}

/** Programme + schedule badges that identify which class an offering is. */
export function OfferingTags({ offering }: { offering: OfferingInfo }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {offering.programme && <ProgrammeBadge code={offering.programme} />}
      <ShiftPill shift={offering.shift} />
    </span>
  );
}
