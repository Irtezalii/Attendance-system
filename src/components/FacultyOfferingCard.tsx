import { Link } from "react-router";
import type { FacultyOffering } from "../../shared/api";
import { buttonStyles } from "../lib/styles";
import { Card, OfferingTags, PercentText } from "./ui";

// Coloured top edge per programme, matching the programme badge colours.
const PROGRAMME_ACCENT: Record<string, string> = {
  BSCS: "border-t-ku-maroon-700",
  BSSE: "border-t-ku-navy-700",
  BSAI: "border-t-ku-gold-500",
};

export function FacultyOfferingCard({ offering: o }: { offering: FacultyOffering }) {
  return (
    <Card className={`flex flex-col border-t-4 p-5 ${PROGRAMME_ACCENT[o.programme ?? ""] ?? "border-t-slate-300"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-ku-maroon-700">
          {o.courseCode} · Section {o.section}
        </p>
        <OfferingTags offering={o} />
      </div>
      <h3 className="mt-1 line-clamp-2 font-semibold text-ku-navy-900" title={o.courseTitle}>
        {o.courseTitle}
      </h3>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs text-slate-500">Students</dt>
          <dd className="font-semibold text-ku-navy-900">{o.enrolledCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Classes</dt>
          <dd className="font-semibold text-ku-navy-900">{o.sessionsHeld}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Average</dt>
          <dd className="font-semibold">
            {o.averagePercentage === null ? <span className="text-slate-400">—</span> : <PercentText value={o.averagePercentage} />}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex gap-2 pt-5">
        <Link to={`/faculty/offerings/${o.offeringId}`} className={`${buttonStyles.secondary} flex-1`}>
          View
        </Link>
        {o.semester.status !== "completed" && (
          <Link to={`/faculty/offerings/${o.offeringId}/sessions/new`} className={`${buttonStyles.primary} flex-1`}>
            Take attendance
          </Link>
        )}
      </div>
    </Card>
  );
}
