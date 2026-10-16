import type { AttendanceSummary, StudentAttendanceEntry } from "../../shared/api";
import { formatDate } from "../lib/format";
import { AttendancePill, Card, EmptyState, PercentText, StatCard } from "./ui";

export function SummaryStats({ summary }: { summary: AttendanceSummary }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Classes held" value={summary.held} />
      <StatCard label="Attended" value={summary.attended} />
      <StatCard label="Missed" value={summary.missed} />
      <StatCard
        label="Attendance"
        value={<PercentText value={summary.percentage} className={summary.percentage === null ? "text-base" : ""} />}
      />
    </div>
  );
}

/** Per-date attendance history for one student in one course. */
export function AttendanceHistory({ entries }: { entries: StudentAttendanceEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="No classes have been recorded for this course yet." />;
  }
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Topic</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.sessionId} className={entry.sessionStatus === "cancelled" ? "text-slate-400" : ""}>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(entry.classDate)}</td>
              <td className="px-4 py-3">{entry.startTime}</td>
              <td className="px-4 py-3">{entry.topic ?? "—"}</td>
              <td className="px-4 py-3">
                <AttendancePill status={entry.status} sessionStatus={entry.sessionStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
