import { useParams } from "react-router";
import type { StudentCourseDetailResponse } from "../../../shared/api";
import { AttendanceHistory, SummaryStats } from "../../components/AttendanceHistory";
import { BackLink, EnrollmentPill, ErrorState, LoadingState, PageHeader, SectionTitle } from "../../components/ui";
import { semesterLabel } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function StudentCourseDetail() {
  const { offeringId } = useParams();
  const { data, error, loading, reload } = useApi<StudentCourseDetailResponse>(`/student/courses/${offeringId}`);

  return (
    <>
      <BackLink to="/student/courses">My Courses</BackLink>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <PageHeader
            eyebrow={data.course.courseCode}
            title={data.course.courseTitle}
            subtitle={
              <span className="flex flex-wrap items-center gap-2">
                {semesterLabel(data.course)} · {data.course.faculty.name} · {data.course.creditHours} credit hours
                <EnrollmentPill status={data.course.enrollmentStatus} />
              </span>
            }
          />
          <SummaryStats summary={data.course.summary} />
          <SectionTitle>Attendance by date</SectionTitle>
          <AttendanceHistory entries={data.entries} />
        </>
      )}
    </>
  );
}
