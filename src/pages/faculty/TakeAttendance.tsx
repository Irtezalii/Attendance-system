import { Link } from "react-router";
import type { FacultyOfferingsResponse } from "../../../shared/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { offeringLabel, semesterLabel } from "../../lib/format";
import { buttonStyles } from "../../lib/styles";
import { useApi } from "../../lib/useApi";

/** Step 1 of taking attendance: choose one of your courses in an active semester. */
export function TakeAttendance() {
  const { data, error, loading, reload } = useApi<FacultyOfferingsResponse>("/faculty/offerings");
  const open = (data?.offerings ?? []).filter((o) => o.semester.status !== "completed");

  return (
    <>
      <PageHeader title="Take Attendance" subtitle="Choose the course you are teaching. You can set the date and time on the next step." />
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && open.length === 0 && (
        <EmptyState title="None of your courses are open for attendance.">
          Attendance can only be recorded for courses in an active or upcoming semester.
        </EmptyState>
      )}
      {open.length > 0 && (
        <Card>
          <ul className="divide-y divide-slate-100">
            {open.map((o) => (
              <li key={o.offeringId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-ku-navy-900">{offeringLabel(o)}</p>
                  <p className="text-xs text-slate-500">
                    {semesterLabel(o)} · {o.enrolledCount} students enrolled
                  </p>
                </div>
                <Link to={`/faculty/offerings/${o.offeringId}/sessions/new`} className={`${buttonStyles.primary} shrink-0`}>
                  Start
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
