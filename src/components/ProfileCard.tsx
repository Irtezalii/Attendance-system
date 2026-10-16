import type { ReactNode } from "react";
import { branding } from "../lib/branding";
import { Card } from "./ui";

export interface ProfileField {
  label: string;
  value: ReactNode | null | undefined;
}

/** Read-only profile details. Empty fields are shown as "Not provided". */
export function ProfileCard({ name, subtitle, fields }: { name: string; subtitle: ReactNode; fields: ProfileField[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-ku-maroon-50 px-5 py-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ku-maroon-700 font-serif text-xl font-semibold text-white" aria-hidden>
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-xl font-semibold text-ku-navy-900">{name}</p>
          <div className="text-sm text-slate-600">{subtitle}</div>
        </div>
      </div>
      <dl className="divide-y divide-slate-100">
        {fields.map((f) => (
          <div key={f.label} className="grid gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-slate-500">{f.label}</dt>
            <dd className="text-sm break-words text-slate-900 sm:col-span-2">
              {f.value === null || f.value === undefined || f.value === "" ? <span className="text-slate-400">Not provided</span> : f.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        {branding.universityName} · {branding.instituteShort} · {branding.departmentName}. To correct these details, contact the
        department office.
      </p>
    </Card>
  );
}

function initials(name: string): string {
  const words = name.replace(/\b(Prof|Dr|Mr|Ms|Mrs|Engr|Professor)\.?\s+/gi, "").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "");
}
