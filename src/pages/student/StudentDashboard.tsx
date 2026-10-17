import { Link } from "react-router";
import type { StudentCoursesResponse, StudentHistoryResponse } from "../../../shared/api";
import { attendancePercentage } from "../../../shared/api";
import { CourseCards } from "../../components/StudentCourseViews";
import {
  AttendancePill,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PercentText,
  ProgrammeBadge,
  SectionTitle,
  ShiftPill,
  StatCard,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { ATTENDANCE_THRESHOLD, formatDate, semesterLabel } from "../../lib/format";
import { linkStyles } from "../../lib/styles";
import { useApi } from "../../lib/useApi";

export function StudentDashboard() {
  const { me } = useAuth();
  const courses = useApi<StudentCoursesResponse>("/student/courses");
  const history = useApi<StudentHistoryResponse>("/student/attendance");
  if (!me || me.profile.kind !== "student") return null;
  const profile = me.profile;

  const current = (courses.data?.courses ?? []).filter((c) => c.semester.status === "active" && c.enrollmentStatus === "enrolled");
  const held = current.reduce((sum, c) => sum + c.summary.held, 0);
  const attended = current.reduce((sum, c) => sum + c.summary.attended, 0);
  const low = current.filter((c) => c.summary.percentage !== null && c.summary.percentage < ATTENDANCE_THRESHOLD);
  const recent = (history.data?.entries ?? []).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={profile.programme.name}
        title={`Welcome, ${profile.name}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ProgrammeBadge code={profile.programme.code} />
            <ShiftPill shift={profile.shift} />
            Roll No. {profile.rollNumber} · Semester {profile.currentSemester} of {profile.programme.semesterCount}
          </span>
        }
      />

      {courses.loading && <LoadingState label="Loading your courses…" />}
      {courses.error && <ErrorState error={courses.error} onRetry={courses.reload} />}

      {courses.data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Current courses" value={current.length} />
            <StatCard
              label="Overall attendance"
              value={<PercentText value={attendancePercentage(attended, held)} className={held === 0 ? "text-base" : ""} />}
              hint="Current semester"
            />
            <StatCard label="Classes missed" value={held - attended} hint={`of ${held} held`} />
            <StatCard label={`Below ${ATTENDANCE_THRESHOLD}%`} value={low.length} hint={low.length === 1 ? "course" : "courses"} />
          </div>

          {low.length > 0 && (
            <div role="status" className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Attendance below {ATTENDANCE_THRESHOLD}% in:</p>
              <ul className="mt-1 list-inside list-disc">
                {low.map((c) => (
                  <li key={c.offeringId}>
                    <Link to={`/student/courses/${c.offeringId}`} className="underline">
                      {c.courseCode} {c.courseTitle}
                    </Link>{" "}
                    ({c.summary.percentage}%)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="mb-10">
            <SectionTitle aside={<Link to="/student/courses" className={`${linkStyles} ml-auto text-sm`}>All courses →</Link>}>
              {current[0] ? semesterLabel(current[0]) : "Current semester"}
            </SectionTitle>
            {current.length === 0 ? (
              <EmptyState title="You have no courses in the current semester.">
                Past semesters are listed under <Link to="/student/courses" className={linkStyles}>My Courses</Link>.
              </EmptyState>
            ) : (
              <CourseCards courses={current} />
            )}
          </section>

          <section>
            <SectionTitle aside={<Link to="/student/history" className={`${linkStyles} ml-auto text-sm`}>Full history →</Link>}>
              Recent classes
            </SectionTitle>
            {history.loading && <LoadingState />}
            {history.error && <ErrorState error={history.error} onRetry={history.reload} />}
            {history.data && recent.length === 0 && <EmptyState title="No attendance recorded yet this semester." />}
            {recent.length > 0 && (
              <Card>
                <ul className="divide-y divide-slate-100">
                  {recent.map((e) => (
                    <li key={e.sessionId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ku-navy-900">
                          {e.courseCode} · {e.courseTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(e.classDate)} · {e.startTime}
                        </p>
                      </div>
                      <AttendancePill status={e.status} sessionStatus={e.sessionStatus} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </>
      )}
    </>
  );
}
