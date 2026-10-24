import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import type {
  GeoRejectionReason,
  LiveCodeStatus,
  LiveSession as LiveSessionData,
  LiveStartRequest,
  LiveStateResponse,
} from "../../../shared/api";
import { formatDayMonthYear, liveMessages } from "../../../shared/api";
import {
  BackLink,
  Card,
  ErrorState,
  LoadingState,
  OfferingTags,
  PageHeader,
  Pill,
  Spinner,
} from "../../components/ui";
import { ApiRequestError, apiRequest } from "../../lib/api";
import { offeringContext, offeringLabel } from "../../lib/format";
import { buttonStyles, inputStyles, linkStyles } from "../../lib/styles";

type Command = { kind: "start" } | { kind: "extend"; code: string } | { kind: "stop"; code: string };

interface Message {
  id: number;
  from: "assistant" | "professor" | "error";
  lines: string[];
}

const HELP = [
  "Use one of these commands:",
  "Start — generate a new attendance code (e.g. Start)",
  "Extend-[Code] — add 5 minutes (e.g. Extend-4821)",
  "Deactivate-[Code] — stop the code now (e.g. Deactivate-4821)",
];

/** Parses a typed command. Returns an error explanation instead of guessing. */
function parseCommand(text: string): Command | { error: string[] } {
  const t = text.trim();
  if (/^(start|take new attendance)$/i.test(t)) return { kind: "start" };
  const extend = /^extend-(\d{4})$/i.exec(t);
  if (extend) return { kind: "extend", code: extend[1] };
  const stop = /^deactivate-(\d{4})$/i.exec(t);
  if (stop) return { kind: "stop", code: stop[1] };
  if (/^extend/i.test(t)) return { error: ["Extend needs the 4-digit code, written as Extend-[Code].", "Example: Extend-4821"] };
  if (/^deactivate/i.test(t)) return { error: ["Deactivate needs the 4-digit code, written as Deactivate-[Code].", "Example: Deactivate-4821"] };
  return { error: [`"${t}" is not a supported command.`, ...HELP] };
}

const commandText = (c: Command) => (c.kind === "start" ? "Start" : c.kind === "extend" ? `Extend-${c.code}` : `Deactivate-${c.code}`);

/** Clock time in the class timezone, so it matches the class date/time shown. */
function formatClock(ms: number, timeZone: string) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone });
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function LiveSession() {
  const { offeringId } = useParams();
  const base = `/faculty/offerings/${offeringId}/live`;
  const [live, setLive] = useState<LiveStateResponse | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [requireLocation, setRequireLocation] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // serverNow - Date.now() at the last response, so the countdown follows the server clock.
  const [offset, setOffset] = useState(0);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  // Last session the server reported as active, to announce its expiry once.
  const lastActive = useRef<{ sessionId: number; code: string } | null>(null);

  const say = useCallback((from: Message["from"], lines: string[]) => {
    setMessages((prev) => [...prev, { id: nextId.current++, from, lines }]);
  }, []);

  const apply = useCallback(
    (state: LiveStateResponse) => {
      const s = state.session;
      const prev = lastActive.current;
      if (prev && s?.sessionId === prev.sessionId && s.status === "expired") {
        say("assistant", [`Code ${prev.code} has expired and can no longer be used.`]);
      }
      lastActive.current = s && s.status === "active" ? { sessionId: s.sessionId, code: s.code } : null;
      setOffset(state.serverNow - Date.now());
      setLive(state);
      setNow(Date.now());
    },
    [say],
  );

  const load = useCallback(async () => {
    try {
      apply(await apiRequest<LiveStateResponse>(base));
      setLoadError(null);
    } catch (error) {
      setLoadError(error as Error);
    }
  }, [apply, base]);

  // Initial load: restore the real session from the server (a refresh never restarts a timer).
  useEffect(() => {
    let cancelled = false;
    apiRequest<LiveStateResponse>(base)
      .then((state) => {
        if (cancelled) return;
        apply(state);
        const s = state.session;
        const greeting = [`Attendance window for ${offeringLabel(state.offering)} (${offeringContext(state.offering)}).`];
        if (s && s.status === "active" && s.expiresAt > state.serverNow) {
          greeting.push(`Code ${s.code} is active and expires at ${formatClock(s.expiresAt - (state.serverNow - Date.now()), state.timeZone)}.`);
        } else {
          greeting.push("Click Take New Attendance to generate a code for today's class.");
        }
        setMessages([{ id: nextId.current++, from: "assistant", lines: greeting }]);
      })
      .catch((error: Error) => !cancelled && setLoadError(error));
    return () => {
      cancelled = true;
    };
  }, [apply, base]);

  // 1-second tick for the countdown.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const session = live?.session ?? null;
  const remaining = session ? session.expiresAt - (now + offset) : 0;
  const status: LiveCodeStatus | null = session
    ? session.status === "active" && remaining <= 0
      ? "expired"
      : session.status
    : null;
  const active = status === "active";

  // While active, refresh every 5 s to show new check-ins.
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  // When the countdown reaches zero, confirm with the server (apply() then announces it).
  const expiredSessionId = session && session.status === "active" && remaining <= 0 ? session.sessionId : null;
  useEffect(() => {
    if (expiredSessionId === null) return;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [expiredSessionId, load]);

  // Keep the newest message in view.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  async function run(command: Command) {
    if (busy) return; // double-click guard (the server also refuses duplicates)
    setBusy(true);
    say("professor", [commandText(command)]);
    try {
      if (command.kind === "start") {
        const body: LiveStartRequest = { requireLocation };
        const state = await apiRequest<LiveStateResponse>(`${base}/start`, { body });
        apply(state);
        say("assistant", liveMessages.started(state.session!.classDate, state.session!.code));
        const geo = state.session!.geo;
        if (geo) {
          say("assistant", [
            `Location check is on: students must check in from inside the ${geo.areaName} area (${geo.halfSizeM} m in every direction around ${geo.areaName}).`,
          ]);
        }
      } else if (command.kind === "extend") {
        apply(await apiRequest<LiveStateResponse>(`${base}/extend`, { body: { code: command.code } }));
        say("assistant", [liveMessages.extended]);
      } else {
        apply(await apiRequest<LiveStateResponse>(`${base}/stop`, { body: { code: command.code } }));
        say("assistant", [liveMessages.stopped(command.code)]);
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 0) {
        // Unknown outcome: never report success; show the server's actual state instead.
        say("error", ["Could not reach the server, so the result is unknown. The status panel has been refreshed."]);
        await load();
      } else {
        say("error", [error instanceof Error ? error.message : "Something went wrong."]);
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    const parsed = parseCommand(input);
    setInput("");
    if ("error" in parsed) {
      say("professor", [input.trim()]);
      say("error", parsed.error);
      return;
    }
    void run(parsed);
  }

  if (loadError && !live) return <ErrorState error={loadError} onRetry={load} />;
  if (!live) return <LoadingState label="Opening attendance window…" />;
  const { offering } = live;
  const readOnly = offering.semester.status === "completed";

  return (
    <>
      <BackLink to={`/faculty/take-attendance${offering.shift === "evening" ? "?shift=evening" : ""}`}>Take Attendance</BackLink>
      <PageHeader
        eyebrow="Attendance window"
        title={offeringLabel(offering)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <OfferingTags offering={offering} /> {offeringContext(offering)} · {offering.enrolledCount} students
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat */}
        <Card className="flex flex-col lg:col-span-2">
          <div ref={scroller} className="h-[22rem] space-y-3 overflow-y-auto p-4 sm:h-[26rem]" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "professor" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.from === "professor"
                      ? "rounded-br-sm bg-ku-maroon-700 text-white"
                      : m.from === "error"
                        ? "rounded-bl-sm border border-red-200 bg-red-50 text-red-800"
                        : "rounded-bl-sm bg-slate-100 text-ku-navy-900"
                  }`}
                >
                  {m.lines.map((line, i) => (
                    <p key={i} className={i > 0 ? "mt-1" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-slate-200 p-4">
            {readOnly ? (
              <p className="text-sm text-slate-500">This semester is completed, so attendance codes can no longer be issued.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {!active ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => run({ kind: "start" })} className={buttonStyles.primary}>
                      {busy && <Spinner className="size-4 border-white/40 border-t-white" />}
                      Take New Attendance
                    </button>
                    {/* Off by default: online / off-campus classes work without location. */}
                    <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={requireLocation}
                        disabled={busy}
                        onChange={(e) => setRequireLocation(e.target.checked)}
                        className="size-4 accent-ku-maroon-700"
                      />
                      Require location (students on campus)
                    </label>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={busy} onClick={() => run({ kind: "extend", code: session!.code })} className={buttonStyles.secondary}>
                      Extend +5 min
                    </button>
                    <button type="button" disabled={busy} onClick={() => run({ kind: "stop", code: session!.code })} className={buttonStyles.danger}>
                      Stop attendance
                    </button>
                  </>
                )}
              </div>
            )}
            <form onSubmit={submit} className="flex gap-2">
              <label htmlFor="command" className="sr-only">
                Command
              </label>
              <input
                id="command"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy || readOnly}
                placeholder="Or type: Start, Extend-1234, Deactivate-1234"
                autoComplete="off"
                className={inputStyles}
              />
              <button type="submit" disabled={busy || readOnly || !input.trim()} className={buttonStyles.secondary}>
                Send
              </button>
            </form>
          </div>
        </Card>

        {/* Status */}
        <StatusPanel session={session} status={status} remaining={remaining} offset={offset} offeringId={offering.offeringId} timeZone={live.timeZone} />
      </div>
    </>
  );
}

function rejectionLabel(reason: GeoRejectionReason, distanceM: number | null, accuracyM: number | null): string {
  if (reason === "out_of_range") return `${distanceM} m outside the area`;
  if (reason === "imprecise") return `GPS too imprecise (±${accuracyM} m)`;
  return "No location shared";
}

const STATUS_PILL: Record<LiveCodeStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  expired: { label: "Expired", className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" },
  deactivated: { label: "Deactivated", className: "bg-slate-100 text-slate-600" },
};

function StatusPanel({
  session,
  status,
  remaining,
  offset,
  offeringId,
  timeZone,
}: {
  timeZone: string;
  session: LiveSessionData | null;
  status: LiveCodeStatus | null;
  remaining: number;
  offset: number;
  offeringId: number;
}) {
  if (!session || !status) {
    return (
      <Card className="p-5">
        <p className="text-sm font-medium text-slate-500">No code yet</p>
        <p className="mt-2 text-sm text-slate-500">
          Start a code and show it to the class. Students enter it on their dashboard to mark themselves present; everyone
          else stays Absent.
        </p>
        <Link to={`/faculty/offerings/${offeringId}/sessions/new`} className={`${linkStyles} mt-4 inline-block text-sm`}>
          Mark attendance manually instead →
        </Link>
      </Card>
    );
  }
  const pill = STATUS_PILL[status];
  const active = status === "active";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Code</p>
        <Pill className={pill.className}>{pill.label}</Pill>
      </div>
      <p className={`mt-2 font-mono text-5xl font-semibold tracking-[0.3em] ${active ? "text-ku-maroon-700" : "text-slate-300 line-through"}`}>
        {session.code}
      </p>
      {active ? (
        <div className="mt-3">
          <p className="font-mono text-2xl font-semibold text-ku-navy-900" aria-live="off">
            {formatRemaining(remaining)}
          </p>
          <p className="text-xs text-slate-500">Expires at {formatClock(session.expiresAt - offset, timeZone)}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          {status === "deactivated" && session.stoppedAt
            ? `Deactivated at ${formatClock(session.stoppedAt - offset, timeZone)}`
            : `Expired at ${formatClock(session.expiresAt - offset, timeZone)}`}
        </p>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          <span className="text-2xl font-semibold text-emerald-700">{session.presentCount}</span> / {session.enrolledCount} present
        </p>
        {session.checkIns.length > 0 ? (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {session.checkIns.map((c) => (
              <li key={c.rollNumber} className="flex justify-between gap-2">
                <span className="truncate text-ku-navy-900">{c.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {c.distanceM !== null && "on campus · "}
                  {formatClock(c.at - offset, timeZone)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">No check-ins yet.</p>
        )}
      </div>

      {session.geo && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Location check</p>
          <p className="mt-1 text-sm text-slate-600">
            Students must be inside the {session.geo.areaName} area ({session.geo.halfSizeM} m each way)
          </p>
          {session.rejections.length > 0 && (
            <>
              <p className="mt-3 text-sm font-medium text-amber-800">Not accepted ({session.rejections.length})</p>
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-sm">
                {session.rejections.map((r) => (
                  <li key={r.rollNumber} className="flex justify-between gap-2">
                    <span className="truncate text-ku-navy-900">{r.name}</span>
                    <span className="shrink-0 text-xs text-amber-800">{rejectionLabel(r.reason, r.distanceM, r.accuracyM)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">If a student is genuinely in class, mark them present under “Review or correct marks”.</p>
            </>
          )}
        </div>
      )}

      <div className="mt-5 space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <p>
          Class: {formatDayMonthYear(session.classDate)} · {session.startTime}
        </p>
        <p className="font-mono break-all">{session.identifier}</p>
        <Link to={`/faculty/sessions/${session.sessionId}`} className={`${linkStyles} inline-block pt-2 text-sm`}>
          Review or correct marks →
        </Link>
      </div>
    </Card>
  );
}
