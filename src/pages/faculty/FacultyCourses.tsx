import { useSearchParams } from "react-router";
import type { FacultyOffering, FacultyOfferingsResponse } from "../../../shared/api";
import { FacultyOfferingCard } from "../../components/FacultyOfferingCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionTitle,
  SegmentedControl,
  SemesterStatusPill,
} from "../../components/ui";
import { groupBySemester } from "../../lib/format";
import { useApi } from "../../lib/useApi";

type ShiftFilter = "all" | "morning" | "evening";
const PROGRAMME_ORDER = ["BSCS", "BSSE", "BSAI"];

export function FacultyCourses() {
  const { data, error, loading, reload } = useApi<FacultyOfferingsResponse>("/faculty/offerings");
  const [params, setParams] = useSearchParams();
  const all = data?.offerings ?? [];

  // Filters live in the URL (?programme=BSSE&shift=evening) so refresh/back keep them.
  const shiftParam = params.get("shift");
  const shift: ShiftFilter = shiftParam === "morning" || shiftParam === "evening" ? shiftParam : "all";
  const programmes = [...new Set(all.map((o) => o.programme ?? "Other"))].sort(
    (a, b) => (PROGRAMME_ORDER.indexOf(a) + 1 || 99) - (PROGRAMME_ORDER.indexOf(b) + 1 || 99),
  );
  const programmeParam = params.get("programme");
  const programme = programmeParam && programmes.includes(programmeParam) ? programmeParam : "all";

  const matchesShift = (o: FacultyOffering) => shift === "all" || o.shift === shift;
  const matchesProgramme = (o: FacultyOffering) => programme === "all" || (o.programme ?? "Other") === programme;
  const visible = all.filter((o) => matchesShift(o) && matchesProgramme(o));

  function setFilter(key: "shift" | "programme", value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader title="My Courses" subtitle="Course offerings assigned to you, grouped by semester." />
      {loading && <LoadingState label="Loading your courses…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && all.length === 0 && (
        <EmptyState title="No courses are assigned to you yet.">Contact the department office to have courses assigned.</EmptyState>
      )}

      {all.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {programmes.length > 1 && (
            <SegmentedControl
              label="Programme"
              value={programme}
              options={[
                { value: "all", label: "All programmes", count: all.filter(matchesShift).length },
                ...programmes.map((p) => ({ value: p, label: p, count: all.filter((o) => matchesShift(o) && (o.programme ?? "Other") === p).length })),
              ]}
              onChange={(v) => setFilter("programme", v)}
            />
          )}
          <SegmentedControl<ShiftFilter>
            label="Schedule"
            value={shift}
            options={[
              { value: "all", label: "All", count: all.filter(matchesProgramme).length },
              { value: "morning", label: "Morning", count: all.filter((o) => matchesProgramme(o) && o.shift === "morning").length },
              { value: "evening", label: "Evening", count: all.filter((o) => matchesProgramme(o) && o.shift === "evening").length },
            ]}
            onChange={(v) => setFilter("shift", v)}
          />
        </div>
      )}

      {data && all.length > 0 && visible.length === 0 && <EmptyState title="No courses match these filters." />}
      {groupBySemester(visible).map((group) => (
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
