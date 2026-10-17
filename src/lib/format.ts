import type { OfferingInfo } from "../../shared/api";

/** Minimum attendance colleges commonly require. Used only for colour coding. */
export const ATTENDANCE_THRESHOLD = 75;

export function formatPercentage(value: number | null): string {
  return value === null ? "No attendance recorded" : `${value}%`;
}

export type Tone = "good" | "warning" | "danger" | "neutral";

export function attendanceTone(value: number | null): Tone {
  if (value === null) return "neutral";
  if (value >= ATTENDANCE_THRESHOLD) return "good";
  if (value >= 60) return "warning";
  return "danger";
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function semesterLabel(o: OfferingInfo): string {
  return `Semester ${o.semester.number} · ${o.semester.academicYear}`;
}

export function shiftLabel(shift: OfferingInfo["shift"]): string {
  return shift === "evening" ? "Evening" : "Morning";
}

/** e.g. "BSCS · Evening · Semester 3 · 2026-2027" — identifies the exact class. */
export function offeringContext(o: OfferingInfo): string {
  return [o.programme, shiftLabel(o.shift), semesterLabel(o)].filter(Boolean).join(" · ");
}

export function offeringLabel(o: OfferingInfo): string {
  return `${o.courseCode} ${o.courseTitle}${o.section !== "A" ? ` (Section ${o.section})` : ""}`;
}

/** Groups offerings by semester, preserving the server's newest-first order. */
export function groupBySemester<T extends OfferingInfo>(items: T[]): { label: string; status: string; items: T[] }[] {
  const groups: { label: string; status: string; items: T[] }[] = [];
  for (const item of items) {
    const label = semesterLabel(item);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, status: item.semester.status, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowTimeLocal(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${d.getMinutes() < 30 ? "00" : "30"}`;
}
