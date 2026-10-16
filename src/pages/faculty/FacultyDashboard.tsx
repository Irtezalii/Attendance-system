import { Link } from "react-router";
import type { FacultyOfferingsResponse } from "../../../shared/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, PercentText, SemesterStatusPill } from "../../components/ui";
import { buttonStyles } from "../../lib/styles";
import { useAuth } from "../../lib/auth";
import { groupBySemester } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function FacultyDashboard() {
  const { me } = useAuth();
  const { data, error, loading, reload } = useApi<FacultyOfferingsResponse>("/faculty/offerings");
  if (!me || me.profile.kind !== "faculty") return null;
  const profile = me.profile;

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.name}`}
        subtitle={`${profile.designation} · Employee ID ${profile.employeeId} · ${profile.email}`}
      />

      {loading && <LoadingState label="Loading your courses…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.offerings.length === 0 && (
        <EmptyState title="No courses are assigned to you yet.">
          Contact the administration office to have courses assigned.
        </EmptyState>
      )}

      {data &&
        groupBySemester(data.offerings).map((group) => (
          <section key={group.label} className="mb-10">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{group.label}</h2>
              <SemesterStatusPill status={group.status} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((o) => (
                <Card key={o.offeringId} className="flex flex-col p-5">
                  <p className="text-xs font-medium text-indigo-600">
                    {o.courseCode} · Section {o.section}
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-900">{o.courseTitle}</h3>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dt className="text-xs text-slate-500">Students</dt>
                      <dd className="font-semibold text-slate-900">{o.enrolledCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Classes</dt>
                      <dd className="font-semibold text-slate-900">{o.sessionsHeld}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Average</dt>
                      <dd className="font-semibold">
                        {o.averagePercentage === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <PercentText value={o.averagePercentage} />
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex gap-2 pt-1">
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
              ))}
            </div>
          </section>
        ))}
    </>
  );
}
