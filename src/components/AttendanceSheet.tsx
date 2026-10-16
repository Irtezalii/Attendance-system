import type { AttendanceStatus } from "../../shared/api";
import { Card } from "./ui";

export interface SheetStudent {
  enrollmentId: number;
  rollNumber: string;
  name: string;
}

export type Marks = Record<number, AttendanceStatus | null>;

interface Props {
  students: SheetStudent[];
  marks: Marks;
  onChange: (marks: Marks) => void;
  readOnly?: boolean;
}

/** Present/Absent toggle list for a class. */
export function AttendanceSheet({ students, marks, onChange, readOnly = false }: Props) {
  const present = students.filter((s) => marks[s.enrollmentId] === "present").length;
  const absent = students.filter((s) => marks[s.enrollmentId] === "absent").length;
  const unmarked = students.length - present - absent;

  const setAll = (status: AttendanceStatus) =>
    onChange(Object.fromEntries(students.map((s) => [s.enrollmentId, status])));

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-emerald-700">{present} present</span> ·{" "}
          <span className="font-medium text-rose-700">{absent} absent</span>
          {unmarked > 0 && <span className="font-medium text-amber-700"> · {unmarked} not marked</span>}
        </p>
        {!readOnly && (
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setAll("present")} className="rounded-md px-2 py-1 text-emerald-700 hover:bg-emerald-50">
              Mark all present
            </button>
            <button type="button" onClick={() => setAll("absent")} className="rounded-md px-2 py-1 text-rose-700 hover:bg-rose-50">
              Mark all absent
            </button>
          </div>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {students.map((s) => {
          const status = marks[s.enrollmentId] ?? null;
          return (
            <li key={s.enrollmentId} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">{s.rollNumber}</p>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300" role="group" aria-label={`Attendance for ${s.name}`}>
                {(["present", "absent"] as const).map((option) => {
                  const selected = status === option;
                  const selectedStyle = option === "present" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white";
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={selected}
                      onClick={() => onChange({ ...marks, [s.enrollmentId]: option })}
                      className={`px-3 py-1.5 text-sm font-medium transition disabled:cursor-default ${
                        selected ? selectedStyle : "bg-white text-slate-600 hover:bg-slate-50"
                      } ${option === "absent" ? "border-l border-slate-300" : ""}`}
                    >
                      {option === "present" ? "Present" : "Absent"}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
