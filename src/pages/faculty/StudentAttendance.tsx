import { useParams } from "react-router";
import type { StudentInOfferingResponse } from "../../../shared/api";
import { AttendanceHistory, SummaryStats } from "../../components/AttendanceHistory";
import { BackLink, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { offeringLabel, semesterLabel } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function StudentAttendance() {
  const { offeringId, enrollmentId } = useParams();
  const { data, error, loading, reload } = useApi<StudentInOfferingResponse>(
    `/faculty/offerings/${offeringId}/students/${enrollmentId}`,
  );

  return (
    <>
      <BackLink to={`/faculty/offerings/${offeringId}`}>Back to course</BackLink>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <PageHeader
            title={data.student.name}
            subtitle={`${data.student.rollNumber} · ${offeringLabel(data.offering)} · ${semesterLabel(data.offering)}`}
          />
          <SummaryStats summary={data.student.summary} />
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Attendance by date</h2>
          <AttendanceHistory entries={data.entries} />
        </>
      )}
    </>
  );
}
