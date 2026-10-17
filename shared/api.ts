// API request/response types shared by the Worker and the React app.
// Type-only (plus tiny pure helpers) so it is safe to import from both sides.

export type Role = "student" | "faculty";
export type AttendanceStatus = "present" | "absent";
export type SessionStatus = "held" | "cancelled";
export type SemesterStatus = "upcoming" | "active" | "completed";
export type Shift = "morning" | "evening";

export interface AttendanceSummary {
  /** Held (non-cancelled) sessions with a record for this student. */
  held: number;
  attended: number;
  missed: number;
  /** null when no classes have been held yet. Rounded to 2 decimals. */
  percentage: number | null;
}

export interface StudentProfile {
  kind: "student";
  name: string;
  email: string;
  rollNumber: string;
  currentSemester: number;
  shift: Shift;
  programme: { code: string; name: string; semesterCount: number };
}

export type FacultyCategory =
  | "full_time"
  | "teaching_associate"
  | "visiting"
  | "inter_departmental"
  | "compulsory_subjects"
  | "test_account";

export interface FacultyProfile {
  kind: "faculty";
  name: string;
  /** Login email. */
  email: string;
  employeeId: string | null;
  designation: string | null;
  department: string;
  category: FacultyCategory;
  /** Published directory contact, when different from the login email. */
  officialEmail: string | null;
  qualifications: string | null;
  researchInterests: string | null;
}

export interface MeResponse {
  user: { id: number; email: string; role: Role };
  profile: StudentProfile | FacultyProfile;
}

export interface OfferingInfo {
  offeringId: number;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  section: string;
  shift: Shift;
  /** Programme whose curriculum contains the course (BSCS/BSSE/BSAI); null if none. */
  programme: string | null;
  semester: { number: number; academicYear: string; status: SemesterStatus };
}

// ---- Student ----

export type EnrollmentStatus = "enrolled" | "dropped";

export interface StudentCourse extends OfferingInfo {
  faculty: { name: string; designation: string | null };
  enrollmentStatus: EnrollmentStatus;
  summary: AttendanceSummary;
}

export interface StudentCoursesResponse {
  courses: StudentCourse[];
}

export interface StudentAttendanceEntry {
  sessionId: number;
  classDate: string;
  startTime: string;
  topic: string | null;
  sessionStatus: SessionStatus;
  /** null when the session was held but no record exists for this student. */
  status: AttendanceStatus | null;
}

export interface StudentCourseDetailResponse {
  course: StudentCourse;
  entries: StudentAttendanceEntry[];
}

export interface StudentHistoryEntry extends StudentAttendanceEntry {
  offeringId: number;
  courseCode: string;
  courseTitle: string;
}

export interface StudentHistoryResponse {
  /** "current" = active semesters only; "all" = every semester. */
  scope: "current" | "all";
  entries: StudentHistoryEntry[];
}

// ---- Faculty ----

export interface FacultyOffering extends OfferingInfo {
  enrolledCount: number;
  sessionsHeld: number;
  /** Present records / all records across held sessions. */
  averagePercentage: number | null;
}

export interface FacultyOfferingsResponse {
  offerings: FacultyOffering[];
}

export interface OfferingStudent {
  enrollmentId: number;
  rollNumber: string;
  name: string;
  summary: AttendanceSummary;
}

export interface OfferingSession {
  id: number;
  classDate: string;
  startTime: string;
  topic: string | null;
  status: SessionStatus;
  present: number;
  absent: number;
}

export interface FacultyOfferingDetailResponse {
  offering: FacultyOffering;
  students: OfferingStudent[];
  sessions: OfferingSession[];
}

export interface RecentSession extends OfferingSession {
  offering: OfferingInfo;
}

export interface RecentSessionsResponse {
  sessions: RecentSession[];
}

export interface SessionRecord {
  enrollmentId: number;
  rollNumber: string;
  name: string;
  status: AttendanceStatus | null;
}

export interface SessionDetailResponse {
  offering: FacultyOffering;
  session: Omit<OfferingSession, "present" | "absent">;
  records: SessionRecord[];
}

export interface StudentInOfferingResponse {
  offering: FacultyOffering;
  student: OfferingStudent;
  entries: StudentAttendanceEntry[];
}

export interface AttendanceMark {
  enrollmentId: number;
  status: AttendanceStatus;
}

export interface CreateSessionRequest {
  classDate: string;
  startTime: string;
  topic?: string;
  records: AttendanceMark[];
}

export interface UpdateSessionRequest {
  topic?: string | null;
  status?: SessionStatus;
  records?: AttendanceMark[];
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export function attendancePercentage(attended: number, held: number): number | null {
  if (held <= 0) return null;
  return Math.round((attended / held) * 10000) / 100;
}

export function summarize(held: number, attended: number): AttendanceSummary {
  return { held, attended, missed: held - attended, percentage: attendancePercentage(attended, held) };
}
