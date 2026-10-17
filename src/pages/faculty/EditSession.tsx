import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { AttendanceMark, SessionDetailResponse, UpdateSessionRequest } from "../../../shared/api";
import { AttendanceSheet, type Marks } from "../../components/AttendanceSheet";
import { BackLink, ErrorState, LoadingState, PageHeader, Pill, Spinner } from "../../components/ui";
import { buttonStyles, inputStyles } from "../../lib/styles";
import { apiRequest } from "../../lib/api";
import { formatDate, offeringContext, offeringLabel } from "../../lib/format";
import { useApi } from "../../lib/useApi";

export function EditSession() {
  const { sessionId } = useParams();
  const { data, error, loading, reload } = useApi<SessionDetailResponse>(`/faculty/sessions/${sessionId}`);
  // Lives here so it survives the form remounting with fresh data after a save.
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      {data ? (
        <BackLink to={`/faculty/offerings/${data.offering.offeringId}`}>Back to course</BackLink>
      ) : (
        <BackLink to="/faculty/courses">My Courses</BackLink>
      )}
      {loading && !data && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {/* key resets the form state when the session is reloaded after a save */}
      {data && (
        <EditSessionForm
          key={JSON.stringify(data)}
          data={data}
          notice={notice}
          onSaved={(text) => {
            setNotice(text);
            reload();
          }}
        />
      )}
    </>
  );
}

interface FormProps {
  data: SessionDetailResponse;
  notice: string | null;
  onSaved: (notice: string) => void;
}

function EditSessionForm({ data, notice, onSaved }: FormProps) {
  const navigate = useNavigate();
  const { offering, session, records } = data;
  const readOnly = offering.semester.status === "completed";
  const [topic, setTopic] = useState(session.topic ?? "");
  const [marks, setMarks] = useState<Marks>(() => Object.fromEntries(records.map((r) => [r.enrollmentId, r.status])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: UpdateSessionRequest | null, successText: string) {
    setBusy(true);
    setError(null);
    try {
      if (body) {
        await apiRequest(`/faculty/sessions/${session.id}`, { method: "PUT", body });
        onSaved(successText);
      } else {
        await apiRequest(`/faculty/sessions/${session.id}`, { method: "DELETE" });
        navigate(`/faculty/offerings/${offering.offeringId}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
      setBusy(false);
    }
  }

  function save() {
    const changed: AttendanceMark[] = [];
    for (const r of records) {
      const status = marks[r.enrollmentId];
      if (status && status !== r.status) changed.push({ enrollmentId: r.enrollmentId, status });
    }
    send({ topic: topic.trim() || null, records: changed }, "Attendance saved.");
  }

  function toggleCancelled() {
    send(
      { status: session.status === "held" ? "cancelled" : "held" },
      session.status === "held" ? "Class marked as cancelled." : "Class restored.",
    );
  }

  function remove() {
    if (window.confirm("Delete this class and all of its attendance marks? This cannot be undone.")) send(null, "");
  }

  return (
    <>
      <PageHeader
        title={formatDate(session.classDate)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {offeringLabel(offering)} · {offeringContext(offering)} · {session.startTime}
            {session.status === "cancelled" && <Pill className="bg-slate-100 text-slate-600">Cancelled</Pill>}
          </span>
        }
        actions={
          !readOnly && (
            <>
              <button type="button" disabled={busy} onClick={toggleCancelled} className={buttonStyles.secondary}>
                {session.status === "held" ? "Mark class cancelled" : "Restore class"}
              </button>
              <button type="button" disabled={busy} onClick={remove} className={buttonStyles.danger}>
                Delete
              </button>
            </>
          )
        }
      />

      {readOnly && (
        <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          This semester is completed, so this record is read-only.
        </p>
      )}
      {session.status === "cancelled" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This class is cancelled and does not count toward anyone’s attendance.
        </p>
      )}

      <div className="mb-6 max-w-md">
        <label htmlFor="topic" className="mb-1 block text-sm font-medium text-slate-700">
          Topic
        </label>
        <input id="topic" type="text" maxLength={200} disabled={readOnly} value={topic} onChange={(e) => setTopic(e.target.value)} className={inputStyles} />
      </div>

      <AttendanceSheet students={records} marks={marks} onChange={setMarks} readOnly={readOnly} />

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : (
        notice && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )
      )}
      {!readOnly && (
        <div className="mt-6 flex justify-end">
          <button type="button" disabled={busy} onClick={save} className={buttonStyles.primary}>
            {busy && <Spinner className="size-4 border-white/40 border-t-white" />}
            Save changes
          </button>
        </div>
      )}
    </>
  );
}
