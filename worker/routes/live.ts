import { Hono, type Context } from "hono";
import { z } from "zod";
import type { FacultyOffering, LiveCodeStatus, LiveStateResponse } from "../../shared/api";
import { classIdentifier, LIVE_CODE_MINUTES, LIVE_EXTEND_MINUTES, liveMessages } from "../../shared/api";
import type { AppEnv } from "../lib/auth";
import { HttpError, idParam, isUniqueViolation, parseBody } from "../lib/http";
import { assertEditable, requireOwnedOffering } from "../lib/ownership";
import { localNow } from "../lib/time";

// Live attendance codes for one course offering. Mounted inside facultyRoutes, so
// requireAuth("faculty") has already run; every handler also checks the offering is the
// caller's own. Validity is decided from stored server timestamps on every request.

const MINUTE = 60_000;
const codeSchema = z.object({ code: z.string().regex(/^\d{4}$/, "Codes are 4 digits, e.g. 4821.") });

function generateCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 10_000).padStart(4, "0");
}

/** Marks overdue 'active' codes as expired (validity never depends on this having run). */
function expireStale(db: D1Database, now: number) {
  return db
    .prepare("UPDATE attendance_sessions SET code_status = 'expired' WHERE code_status = 'active' AND code_expires_at <= ?")
    .bind(now);
}

interface SessionRow {
  id: number;
  code: string;
  code_status: LiveCodeStatus;
  class_date: string;
  start_time: string;
  code_started_at: number;
  code_expires_at: number;
  code_stopped_at: number | null;
}

async function loadState(c: Context<AppEnv>, offering: FacultyOffering): Promise<LiveStateResponse> {
  const db = c.env.DB;
  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT id, code, code_status, class_date, start_time, code_started_at, code_expires_at, code_stopped_at
         FROM attendance_sessions
        WHERE offering_id = ? AND code IS NOT NULL
        ORDER BY code_started_at DESC LIMIT 1`,
    )
    .bind(offering.offeringId)
    .first<SessionRow>();
  const timeZone = c.env.APP_TIMEZONE;
  if (!row) return { offering, serverNow: now, timeZone, session: null };

  const [counts, checkIns] = await db.batch([
    db
      .prepare("SELECT COUNT(*) AS enrolled, COUNT(CASE WHEN status = 'present' THEN 1 END) AS present FROM attendance_records WHERE session_id = ?")
      .bind(row.id),
    db
      .prepare(
        `SELECT st.roll_number, st.name, r.checked_in_at
           FROM attendance_records r
           JOIN enrollments e ON e.id = r.enrollment_id
           JOIN students st ON st.id = e.student_id
          WHERE r.session_id = ? AND r.checked_in_at IS NOT NULL
          ORDER BY r.checked_in_at DESC`,
      )
      .bind(row.id),
  ]);
  const count = counts.results[0] as { enrolled: number; present: number };
  const status: LiveCodeStatus = row.code_status === "active" && row.code_expires_at <= now ? "expired" : row.code_status;

  return {
    offering,
    serverNow: now,
    timeZone,
    session: {
      sessionId: row.id,
      code: row.code,
      status,
      classDate: row.class_date,
      startTime: row.start_time,
      startedAt: row.code_started_at,
      expiresAt: row.code_expires_at,
      stoppedAt: row.code_stopped_at,
      identifier: classIdentifier(offering, row.class_date),
      presentCount: count.present,
      enrolledCount: count.enrolled,
      checkIns: (checkIns.results as { roll_number: string; name: string; checked_in_at: number }[]).map((r) => ({
        rollNumber: r.roll_number,
        name: r.name,
        at: r.checked_in_at,
      })),
    },
  };
}

export const liveRoutes = new Hono<AppEnv>()
  .get("/offerings/:offeringId/live", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    return c.json(await loadState(c, offering));
  })

  // START: creates today's class for this offering (everyone Absent) with a fresh code.
  .post("/offerings/:offeringId/live/start", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    assertEditable(offering);
    if (offering.enrolledCount === 0) throw new HttpError(400, "No students are enrolled in this course yet.");
    const db = c.env.DB;
    const now = Date.now();
    await expireStale(db, now).run();

    const active = await db
      .prepare("SELECT code FROM attendance_sessions WHERE offering_id = ? AND code_status = 'active'")
      .bind(offering.offeringId)
      .first<{ code: string }>();
    if (active) throw new HttpError(409, `Code ${active.code} is still active for this class. Stop it before starting a new one.`);

    // A class is unique per (offering, date, HH:MM); if this minute is taken (e.g. a code was
    // stopped and restarted), the class is labelled with the next free minute.
    let minuteOffset = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { date, time } = localNow(c.env.APP_TIMEZONE, new Date(now + minuteOffset * MINUTE));
      const code = generateCode();
      try {
        // One transaction: the class, its code, and an Absent mark for every enrolled student.
        await db.batch([
          db
            .prepare(
              `INSERT INTO attendance_sessions
                 (offering_id, class_date, start_time, topic, status, code, code_status, code_started_at, code_expires_at, started_by_user_id)
               VALUES (?, ?, ?, NULL, 'held', ?, 'active', ?, ?, ?)`,
            )
            .bind(offering.offeringId, date, time, code, now, now + LIVE_CODE_MINUTES * MINUTE, c.get("auth").userId),
          db
            .prepare(
              `INSERT INTO attendance_records (session_id, enrollment_id, status)
                 SELECT a.id, e.id, 'absent'
                   FROM attendance_sessions a
                   JOIN enrollments e ON e.offering_id = a.offering_id AND e.status = 'enrolled'
                  WHERE a.offering_id = ? AND a.code = ? AND a.code_status = 'active'`,
            )
            .bind(offering.offeringId, code),
        ]);
        return c.json(await loadState(c, offering), 201);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const message = (error as Error).message;
        if (message.includes("class_date")) {
          minuteOffset++;
          continue;
        }
        if (message.includes("attendance_sessions.offering_id")) {
          throw new HttpError(409, "A code is already active for this class.");
        }
        // Another class holds the same active code: pick a new one.
      }
    }
    throw new HttpError(409, "Could not generate a free code. Please try again.");
  })

  // EXTEND: adds 5 minutes to the existing expiry of this class's active code.
  .post("/offerings/:offeringId/live/extend", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    assertEditable(offering);
    const { code } = await parseBody(c, codeSchema);
    const now = Date.now();
    const updated = await c.env.DB.prepare(
      `UPDATE attendance_sessions SET code_expires_at = code_expires_at + ?
        WHERE offering_id = ? AND code = ? AND code_status = 'active' AND code_expires_at > ?
        RETURNING id`,
    )
      .bind(LIVE_EXTEND_MINUTES * MINUTE, offering.offeringId, code, now)
      .first();
    if (!updated) throw new HttpError(409, liveMessages.notActive(code));
    return c.json(await loadState(c, offering));
  })

  // STOP: deactivates this class's active code immediately. Saved marks are kept.
  .post("/offerings/:offeringId/live/stop", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    assertEditable(offering);
    const { code } = await parseBody(c, codeSchema);
    const now = Date.now();
    const updated = await c.env.DB.prepare(
      `UPDATE attendance_sessions SET code_status = 'deactivated', code_stopped_at = ?
        WHERE offering_id = ? AND code = ? AND code_status = 'active' AND code_expires_at > ?
        RETURNING id`,
    )
      .bind(now, offering.offeringId, code, now)
      .first();
    if (!updated) throw new HttpError(409, liveMessages.notActive(code));
    return c.json(await loadState(c, offering));
  });
