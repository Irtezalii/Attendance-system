import { Link } from "react-router";
import type { FacultyOfferingsResponse, RecentSessionsResponse } from "../../../shared/api";
import { RecentSessionsTable } from "../../components/RecentSessionsTable";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PercentText,
  SectionTitle,
  StatCard,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { offeringLabel, semesterLabel } from "../../lib/format";
import { buttonStyles, linkStyles } from "../../lib/styles";
import { useApi } from "../../lib/useApi";

export function FacultyDashboard() {
  const { me } = useAuth();
  const offerings = useApi<FacultyOfferingsResponse>("/faculty/offerings");
  const sessions = useApi<RecentSessionsResponse>("/faculty/sessions");
  if (!me || me.profile.kind !== "faculty") return null;
  const profile = me.profile;

  const active = (offerings.data?.offerings ?? []).filter((o) => o.semester.status === "active");
  const students = active.reduce((sum, o) => sum + o.enrolledCount, 0);
  const classes = active.reduce((sum, o) => sum + o.sessionsHeld, 0);
  const withData = active.filter((o) => o.averagePercentage !== null);
  const average = withData.length
    ? Math.round((withData.reduce((sum, o) => sum + (o.averagePercentage ?? 0), 0) / withData.length) * 100) / 100
    : null;

  return (
    <>
      <PageHeader
        eyebrow={profile.department}
        title={`Welcome, ${profile.name}`}
        subtitle={[profile.designation, profile.employeeId && `Employee ID ${profile.employeeId}`].filter(Boolean).join(" · ")}
        actions={
          <Link to="/faculty/take-attendance" className={buttonStyles.primary}>
            Take attendance
          </Link>
        }
      />

      {offerings.loading && <LoadingState label="Loading your courses…" />}
      {offerings.error && <ErrorState error={offerings.error} onRetry={offerings.reload} />}

      {offerings.data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active courses" value={active.length} />
            <StatCard label="Students" value={students} hint="Across active courses" />
            <StatCard label="Classes held" value={classes} hint="This semester" />
            <StatCard
              label="Average attendance"
              value={<PercentText value={average} className={average === null ? "text-base" : ""} />}
              hint="Mean of course averages"
            />
          </div>

          <section className="mb-10">
            <SectionTitle aside={<Link to="/faculty/courses" className={`${linkStyles} ml-auto text-sm`}>All courses →</Link>}>
              {active[0] ? `Teaching now · ${semesterLabel(active[0]).replace(/^Semester \d+ · /, "")}` : "Teaching now"}
            </SectionTitle>
            {active.length === 0 ? (
              <EmptyState title="You have no courses in an active semester.">
                Past courses are listed under <Link to="/faculty/courses" className={linkStyles}>My Courses</Link>.
              </EmptyState>
            ) : (
              <Card>
                <ul className="divide-y divide-slate-100">
                  {active.map((o) => (
                    <li key={o.offeringId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link to={`/faculty/offerings/${o.offeringId}`} className="font-medium text-ku-navy-900 hover:text-ku-maroon-700">
                          {offeringLabel(o)}
                        </Link>
                        <p className="text-xs text-slate-500">
                          Semester {o.semester.number} · {o.enrolledCount} students · {o.sessionsHeld} classes ·{" "}
                          <PercentText value={o.averagePercentage} />
                        </p>
                      </div>
                      <Link to={`/faculty/offerings/${o.offeringId}/sessions/new`} className={`${buttonStyles.secondary} shrink-0`}>
                        Take attendance
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section>
            <SectionTitle aside={<Link to="/faculty/records" className={`${linkStyles} ml-auto text-sm`}>All records →</Link>}>
              Recent classes
            </SectionTitle>
            {sessions.loading && <LoadingState />}
            {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.reload} />}
            {sessions.data && sessions.data.sessions.length === 0 && <EmptyState title="No classes recorded yet." />}
            {sessions.data && sessions.data.sessions.length > 0 && <RecentSessionsTable sessions={sessions.data.sessions.slice(0, 6)} />}
          </section>
        </>
      )}
    </>
  );
}
