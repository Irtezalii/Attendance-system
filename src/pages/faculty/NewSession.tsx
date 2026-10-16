import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import type { AttendanceMark, CreateSessionRequest, FacultyOfferingDetailResponse } from "../../../shared/api";
import { AttendanceSheet, type Marks } from "../../components/AttendanceSheet";
import { BackLink, EmptyState, ErrorState, LoadingState, PageHeader, Spinner } from "../../components/ui";
import { buttonStyles, inputStyles } from "../../lib/styles";
import { apiRequest } from "../../lib/api";
import { nowTimeLocal, offeringLabel, semesterLabel, todayLocal } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function NewSession() {
  const { offeringId } = useParams();
  const { data, error, loading, reload } = useApi<FacultyOfferingDetailResponse>(`/faculty/offerings/${offeringId}`);

  return (
    <>
      <BackLink to={`/faculty/offerings/${offeringId}`}>Back to course</BackLink>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && <NewSessionForm data={data} />}
    </>
  );
}

function NewSessionForm({ data }: { data: FacultyOfferingDetailResponse }) {
  const navigate = useNavigate();
  const { offering, students } = data;
  const [classDate, setClassDate] = useState(todayLocal());
  const [startTime, setStartTime] = useState(nowTimeLocal());
  const [topic, setTopic] = useState("");
  const [marks, setMarks] = useState<Marks>(() => Object.fromEntries(students.map((s) => [s.enrollmentId, "present"])));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const header = (
    <PageHeader title="Take attendance" subtitle={`${offeringLabel(offering)} · ${semesterLabel(offering)}`} />
  );

  if (offering.semester.status === "completed") {
    return (
      <>
        {header}
        <EmptyState title="This semester is completed.">Attendance can no longer be recorded for it.</EmptyState>
      </>
    );
  }
  if (students.length === 0) {
    return (
      <>
        {header}
        <EmptyState title="No students are enrolled in this course yet." />
      </>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const records: AttendanceMark[] = [];
    for (const s of students) {
      const status = marks[s.enrollmentId];
      if (!status) {
        setError(`Mark ${s.name} as present or absent before saving.`);
        return;
      }
      records.push({ enrollmentId: s.enrollmentId, status });
    }
    setError(null);
    setSaving(true);
    try {
      const body: CreateSessionRequest = { classDate, startTime, topic: topic.trim() || undefined, records };
      await apiRequest(`/faculty/offerings/${offering.offeringId}/sessions`, { body });
      navigate(`/faculty/offerings/${offering.offeringId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {header}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="classDate" className="mb-1 block text-sm font-medium text-slate-700">
            Class date
          </label>
          <input id="classDate" type="date" required max={todayLocal()} value={classDate} onChange={(e) => setClassDate(e.target.value)} className={inputStyles} />
        </div>
        <div>
          <label htmlFor="startTime" className="mb-1 block text-sm font-medium text-slate-700">
            Start time
          </label>
          <input id="startTime" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputStyles} />
        </div>
        <div>
          <label htmlFor="topic" className="mb-1 block text-sm font-medium text-slate-700">
            Topic <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="topic" type="text" maxLength={200} value={topic} onChange={(e) => setTopic(e.target.value)} className={inputStyles} />
        </div>
      </div>

      <AttendanceSheet students={students} marks={marks} onChange={setMarks} />

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={() => navigate(-1)} className={buttonStyles.secondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={buttonStyles.primary}>
          {saving && <Spinner className="size-4 border-white/40 border-t-white" />}
          Save attendance
        </button>
      </div>
    </form>
  );
}
