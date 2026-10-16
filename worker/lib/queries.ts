import type { FacultyOffering, OfferingInfo, SemesterStatus } from "../../shared/api";
import { attendancePercentage } from "../../shared/api";

/** Columns for OfferingInfo; expects aliases co (course_offerings), c (courses), sem (semesters). */
export const OFFERING_COLUMNS = `
  co.id AS offering_id, c.code AS course_code, c.title AS course_title, c.credit_hours,
  co.section, sem.number AS semester_number, sem.academic_year, sem.status AS semester_status`;

export const OFFERING_JOINS = `
  JOIN courses c ON c.id = co.course_id
  JOIN semesters sem ON sem.id = co.semester_id`;

export interface OfferingRow {
  offering_id: number;
  course_code: string;
  course_title: string;
  credit_hours: number;
  section: string;
  semester_number: number;
  academic_year: string;
  semester_status: SemesterStatus;
}

export function toOfferingInfo(row: OfferingRow): OfferingInfo {
  return {
    offeringId: row.offering_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    creditHours: row.credit_hours,
    section: row.section,
    semester: { number: row.semester_number, academicYear: row.academic_year, status: row.semester_status },
  };
}

/** Newest semester first, then course code. */
export const OFFERING_ORDER = "sem.academic_year DESC, sem.number DESC, c.code, co.section";

interface FacultyOfferingRow extends OfferingRow {
  enrolled_count: number;
  sessions_held: number;
  records_total: number;
  records_present: number;
}

const FACULTY_OFFERING_SQL = `
  SELECT ${OFFERING_COLUMNS},
    (SELECT COUNT(*) FROM enrollments e WHERE e.offering_id = co.id AND e.status = 'enrolled') AS enrolled_count,
    (SELECT COUNT(*) FROM attendance_sessions a WHERE a.offering_id = co.id AND a.status = 'held') AS sessions_held,
    (SELECT COUNT(*) FROM attendance_records r JOIN attendance_sessions a ON a.id = r.session_id
      WHERE a.offering_id = co.id AND a.status = 'held') AS records_total,
    (SELECT COUNT(*) FROM attendance_records r JOIN attendance_sessions a ON a.id = r.session_id
      WHERE a.offering_id = co.id AND a.status = 'held' AND r.status = 'present') AS records_present
  FROM course_offerings co ${OFFERING_JOINS}
  WHERE co.faculty_id = ?`;

function toFacultyOffering(row: FacultyOfferingRow): FacultyOffering {
  return {
    ...toOfferingInfo(row),
    enrolledCount: row.enrolled_count,
    sessionsHeld: row.sessions_held,
    averagePercentage: attendancePercentage(row.records_present, row.records_total),
  };
}

export async function listFacultyOfferings(db: D1Database, facultyId: number): Promise<FacultyOffering[]> {
  const { results } = await db
    .prepare(`${FACULTY_OFFERING_SQL} ORDER BY ${OFFERING_ORDER}`)
    .bind(facultyId)
    .all<FacultyOfferingRow>();
  return results.map(toFacultyOffering);
}

/**
 * Loads an offering only if it is assigned to this professor. Returns null otherwise,
 * which callers turn into a 404 so other professors' offerings are not revealed.
 */
export async function getOwnedOffering(
  db: D1Database,
  facultyId: number,
  offeringId: number,
): Promise<FacultyOffering | null> {
  const row = await db
    .prepare(`${FACULTY_OFFERING_SQL} AND co.id = ?`)
    .bind(facultyId, offeringId)
    .first<FacultyOfferingRow>();
  return row ? toFacultyOffering(row) : null;
}
