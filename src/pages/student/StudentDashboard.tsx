import { Link } from "react-router";
import type { StudentCourse, StudentCoursesResponse } from "../../../shared/api";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PercentText,
  ProgressBar,
  SemesterStatusPill,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { ATTENDANCE_THRESHOLD, groupBySemester } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function StudentDashboard() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useApi<StudentCoursesResponse>("/student/courses");
  if (!me || me.profile.kind !== "student") return null;
  const profile = me.profile;

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.name}`}
        subtitle={`${profile.program.name} · Roll No. ${profile.rollNumber} · Semester ${profile.currentSemester}`}
      />

      {loading && <LoadingState label="Loading your courses…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.courses.length === 0 && (
        <EmptyState title="You are not enrolled in any courses yet.">
          Contact the administration office if this looks wrong.
        </EmptyState>
      )}

      {data &&
        groupBySemester(data.courses).map((group, index) => (
          <section key={group.label} className="mb-10">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{group.label}</h2>
              <SemesterStatusPill status={group.status} />
            </div>
            {index === 0 ? <CourseCards courses={group.items} /> : <CourseTable courses={group.items} />}
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

function CourseCards({ courses }: { courses: StudentCourse[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <Link key={course.offeringId} to={`/student/courses/${course.offeringId}`} className="group">
          <Card className="h-full p-5 transition group-hover:border-indigo-300 group-hover:shadow-md">
            <p className="text-xs font-medium text-indigo-600">{course.courseCode}</p>
            <h3 className="mt-1 font-semibold text-slate-900">{course.courseTitle}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{course.faculty.name}</p>
            <div className="mt-4 flex items-baseline justify-between">
              <PercentText
                value={course.summary.percentage}
                className={course.summary.percentage === null ? "text-sm" : "text-2xl font-semibold"}
              />
              <span className="text-xs text-slate-500">
                {course.summary.attended} / {course.summary.held} attended
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={course.summary.percentage} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {course.summary.missed} missed · {course.creditHours} credit hours
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function CourseTable({ courses }: { courses: StudentCourse[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 text-right font-medium">Classes held</th>
            <th className="px-4 py-3 text-right font-medium">Attended</th>
            <th className="px-4 py-3 text-right font-medium">Missed</th>
            <th className="px-4 py-3 text-right font-medium">Attendance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {courses.map((course) => (
            <tr key={course.offeringId} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link to={`/student/courses/${course.offeringId}`} className="font-medium text-slate-900 hover:text-indigo-600">
                  {course.courseTitle}
                </Link>
                <p className="text-xs text-slate-500">{course.courseCode}</p>
              </td>
              <td className="px-4 py-3 text-right">{course.summary.held}</td>
              <td className="px-4 py-3 text-right">{course.summary.attended}</td>
              <td className="px-4 py-3 text-right">{course.summary.missed}</td>
              <td className="px-4 py-3 text-right font-medium">
                <PercentText value={course.summary.percentage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
