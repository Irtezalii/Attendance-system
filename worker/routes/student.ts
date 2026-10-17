import { Hono } from "hono";
import { z } from "zod";
import type {
  CheckInResponse,
  AttendanceStatus,
  EnrollmentStatus,
  SessionStatus,
  StudentCourse,
  StudentCourseDetailResponse,
  StudentCoursesResponse,
  StudentHistoryResponse,
} from "../../shared/api";
import { summarize } from "../../shared/api";
import { requireAuth, type AppEnv } from "../lib/auth";
import { HttpError, idParam, parseBody } from "../lib/http";
import { OFFERING_COLUMNS, OFFERING_JOINS, OFFERING_ORDER, toOfferingInfo, type OfferingRow } from "../lib/queries";

interface StudentCourseRow extends OfferingRow {
  enrollment_id: number;
  enrollment_status: EnrollmentStatus;
  faculty_name: string;
  faculty_designation: string | null;
  held: number;
  attended: number;
}

// Every query is scoped by e.student_id = <the signed-in student>, so a student can
// only ever see their own enrollments and records.
const STUDENT_COURSE_SQL = `
  SELECT ${OFFERING_COLUMNS}, e.id AS enrollment_id, e.status AS enrollment_status,
    f.name AS faculty_name, f.designation AS faculty_designation,
    COUNT(CASE WHEN a.status = 'held' THEN 1 END) AS held,
    COUNT(CASE WHEN a.status = 'held' AND r.status = 'present' THEN 1 END) AS attended
  FROM enrollments e
  JOIN course_offerings co ON co.id = e.offering_id
  ${OFFERING_JOINS}
  JOIN faculty f ON f.id = co.faculty_id
  LEFT JOIN attendance_records r ON r.enrollment_id = e.id
  LEFT JOIN attendance_sessions a ON a.id = r.session_id
  WHERE e.student_id = ?`;

function toStudentCourse(row: StudentCourseRow): StudentCourse {
  return {
    ...toOfferingInfo(row),
    faculty: { name: row.faculty_name, designation: row.faculty_designation },
    enrollmentStatus: row.enrollment_status,
    summary: summarize(row.held, row.attended),
  };
}

const checkInSchema = z.object({ code: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code from your professor.") });

export const studentRoutes = new Hono<AppEnv>()
  .use(requireAuth("student"))
  // Mark yourself present with the professor's live code.
  .post("/check-in", async (c) => {
    const { code } = await parseBody(c, checkInSchema);
    const auth = c.get("auth");
    const { success } = await c.env.CHECKIN_LIMITER.limit({ key: `user:${auth.userId}` });
    if (!success) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");

    const db = c.env.DB;
    const now = Date.now();
    // One statement validates and records: the code must be active and unexpired, and the
    // student must be enrolled (status 'enrolled') in that exact offering — which already fixes
    // programme, semester, section and Morning/Evening. Only an untouched Absent mark is changed.
    const recorded = await db
      .prepare(
        `UPDATE attendance_records SET status = 'present', checked_in_at = ?
          WHERE checked_in_at IS NULL AND status = 'absent'
            AND (session_id, enrollment_id) = (
              SELECT a.id, e.id
                FROM attendance_sessions a
                JOIN enrollments e ON e.offering_id = a.offering_id
               WHERE a.code = ? AND a.code_status = 'active' AND a.code_expires_at > ?
                 AND e.student_id = ? AND e.status = 'enrolled')
          RETURNING session_id`,
      )
      .bind(now, code, now, auth.profileId)
      .first<{ session_id: number }>();

    if (!recorded) {
      const existing = await db
        .prepare(
          `SELECT r.id FROM attendance_records r
             JOIN attendance_sessions a ON a.id = r.session_id
             JOIN enrollments e ON e.id = r.enrollment_id
            WHERE a.code = ? AND a.code_status = 'active' AND a.code_expires_at > ?
              AND e.student_id = ? AND r.status = 'present'`,
        )
        .bind(code, now, auth.profileId)
        .first();
      if (existing) throw new HttpError(409, "Your attendance for this class is already recorded.");
      // Same answer for wrong, expired, deactivated, or another class's code.
      throw new HttpError(400, "This code is not valid for any of your classes right now.");
    }

    const info = await db
      .prepare(
        `SELECT c.code AS course_code, c.title AS course_title, a.class_date, a.start_time
           FROM attendance_sessions a
           JOIN course_offerings co ON co.id = a.offering_id
           JOIN courses c ON c.id = co.course_id
          WHERE a.id = ?`,
      )
      .bind(recorded.session_id)
      .first<{ course_code: string; course_title: string; class_date: string; start_time: string }>();
    const body: CheckInResponse = {
      courseCode: info!.course_code,
      courseTitle: info!.course_title,
      classDate: info!.class_date,
      startTime: info!.start_time,
    };
    return c.json(body);
  })
  .get("/courses", async (c) => {
    const { results } = await c.env.DB.prepare(`${STUDENT_COURSE_SQL} GROUP BY e.id ORDER BY ${OFFERING_ORDER}`)
      .bind(c.get("auth").profileId)
      .all<StudentCourseRow>();
    const body: StudentCoursesResponse = { courses: results.map(toStudentCourse) };
    return c.json(body);
  })
  .get("/attendance", async (c) => {
    // Attendance across all of the student's courses, newest first.
    const scope = c.req.query("scope") === "all" ? "all" : "current";
    const { results } = await c.env.DB.prepare(
      `SELECT a.id, a.class_date, a.start_time, a.topic, a.status AS session_status, r.status,
              co.id AS offering_id, c.code AS course_code, c.title AS course_title
         FROM enrollments e
         JOIN course_offerings co ON co.id = e.offering_id
         ${OFFERING_JOINS}
         JOIN attendance_sessions a ON a.offering_id = co.id
         LEFT JOIN attendance_records r ON r.session_id = a.id AND r.enrollment_id = e.id
        WHERE e.student_id = ? ${scope === "current" ? "AND sem.status = 'active'" : ""}
        ORDER BY a.class_date DESC, a.start_time DESC, c.code
        LIMIT 2000`,
    )
      .bind(c.get("auth").profileId)
      .all<{
        id: number;
        class_date: string;
        start_time: string;
        topic: string | null;
        session_status: SessionStatus;
        status: AttendanceStatus | null;
        offering_id: number;
        course_code: string;
        course_title: string;
      }>();
    const body: StudentHistoryResponse = {
      scope,
      entries: results.map((r) => ({
        sessionId: r.id,
        classDate: r.class_date,
        startTime: r.start_time,
        topic: r.topic,
        sessionStatus: r.session_status,
        status: r.status,
        offeringId: r.offering_id,
        courseCode: r.course_code,
        courseTitle: r.course_title,
      })),
    };
    return c.json(body);
  })
  .get("/courses/:offeringId", async (c) => {
    const offeringId = idParam(c, "offeringId");
    const db = c.env.DB;
    const row = await db
      .prepare(`${STUDENT_COURSE_SQL} AND co.id = ? GROUP BY e.id`)
      .bind(c.get("auth").profileId, offeringId)
      .first<StudentCourseRow>();
    if (!row) throw new HttpError(404, "Course not found.");

    const { results } = await db
      .prepare(
        `SELECT a.id, a.class_date, a.start_time, a.topic, a.status AS session_status, r.status
           FROM attendance_sessions a
           LEFT JOIN attendance_records r ON r.session_id = a.id AND r.enrollment_id = ?
          WHERE a.offering_id = ?
          ORDER BY a.class_date DESC, a.start_time DESC`,
      )
      .bind(row.enrollment_id, offeringId)
      .all<{ id: number; class_date: string; start_time: string; topic: string | null; session_status: SessionStatus; status: AttendanceStatus | null }>();

    const body: StudentCourseDetailResponse = {
      course: toStudentCourse(row),
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
  });
