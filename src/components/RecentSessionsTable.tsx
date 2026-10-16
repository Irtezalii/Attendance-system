import { Link } from "react-router";
import type { RecentSession } from "../../shared/api";
import { formatDate } from "../lib/format";
import { linkStyles } from "../lib/styles";
import { Card, Pill } from "./ui";

/** Classes across a professor's courses, with present/absent counts. */
export function RecentSessionsTable({ sessions }: { sessions: RecentSession[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">Topic</th>
            <th className="px-4 py-3 text-right font-medium">Present</th>
            <th className="px-4 py-3 text-right font-medium">Absent</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sessions.map((s) => (
            <tr key={s.id} className={s.status === "cancelled" ? "text-slate-400" : "hover:bg-slate-50"}>
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(s.classDate)} <span className="text-slate-500">· {s.startTime}</span>
                {s.status === "cancelled" && <Pill className="ml-2 bg-slate-100 text-slate-600">Cancelled</Pill>}
              </td>
              <td className="px-4 py-3">
                <span className="font-medium">{s.offering.courseCode}</span>{" "}
                <span className="text-slate-500">
                  {s.offering.courseTitle}
                  {s.offering.section !== "A" && ` (Section ${s.offering.section})`}
                </span>
              </td>
              <td className="px-4 py-3">{s.topic ?? "—"}</td>
              <td className="px-4 py-3 text-right">{s.present}</td>
              <td className="px-4 py-3 text-right">{s.absent}</td>
              <td className="px-4 py-3 text-right">
                <Link to={`/faculty/sessions/${s.id}`} className={linkStyles}>
                  {s.offering.semester.status === "completed" ? "View" : "View / edit"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
