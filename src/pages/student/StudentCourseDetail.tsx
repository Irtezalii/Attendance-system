import { useParams } from "react-router";
import type { StudentCourseDetailResponse } from "../../../shared/api";
import { AttendanceHistory, SummaryStats } from "../../components/AttendanceHistory";
import { BackLink, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import { semesterLabel } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function StudentCourseDetail() {
  const { offeringId } = useParams();
  const { data, error, loading, reload } = useApi<StudentCourseDetailResponse>(`/student/courses/${offeringId}`);

  return (
    <>
      <BackLink to="/student">All courses</BackLink>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <PageHeader
            title={`${data.course.courseCode} · ${data.course.courseTitle}`}
            subtitle={`${semesterLabel(data.course)} · ${data.course.faculty.name} · ${data.course.creditHours} credit hours`}
          />
          <SummaryStats summary={data.course.summary} />
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Attendance by date</h2>
          <AttendanceHistory entries={data.entries} />
        </>
      )}
    </>
  );
}
