import type { StudentCoursesResponse } from "../../../shared/api";
import { CourseCards, CourseTable } from "../../components/StudentCourseViews";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, SemesterStatusPill } from "../../components/ui";
import { ATTENDANCE_THRESHOLD, groupBySemester } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function StudentCourses() {
  const { data, error, loading, reload } = useApi<StudentCoursesResponse>("/student/courses");

  return (
    <>
      <PageHeader title="My Courses" subtitle="Every course you are enrolled in, grouped by semester." />
      {loading && <LoadingState label="Loading your courses…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.courses.length === 0 && (
        <EmptyState title="You are not enrolled in any courses yet.">Contact the UBIT office if this looks wrong.</EmptyState>
      )}
      {data &&
        groupBySemester(data.courses).map((group) => (
          <section key={group.label} className="mb-10">
            <SectionTitle aside={<SemesterStatusPill status={group.status} />}>{group.label}</SectionTitle>
            {group.status === "active" ? <CourseCards courses={group.items} /> : <CourseTable courses={group.items} />}
          </section>
        ))}
      {data && data.courses.length > 0 && (
        <p className="text-xs text-slate-500">
          Attendance = classes attended ÷ classes held. Cancelled classes are not counted. Below {ATTENDANCE_THRESHOLD}% is
          highlighted.
        </p>
      )}
    </>
  );
}
