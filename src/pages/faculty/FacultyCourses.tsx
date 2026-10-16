import type { FacultyOfferingsResponse } from "../../../shared/api";
import { FacultyOfferingCard } from "../../components/FacultyOfferingCard";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, SemesterStatusPill } from "../../components/ui";
import { groupBySemester } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function FacultyCourses() {
  const { data, error, loading, reload } = useApi<FacultyOfferingsResponse>("/faculty/offerings");

  return (
    <>
      <PageHeader title="My Courses" subtitle="Course offerings assigned to you, grouped by semester." />
      {loading && <LoadingState label="Loading your courses…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.offerings.length === 0 && (
        <EmptyState title="No courses are assigned to you yet.">Contact the department office to have courses assigned.</EmptyState>
      )}
      {data &&
        groupBySemester(data.offerings).map((group) => (
          <section key={group.label} className="mb-10">
            <SectionTitle aside={<SemesterStatusPill status={group.status} />}>{group.label}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((o) => (
                <FacultyOfferingCard key={o.offeringId} offering={o} />
              ))}
            </div>
          </section>
        ))}
    </>
  );
}
