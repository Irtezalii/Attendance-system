import type { FacultyCategory } from "../../../shared/api";
import { ProfileCard } from "../../components/ProfileCard";
import { PageHeader } from "../../components/ui";
import { useAuth } from "../../lib/auth";

const CATEGORY_LABELS: Record<FacultyCategory, string> = {
  full_time: "Full-time faculty",
  teaching_associate: "Teaching Associate / Teaching Assistant",
  visiting: "Visiting faculty",
  inter_departmental: "Inter-departmental faculty",
  compulsory_subjects: "Compulsory subjects",
  test_account: "Development test account",
};

export function FacultyProfile() {
  const { me } = useAuth();
  if (!me || me.profile.kind !== "faculty") return null;
  const p = me.profile;

  return (
    <>
      <PageHeader title="My Profile" />
      <div className="max-w-3xl">
        <ProfileCard
          name={p.name}
          subtitle={[p.designation, p.department].filter(Boolean).join(" · ")}
          fields={[
            { label: "Designation", value: p.designation },
            { label: "Department", value: p.department },
            { label: "Faculty category", value: CATEGORY_LABELS[p.category] },
            { label: "Employee ID", value: p.employeeId },
            { label: "Sign-in email", value: p.email },
            ...(p.officialEmail ? [{ label: "Directory email", value: p.officialEmail }] : []),
            { label: "Qualifications", value: p.qualifications },
            { label: "Research interests", value: p.researchInterests },
          ]}
        />
      </div>
    </>
  );
}
