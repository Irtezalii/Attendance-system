import { useState } from "react";
import type { RecentSessionsResponse } from "../../../shared/api";
import { RecentSessionsTable } from "../../components/RecentSessionsTable";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { offeringLabel } from "../../lib/format";
import { inputStyles } from "../../lib/styles";
import { useApi } from "../../lib/useApi";

export function AttendanceRecords() {
  const { data, error, loading, reload } = useApi<RecentSessionsResponse>("/faculty/sessions");
  const [course, setCourse] = useState("all");

  const courses = [...new Map((data?.sessions ?? []).map((s) => [String(s.offering.offeringId), offeringLabel(s.offering)]))];
  const sessions = (data?.sessions ?? []).filter((s) => course === "all" || String(s.offering.offeringId) === course);

  return (
    <>
      <PageHeader
        title="Attendance Records"
        subtitle="Recent classes across your courses. Open a class to review or correct its marks; open a course to review by student."
      />
      <div className="mb-4 max-w-sm">
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
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && sessions.length === 0 && <EmptyState title="No classes recorded yet." />}
      {sessions.length > 0 && <RecentSessionsTable sessions={sessions} />}
      {data && data.sessions.length >= 200 && (
        <p className="mt-2 text-xs text-slate-500">Showing the 200 most recent classes. Older classes are listed on each course page.</p>
      )}
    </>
  );
}
