import { useState } from "react";
import { Link, useParams } from "react-router";
import type { FacultyOfferingDetailResponse } from "../../../shared/api";
import { BackLink, Card, EmptyState, ErrorState, LoadingState, PageHeader, PercentText, Pill, StatCard } from "../../components/ui";
import { buttonStyles } from "../../lib/styles";
import { formatDate, offeringContext, offeringLabel } from "../../lib/format";
import { useApi } from "../../lib/useApi";

type Tab = "students" | "sessions";

export function OfferingDetail() {
  const { offeringId } = useParams();
  const { data, error, loading, reload } = useApi<FacultyOfferingDetailResponse>(`/faculty/offerings/${offeringId}`);
  const [tab, setTab] = useState<Tab>("students");

  return (
    <>
      <BackLink to="/faculty/courses">My Courses</BackLink>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <PageHeader
            title={offeringLabel(data.offering)}
            subtitle={`${offeringContext(data.offering)} · ${data.offering.creditHours} credit hours`}
            actions={
              data.offering.semester.status !== "completed" && (
                <Link to={`/faculty/offerings/${data.offering.offeringId}/live`} className={buttonStyles.primary}>
                  Take attendance
                </Link>
              )
            }
          />
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Enrolled students" value={data.offering.enrolledCount} />
            <StatCard label="Classes held" value={data.offering.sessionsHeld} hint="Cancelled classes excluded" />
            <StatCard
              label="Average attendance"
              value={
                <PercentText
                  value={data.offering.averagePercentage}
                  className={data.offering.averagePercentage === null ? "text-base" : ""}
                />
              }
            />
          </div>

          <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
            {(["students", "sessions"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                  tab === t ? "border-ku-maroon-700 text-ku-maroon-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t === "students" ? `Students (${data.students.length})` : `Classes (${data.sessions.length})`}
              </button>
            ))}
          </div>

          {tab === "students" ? <StudentsTable data={data} /> : <SessionsTable data={data} />}
        </>
      )}
    </>
  );
}

function StudentsTable({ data }: { data: FacultyOfferingDetailResponse }) {
  if (data.students.length === 0) return <EmptyState title="No students are enrolled in this course." />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Roll no.</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 text-right font-medium">Held</th>
            <th className="px-4 py-3 text-right font-medium">Attended</th>
            <th className="px-4 py-3 text-right font-medium">Missed</th>
            <th className="px-4 py-3 text-right font-medium">Attendance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.students.map((s) => (
            <tr key={s.enrollmentId} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{s.rollNumber}</td>
              <td className="px-4 py-3">
                <Link
                  to={`/faculty/offerings/${data.offering.offeringId}/students/${s.enrollmentId}`}
                  className="font-medium text-ku-navy-900 hover:text-ku-maroon-700"
                >
                  {s.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-right">{s.summary.held}</td>
              <td className="px-4 py-3 text-right">{s.summary.attended}</td>
              <td className="px-4 py-3 text-right">{s.summary.missed}</td>
              <td className="px-4 py-3 text-right font-medium">
                <PercentText value={s.summary.percentage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SessionsTable({ data }: { data: FacultyOfferingDetailResponse }) {
  if (data.sessions.length === 0) {
    return <EmptyState title="No classes recorded yet.">Use “Take attendance” to record the first class.</EmptyState>;
  }
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Topic</th>
            <th className="px-4 py-3 text-right font-medium">Present</th>
            <th className="px-4 py-3 text-right font-medium">Absent</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.sessions.map((s) => (
            <tr key={s.id} className={s.status === "cancelled" ? "text-slate-400" : "hover:bg-slate-50"}>
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(s.classDate)}
                {s.status === "cancelled" && <Pill className="ml-2 bg-slate-100 text-slate-600">Cancelled</Pill>}
              </td>
              <td className="px-4 py-3">{s.startTime}</td>
              <td className="px-4 py-3">{s.topic ?? "—"}</td>
              <td className="px-4 py-3 text-right">{s.present}</td>
              <td className="px-4 py-3 text-right">{s.absent}</td>
              <td className="px-4 py-3 text-right">
                <Link to={`/faculty/sessions/${s.id}`} className="font-medium text-ku-maroon-700 hover:text-ku-maroon-900">
                  {data.offering.semester.status === "completed" ? "View" : "View / edit"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
