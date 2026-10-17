import { Link, useSearchParams } from "react-router";
import type { FacultyOffering, FacultyOfferingsResponse, Shift } from "../../../shared/api";
import { Card, EmptyState, ErrorState, LoadingState, OfferingTags, PageHeader, SectionTitle, SegmentedControl } from "../../components/ui";
import { shiftLabel } from "../../lib/format";
import { buttonStyles } from "../../lib/styles";
import { useApi } from "../../lib/useApi";

const SHIFTS: Shift[] = ["morning", "evening"];

/** Step 1 of taking attendance: choose the exact class (schedule, programme, semester, course). */
export function TakeAttendance() {
  const { data, error, loading, reload } = useApi<FacultyOfferingsResponse>("/faculty/offerings");
  const [params, setParams] = useSearchParams();
  const open = (data?.offerings ?? []).filter((o) => o.semester.status !== "completed");
  const count = (s: Shift) => open.filter((o) => o.shift === s).length;

  // Selected schedule lives in the URL (?shift=evening). Default: Morning, unless only Evening has classes.
  const requested = params.get("shift");
  const shift: Shift =
    requested === "morning" || requested === "evening" ? requested : count("morning") === 0 && count("evening") > 0 ? "evening" : "morning";
  const visible = open.filter((o) => o.shift === shift);

  // Group by programme, e.g. "BSCS".
  const groups = new Map<string, FacultyOffering[]>();
  for (const o of visible) {
    const key = o.programme ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        title="Take Attendance"
        subtitle="Choose the class you are teaching. Only students enrolled in that programme, schedule and course offering are listed."
      />

      {data && open.length > 0 && (
        <div className="mb-6">
          <SegmentedControl
            label="Schedule"
            value={shift}
            options={SHIFTS.map((s) => ({ value: s, label: shiftLabel(s), count: count(s) }))}
            onChange={(s) => setParams(s === "morning" ? {} : { shift: s }, { replace: true })}
          />
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && open.length === 0 && (
        <EmptyState title="None of your courses are open for attendance.">
          Attendance can only be recorded for courses in an active or upcoming semester.
        </EmptyState>
      )}
      {data && open.length > 0 && visible.length === 0 && (
        <EmptyState title={`You have no ${shiftLabel(shift).toLowerCase()} classes open for attendance.`} />
      )}
      {ordered.map(([programme, offerings]) => (
        <section key={programme} className="mb-8">
          <SectionTitle aside={<OfferingTags offering={offerings[0]} />}>
            {programme} · {shiftLabel(shift)}
          </SectionTitle>
          <Card>
            <ul className="divide-y divide-slate-100">
              {offerings.map((o) => (
                <li key={o.offeringId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ku-navy-900">
                      <span className="text-ku-maroon-700">{o.courseCode}</span> {o.courseTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Semester {o.semester.number} · {o.semester.academicYear} · Section {o.section} · {shiftLabel(o.shift)} ·{" "}
                      {o.enrolledCount} students
                    </p>
                  </div>
                  <Link
                    to={`/faculty/offerings/${o.offeringId}/sessions/new`}
                    className={`${buttonStyles.primary} shrink-0`}
                    aria-label={`Take attendance for ${o.courseCode} ${o.courseTitle}, ${shiftLabel(o.shift)}`}
                  >
                    Take attendance
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </>
  );
}
