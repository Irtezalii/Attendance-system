import { Hono } from "hono";
import type {
  AttendanceStatus,
  SessionStatus,
  StudentCourse,
  StudentCourseDetailResponse,
  StudentCoursesResponse,
} from "../../shared/api";
import { summarize } from "../../shared/api";
import { requireAuth, type AppEnv } from "../lib/auth";
import { HttpError, idParam } from "../lib/http";
import { OFFERING_COLUMNS, OFFERING_JOINS, OFFERING_ORDER, toOfferingInfo, type OfferingRow } from "../lib/queries";

interface StudentCourseRow extends OfferingRow {
  enrollment_id: number;
  faculty_name: string;
  faculty_designation: string;
  held: number;
  attended: number;
}

// Every query is scoped by e.student_id = <the signed-in student>, so a student can
// only ever see their own enrollments and records.
const STUDENT_COURSE_SQL = `
  SELECT ${OFFERING_COLUMNS}, e.id AS enrollment_id,
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
    summary: summarize(row.held, row.attended),
  };
}

export const studentRoutes = new Hono<AppEnv>()
  .use(requireAuth("student"))
  .get("/courses", async (c) => {
    const { results } = await c.env.DB.prepare(`${STUDENT_COURSE_SQL} GROUP BY e.id ORDER BY ${OFFERING_ORDER}`)
      .bind(c.get("auth").profileId)
      .all<StudentCourseRow>();
    const body: StudentCoursesResponse = { courses: results.map(toStudentCourse) };
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
