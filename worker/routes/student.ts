import { Hono } from "hono";
import { z } from "zod";
import type {
  CheckInResponse,
  AttendanceStatus,
  EnrollmentStatus,
  GeoRejectionReason,
  SessionStatus,
  StudentCourse,
  StudentCourseDetailResponse,
  StudentCoursesResponse,
  StudentHistoryResponse,
} from "../../shared/api";
import { GEO_MAX_ACCURACY, LOCATION_REQUIRED_DETAIL, summarize } from "../../shared/api";
import { requireAuth, type AppEnv } from "../lib/auth";
import { metresOutsideBox } from "../lib/geo";
import { HttpError, idParam, parseBody } from "../lib/http";
import { geoPointSchema } from "./live";
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

const checkInSchema = z.object({
  code: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code from your professor."),
  location: geoPointSchema.nullable().optional(),
});

export const studentRoutes = new Hono<AppEnv>()
  .use(requireAuth("student"))
  // Mark yourself present with the professor's live code.
  .post("/check-in", async (c) => {
    const { code, location } = await parseBody(c, checkInSchema);
    const auth = c.get("auth");
    const { success } = await c.env.CHECKIN_LIMITER.limit({ key: `user:${auth.userId}` });
    if (!success) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");

    const db = c.env.DB;
    const now = Date.now();
    const notValid = () => new HttpError(400, "This code is not valid for any of your classes right now.");

    // 1. Code + class: the code must be active and unexpired, and the student enrolled in that
    //    exact offering (which fixes programme, semester, section and Morning/Evening). Students
    //    outside the class learn nothing more, not even whether a location is required.
    const target = await db
      .prepare(
        `SELECT a.id AS session_id, e.id AS enrollment_id, a.geo_required, a.geo_lat, a.geo_lng, a.geo_radius_m, r.status
           FROM attendance_sessions a
           JOIN enrollments e ON e.offering_id = a.offering_id AND e.student_id = ? AND e.status = 'enrolled'
           LEFT JOIN attendance_records r ON r.session_id = a.id AND r.enrollment_id = e.id
          WHERE a.code = ? AND a.code_status = 'active' AND a.code_expires_at > ?`,
      )
      .bind(auth.profileId, code, now)
      .first<{
        session_id: number;
        enrollment_id: number;
        geo_required: number;
        geo_lat: number | null;
        geo_lng: number | null;
        geo_radius_m: number | null;
        status: AttendanceStatus | null;
      }>();
    if (!target || target.status === null) throw notValid();
    if (target.status === "present") throw new HttpError(409, "Your attendance for this class is already recorded.");

    // 2. Location, when the professor required it: within the radius of the professor's position.
    let distance: number | null = null;
    let accuracy: number | null = null;
    if (target.geo_required) {
      const reject = async (reason: GeoRejectionReason, message: string) => {
        await db
          .prepare("INSERT INTO checkin_rejections (session_id, enrollment_id, reason, distance_m, accuracy_m, at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(target.session_id, target.enrollment_id, reason, distance, accuracy, now)
          .run();
        throw new HttpError(400, message);
      };
      if (location === undefined) {
        // Not attempted yet: ask the client for a location (not logged as a rejection).
        throw new HttpError(400, "This class requires your location. Allow location access when your browser asks.", {
          [LOCATION_REQUIRED_DETAIL]: ["required"],
        });
      }
      if (location === null) {
        await reject("no_location", "This class requires your location. Allow location access for this site, or ask your professor to mark you manually.");
      } else {
        accuracy = location.accuracy;
        // Square campus box stored on the class: geo_radius_m is its half-size (metres each way).
        distance = metresOutsideBox(target.geo_lat!, target.geo_lng!, target.geo_radius_m!, location.lat, location.lng);
        if (location.accuracy > GEO_MAX_ACCURACY) {
          await reject(
            "imprecise",
            `Your location isn't precise enough (±${Math.round(location.accuracy)} m). Turn on precise location/GPS on your phone and try again.`,
          );
        }
        if (distance > 0) {
          await reject(
            "out_of_range",
            `You're about ${Math.round(distance)} m outside the ${c.env.CAMPUS_NAME} area. You must be on campus near ${c.env.CAMPUS_NAME} to mark attendance.`,
          );
        }
      }
    }

    // 3. Record: one conditional UPDATE re-checks the code is still active, so a code that
    //    expires or is stopped mid-request, or a duplicate submission, changes nothing.
    const recorded = await db
      .prepare(
        `UPDATE attendance_records SET status = 'present', checked_in_at = ?, checkin_distance_m = ?, checkin_accuracy_m = ?
          WHERE checked_in_at IS NULL AND status = 'absent'
            AND (session_id, enrollment_id) = (
              SELECT a.id, e.id
                FROM attendance_sessions a
                JOIN enrollments e ON e.offering_id = a.offering_id
               WHERE a.code = ? AND a.code_status = 'active' AND a.code_expires_at > ?
                 AND e.student_id = ? AND e.status = 'enrolled')
          RETURNING session_id`,
      )
      .bind(now, distance, accuracy, code, now, auth.profileId)
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
      throw notValid();
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
