import { Hono, type Context } from "hono";
import { z } from "zod";
import type {
  AttendanceStatus,
  FacultyOfferingDetailResponse,
  FacultyOfferingsResponse,
  OfferingStudent,
  RecentSessionsResponse,
  SessionDetailResponse,
  SessionStatus,
  StudentInOfferingResponse,
} from "../../shared/api";
import { summarize } from "../../shared/api";
import { requireAuth, type AppEnv } from "../lib/auth";
import { HttpError, idParam, isUniqueViolation, parseBody } from "../lib/http";
import { assertEditable, requireOwnedOffering } from "../lib/ownership";
import { liveRoutes } from "./live";
import {
  listFacultyOfferings,
  OFFERING_COLUMNS,
  OFFERING_JOINS,
  toOfferingInfo,
  type OfferingRow,
} from "../lib/queries";

// ---- Validation ----

const DAY_MS = 24 * 60 * 60 * 1000;

const classDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Enter a real calendar date.")
  // One day of slack so professors ahead of UTC can mark today's class.
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now() + DAY_MS, "Class date cannot be in the future.");

const startTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format HH:MM.");
const topicSchema = z.string().trim().max(200, "Topic must be 200 characters or fewer.");

const marksSchema = z
  .array(z.object({ enrollmentId: z.number().int().positive(), status: z.enum(["present", "absent"]) }))
  .max(1000)
  .refine((marks) => new Set(marks.map((m) => m.enrollmentId)).size === marks.length, "Each student can only be marked once.");

const createSessionSchema = z.object({
  classDate: classDateSchema,
  startTime: startTimeSchema,
  topic: topicSchema.optional(),
  records: marksSchema,
});

const updateSessionSchema = z
  .object({
    topic: topicSchema.nullable().optional(),
    status: z.enum(["held", "cancelled"]).optional(),
    records: marksSchema.optional(),
  })
  .refine((v) => v.topic !== undefined || v.status !== undefined || v.records !== undefined, "Nothing to update.");

// ---- Helpers ----


interface SessionRow {
  id: number;
  offering_id: number;
  class_date: string;
  start_time: string;
  topic: string | null;
  status: SessionStatus;
}

/** Loads a session only if its offering is assigned to the signed-in professor. */
async function requireOwnedSession(c: Context<AppEnv>, sessionId: number) {
  const session = await c.env.DB.prepare(
    `SELECT a.id, a.offering_id, a.class_date, a.start_time, a.topic, a.status
       FROM attendance_sessions a
       JOIN course_offerings co ON co.id = a.offering_id
      WHERE a.id = ? AND co.faculty_id = ?`,
  )
    .bind(sessionId, c.get("auth").profileId)
    .first<SessionRow>();
  if (!session) throw new HttpError(404, "Class session not found.");
  const offering = await requireOwnedOffering(c, session.offering_id);
  return { session, offering };
}

/** Students currently enrolled (not dropped); only they can be marked. */
async function enrollmentIds(db: D1Database, offeringId: number): Promise<Set<number>> {
  const { results } = await db
    .prepare("SELECT id FROM enrollments WHERE offering_id = ? AND status = 'enrolled'")
    .bind(offeringId)
    .all<{ id: number }>();
  return new Set(results.map((r) => r.id));
}

interface StudentSummaryRow {
  enrollment_id: number;
  roll_number: string;
  name: string;
  held: number;
  attended: number;
}

const STUDENT_SUMMARY_SQL = `
  SELECT e.id AS enrollment_id, st.roll_number, st.name,
    COUNT(CASE WHEN a.status = 'held' THEN 1 END) AS held,
    COUNT(CASE WHEN a.status = 'held' AND r.status = 'present' THEN 1 END) AS attended
  FROM enrollments e
  JOIN students st ON st.id = e.student_id
  LEFT JOIN attendance_records r ON r.enrollment_id = e.id
  LEFT JOIN attendance_sessions a ON a.id = r.session_id
  WHERE e.offering_id = ?`;

function toOfferingStudent(row: StudentSummaryRow): OfferingStudent {
  return {
    enrollmentId: row.enrollment_id,
    rollNumber: row.roll_number,
    name: row.name,
    summary: summarize(row.held, row.attended),
  };
}

const upsertRecordSql = `
  INSERT INTO attendance_records (session_id, enrollment_id, status) VALUES (?, ?, ?)
  ON CONFLICT (session_id, enrollment_id) DO UPDATE SET status = excluded.status, marked_at = datetime('now')`;

// ---- Routes ----

export const facultyRoutes = new Hono<AppEnv>()
  .use(requireAuth("faculty"))
  .get("/offerings", async (c) => {
    const body: FacultyOfferingsResponse = {
      offerings: await listFacultyOfferings(c.env.DB, c.get("auth").profileId),
    };
    return c.json(body);
  })
  .get("/sessions", async (c) => {
    // Most recent classes across all of this professor's offerings.
    const { results } = await c.env.DB.prepare(
      `SELECT ${OFFERING_COLUMNS},
         a.id, a.class_date, a.start_time, a.topic, a.status,
         COUNT(CASE WHEN r.status = 'present' THEN 1 END) AS present,
         COUNT(CASE WHEN r.status = 'absent' THEN 1 END) AS absent
       FROM attendance_sessions a
       JOIN course_offerings co ON co.id = a.offering_id
       ${OFFERING_JOINS}
       LEFT JOIN attendance_records r ON r.session_id = a.id
       WHERE co.faculty_id = ?
       GROUP BY a.id
       ORDER BY a.class_date DESC, a.start_time DESC
       LIMIT 200`,
    )
      .bind(c.get("auth").profileId)
      .all<OfferingRow & SessionRow & { present: number; absent: number }>();
    const body: RecentSessionsResponse = {
      sessions: results.map((s) => ({
        id: s.id,
        classDate: s.class_date,
        startTime: s.start_time,
        topic: s.topic,
        status: s.status,
        present: s.present,
        absent: s.absent,
        offering: toOfferingInfo(s),
      })),
    };
    return c.json(body);
  })
  .get("/offerings/:offeringId", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    const db = c.env.DB;
    const [students, sessions] = await db.batch([
      db
        .prepare(`${STUDENT_SUMMARY_SQL} AND e.status = 'enrolled' GROUP BY e.id ORDER BY st.roll_number`)
        .bind(offering.offeringId),
      db
        .prepare(
          `SELECT a.id, a.class_date, a.start_time, a.topic, a.status,
             COUNT(CASE WHEN r.status = 'present' THEN 1 END) AS present,
             COUNT(CASE WHEN r.status = 'absent' THEN 1 END) AS absent
           FROM attendance_sessions a
           LEFT JOIN attendance_records r ON r.session_id = a.id
           WHERE a.offering_id = ?
           GROUP BY a.id
           ORDER BY a.class_date DESC, a.start_time DESC`,
        )
        .bind(offering.offeringId),
    ]);

    const body: FacultyOfferingDetailResponse = {
      offering,
      students: (students.results as StudentSummaryRow[]).map(toOfferingStudent),
      sessions: (sessions.results as (SessionRow & { present: number; absent: number })[]).map((s) => ({
        id: s.id,
        classDate: s.class_date,
        startTime: s.start_time,
        topic: s.topic,
        status: s.status,
        present: s.present,
        absent: s.absent,
      })),
    };
    return c.json(body);
  })
  .get("/offerings/:offeringId/students/:enrollmentId", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    const enrollmentId = idParam(c, "enrollmentId");
    const db = c.env.DB;
    const row = await db
      .prepare(`${STUDENT_SUMMARY_SQL} AND e.id = ? GROUP BY e.id`)
      .bind(offering.offeringId, enrollmentId)
      .first<StudentSummaryRow>();
    if (!row) throw new HttpError(404, "Student not found in this course.");

    const { results } = await db
      .prepare(
        `SELECT a.id, a.class_date, a.start_time, a.topic, a.status AS session_status, r.status
           FROM attendance_sessions a
           LEFT JOIN attendance_records r ON r.session_id = a.id AND r.enrollment_id = ?
          WHERE a.offering_id = ?
          ORDER BY a.class_date DESC, a.start_time DESC`,
      )
      .bind(enrollmentId, offering.offeringId)
      .all<{ id: number; class_date: string; start_time: string; topic: string | null; session_status: SessionStatus; status: AttendanceStatus | null }>();

    const body: StudentInOfferingResponse = {
      offering,
      student: toOfferingStudent(row),
      entries: results.map((r) => ({
        sessionId: r.id,
        classDate: r.class_date,
        startTime: r.start_time,
        topic: r.topic,
        sessionStatus: r.session_status,
        status: r.status,
      })),
    };
    return c.json(body);
  })
  .post("/offerings/:offeringId/sessions", async (c) => {
    const offering = await requireOwnedOffering(c, idParam(c, "offeringId"));
    assertEditable(offering);
    const input = await parseBody(c, createSessionSchema);
    const db = c.env.DB;

    // Every enrolled student must be marked exactly once, and nobody else.
    const enrolled = await enrollmentIds(db, offering.offeringId);
    if (enrolled.size === 0) throw new HttpError(400, "No students are enrolled in this course yet.");
    if (input.records.some((m) => !enrolled.has(m.enrollmentId))) {
      throw new HttpError(400, "One or more students are not enrolled in this course.");
    }
    if (input.records.length !== enrolled.size) {
      throw new HttpError(400, "Mark attendance for every enrolled student.");
    }

    const sessionLookup = "(SELECT id FROM attendance_sessions WHERE offering_id = ? AND class_date = ? AND start_time = ?)";
    try {
      // D1 batches run as a single transaction: all rows are written or none are.
      const [created] = await db.batch([
        db
          .prepare(
            "INSERT INTO attendance_sessions (offering_id, class_date, start_time, topic) VALUES (?, ?, ?, ?) RETURNING id",
          )
          .bind(offering.offeringId, input.classDate, input.startTime, input.topic || null),
        ...input.records.map((m) =>
          db
            .prepare(`INSERT INTO attendance_records (session_id, enrollment_id, status) VALUES (${sessionLookup}, ?, ?)`)
            .bind(offering.offeringId, input.classDate, input.startTime, m.enrollmentId, m.status),
        ),
      ]);
      const id = (created.results[0] as { id: number }).id;
      return c.json({ id }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, "A class session already exists for this course at that date and time.");
      }
      throw error;
    }
  })
  .get("/sessions/:sessionId", async (c) => {
    const { session, offering } = await requireOwnedSession(c, idParam(c, "sessionId"));
    const { results } = await c.env.DB.prepare(
      `SELECT e.id AS enrollment_id, st.roll_number, st.name, r.status
         FROM enrollments e
         JOIN students st ON st.id = e.student_id
         LEFT JOIN attendance_records r ON r.enrollment_id = e.id AND r.session_id = ?
        -- Current students, plus dropped students who already have a mark in this class.
        WHERE e.offering_id = ? AND (e.status = 'enrolled' OR r.id IS NOT NULL)
        ORDER BY st.roll_number`,
    )
      .bind(session.id, offering.offeringId)
      .all<{ enrollment_id: number; roll_number: string; name: string; status: AttendanceStatus | null }>();

    const body: SessionDetailResponse = {
      offering,
      session: {
        id: session.id,
        classDate: session.class_date,
        startTime: session.start_time,
        topic: session.topic,
        status: session.status,
      },
      records: results.map((r) => ({
        enrollmentId: r.enrollment_id,
        rollNumber: r.roll_number,
        name: r.name,
        status: r.status,
      })),
    };
    return c.json(body);
  })
  .put("/sessions/:sessionId", async (c) => {
    const { session, offering } = await requireOwnedSession(c, idParam(c, "sessionId"));
    assertEditable(offering);
    const input = await parseBody(c, updateSessionSchema);
    const db = c.env.DB;

    if (input.records) {
      const enrolled = await enrollmentIds(db, offering.offeringId);
      if (input.records.some((m) => !enrolled.has(m.enrollmentId))) {
        throw new HttpError(400, "One or more students are not enrolled in this course.");
      }
    }

    const statements: D1PreparedStatement[] = [];
    if (input.topic !== undefined) {
      statements.push(
        db.prepare("UPDATE attendance_sessions SET topic = ? WHERE id = ?").bind(input.topic || null, session.id),
      );
    }
    if (input.status !== undefined) {
      statements.push(db.prepare("UPDATE attendance_sessions SET status = ? WHERE id = ?").bind(input.status, session.id));
    }
    for (const m of input.records ?? []) {
      statements.push(db.prepare(upsertRecordSql).bind(session.id, m.enrollmentId, m.status));
    }
    if (statements.length > 0) await db.batch(statements);
    return c.json({ ok: true });
  })
  .delete("/sessions/:sessionId", async (c) => {
    const { session, offering } = await requireOwnedSession(c, idParam(c, "sessionId"));
    assertEditable(offering);
    // attendance_records rows are removed by ON DELETE CASCADE.
    await c.env.DB.prepare("DELETE FROM attendance_sessions WHERE id = ?").bind(session.id).run();
    return c.json({ ok: true });
  })
  // Live attendance codes (START / EXTEND / STOP); same auth middleware as above.
  .route("/", liveRoutes);
