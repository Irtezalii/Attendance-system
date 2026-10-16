import { ProfileCard } from "../../components/ProfileCard";
import { PageHeader, ProgrammeBadge } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export function StudentProfile() {
  const { me } = useAuth();
  if (!me || me.profile.kind !== "student") return null;
  const p = me.profile;

  return (
    <>
      <PageHeader title="My Profile" />
      <div className="max-w-3xl">
        <ProfileCard
          name={p.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <ProgrammeBadge code={p.programme.code} /> Student
            </span>
          }
          fields={[
            { label: "Roll number", value: p.rollNumber },
            { label: "Programme", value: `${p.programme.name} (${p.programme.code})` },
            { label: "Current semester", value: `Semester ${p.currentSemester} of ${p.programme.semesterCount}` },
            { label: "Email", value: p.email },
          ]}
        />
      </div>
    </>
  );
}
