import { ProfileCard } from "../../components/ProfileCard";
import { SignOutButton } from "../../components/SignOutButton";
import { PageHeader, ProgrammeBadge } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { shiftLabel } from "../../lib/format";

export function StudentProfile() {
  const { me } = useAuth();
  if (!me || me.profile.kind !== "student") return null;
  const p = me.profile;

  return (
    <>
      <div className="max-w-3xl">
        <PageHeader title="My Profile" actions={<SignOutButton />} />
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
            { label: "Schedule", value: shiftLabel(p.shift) },
            { label: "Email", value: p.email },
          ]}
        />
      </div>
    </>
  );
}
