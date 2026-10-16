import { Link } from "react-router";
import type { StudentCourse } from "../../shared/api";
import { Card, EnrollmentPill, PercentText, ProgressBar } from "./ui";

export function CourseCards({ courses }: { courses: StudentCourse[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <Link key={course.offeringId} to={`/student/courses/${course.offeringId}`} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ku-maroon-300">
          <Card className="flex h-full flex-col p-5 transition group-hover:border-ku-maroon-200 group-hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-ku-maroon-700">{course.courseCode}</p>
              <EnrollmentPill status={course.enrollmentStatus} />
            </div>
            <h3 className="mt-1 line-clamp-2 font-semibold text-ku-navy-900" title={course.courseTitle}>
              {course.courseTitle}
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">{course.faculty.name}</p>
            <div className="mt-auto pt-4">
              <div className="flex items-baseline justify-between gap-2">
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
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function CourseTable({ courses }: { courses: StudentCourse[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 text-right font-medium">Credits</th>
            <th className="px-4 py-3 text-right font-medium">Held</th>
            <th className="px-4 py-3 text-right font-medium">Attended</th>
            <th className="px-4 py-3 text-right font-medium">Missed</th>
            <th className="px-4 py-3 text-right font-medium">Attendance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {courses.map((course) => (
            <tr key={course.offeringId} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link to={`/student/courses/${course.offeringId}`} className="font-medium text-ku-navy-900 hover:text-ku-maroon-700">
                  {course.courseTitle}
                </Link>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  {course.courseCode} <EnrollmentPill status={course.enrollmentStatus} />
                </p>
              </td>
              <td className="px-4 py-3 text-right">{course.creditHours}</td>
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
