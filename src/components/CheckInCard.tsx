import { useState, type FormEvent } from "react";
import type { CheckInRequest, CheckInResponse } from "../../shared/api";
import { formatDayMonthYear, LOCATION_REQUIRED_DETAIL } from "../../shared/api";
import { ApiRequestError, apiRequest } from "../lib/api";
import { getLocation } from "../lib/geolocation";
import { buttonStyles, inputStyles } from "../lib/styles";
import { Card, Spinner } from "./ui";

/** Students enter the professor's 4-digit code to mark themselves present. */
export function CheckInCard({ onRecorded }: { onRecorded: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [step, setStep] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) {
      setResult({ ok: false, text: "Enter the 4-digit code from your professor." });
      return;
    }
    setBusy(true);
    setResult(null);
    setStep(null);
    const send = (body: CheckInRequest) => apiRequest<CheckInResponse>("/student/check-in", { body });
    try {
      let r: CheckInResponse;
      try {
        r = await send({ code });
      } catch (err) {
        // The class requires location: get it now and try again (one retry).
        if (!(err instanceof ApiRequestError && err.details?.[LOCATION_REQUIRED_DETAIL])) throw err;
        setStep("Checking your location…");
        const loc = await getLocation();
        if (!loc.ok) {
          // Tell the server we couldn't get a location, so the professor can see the attempt.
          await send({ code, location: null }).catch(() => undefined);
          throw new Error(`${loc.message} If it still doesn't work, ask your professor to mark you manually.`, { cause: err });
        }
        r = await send({ code, location: loc.point });
      }
      setResult({ ok: true, text: `Marked present for ${r.courseCode} ${r.courseTitle} · ${formatDayMonthYear(r.classDate)}, ${r.startTime}.` });
      setCode("");
      onRecorded();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Could not record attendance." });
    } finally {
      setStep(null);
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8 p-5">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="checkin-code" className="block font-medium text-ku-navy-900">
            Mark attendance
          </label>
          <p className="mb-2 text-sm text-slate-500">Enter the 4-digit code your professor shows in class.</p>
          <input
            id="checkin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
            className={`${inputStyles} max-w-40 text-center font-mono text-lg tracking-[0.4em]`}
          />
        </div>
        <button type="submit" disabled={busy || code.length !== 4} className={buttonStyles.primary}>
          {busy && <Spinner className="size-4 border-white/40 border-t-white" />}
          Submit code
        </button>
      </form>
      {step && (
        <p role="status" className="mt-3 text-sm text-slate-500">
          {step}
        </p>
      )}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {result.text}
        </p>
      )}
    </Card>
  );
}
