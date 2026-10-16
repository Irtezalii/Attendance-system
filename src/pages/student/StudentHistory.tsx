import { useState } from "react";
import { Link } from "react-router";
import type { StudentHistoryEntry, StudentHistoryResponse } from "../../../shared/api";
import { AttendancePill, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { inputStyles } from "../../lib/styles";
import { useApi } from "../../lib/useApi";

type StatusFilter = "all" | "present" | "absent" | "cancelled" | "unmarked";

function matchesStatus(e: StudentHistoryEntry, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "cancelled") return e.sessionStatus === "cancelled";
  if (e.sessionStatus === "cancelled") return false;
  if (filter === "unmarked") return e.status === null;
  return e.status === filter;
}

export function StudentHistory() {
  const [scope, setScope] = useState<"current" | "all">("current");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const { data, error, loading, reload } = useApi<StudentHistoryResponse>(`/student/attendance?scope=${scope}`);

  const courses = [...new Map((data?.entries ?? []).map((e) => [String(e.offeringId), `${e.courseCode} · ${e.courseTitle}`]))];
  const entries = (data?.entries ?? []).filter(
    (e) => (course === "all" || String(e.offeringId) === course) && matchesStatus(e, status),
  );

  return (
    <>
      <PageHeader title="Attendance History" subtitle="Every class recorded for your courses, newest first." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="scope" className="mb-1 block text-xs font-medium text-slate-600">
            Semesters
          </label>
          <select
            id="scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as "current" | "all");
              setCourse("all");
            }}
            className={inputStyles}
          >
            <option value="current">Current semester</option>
            <option value="all">All semesters</option>
          </select>
        </div>
        <div>
          <label htmlFor="course" className="mb-1 block text-xs font-medium text-slate-600">
            Course
          </label>
          <select id="course" value={course} onChange={(e) => setCourse(e.target.value)} className={inputStyles}>
            <option value="all">All courses</option>
            {courses.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-600">
            Status
          </label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={inputStyles}>
            <option value="all">All</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="cancelled">Cancelled classes</option>
            <option value="unmarked">Not marked</option>
          </select>
        </div>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && entries.length === 0 && (
        <EmptyState title={data.entries.length === 0 ? "No attendance recorded yet." : "No classes match these filters."} />
      )}
      {entries.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.sessionId} className={e.sessionStatus === "cancelled" ? "text-slate-400" : ""}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(e.classDate)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/student/courses/${e.offeringId}`} className="hover:text-ku-maroon-700">
                      <span className="font-medium">{e.courseCode}</span>{" "}
                      <span className="text-slate-500">{e.courseTitle}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{e.startTime}</td>
                  <td className="px-4 py-3">{e.topic ?? "—"}</td>
                  <td className="px-4 py-3">
                    <AttendancePill status={e.status} sessionStatus={e.sessionStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data && data.entries.length >= 2000 && (
        <p className="mt-2 text-xs text-slate-500">Showing the 2,000 most recent classes.</p>
      )}
    </>
  );
}
