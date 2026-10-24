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

// ---- Live attendance codes ----

export type LiveCodeStatus = "active" | "expired" | "deactivated";

export const LIVE_CODE_MINUTES = 10;
export const LIVE_EXTEND_MINUTES = 5;

/** Student locations less precise than this (metres) are refused. */
export const GEO_MAX_ACCURACY = 100;

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Reported accuracy radius in metres. */
  accuracy: number;
}

export interface LiveCheckIn {
  rollNumber: string;
  name: string;
  /** Unix ms. */
  at: number;
  /** Metres outside the campus area when location was required (0 = inside); null otherwise. */
  distanceM: number | null;
}

export type GeoRejectionReason = "out_of_range" | "imprecise" | "no_location";

/** Latest refused attempt per student who is not (yet) marked present. */
export interface LiveRejection {
  rollNumber: string;
  name: string;
  reason: GeoRejectionReason;
  distanceM: number | null;
  accuracyM: number | null;
  at: number;
}

export interface LiveStartRequest {
  /** Students must check in from inside the campus area (box around UBIT). */
  requireLocation?: boolean;
}

export interface LiveSession {
  /** attendance_sessions.id — the class this code records attendance for. */
  sessionId: number;
  code: string;
  status: LiveCodeStatus;
  classDate: string;
  startTime: string;
  /** Unix ms, server clock. */
  startedAt: number;
  expiresAt: number;
  stoppedAt: number | null;
  identifier: string;
  presentCount: number;
  enrolledCount: number;
  checkIns: LiveCheckIn[];
  /** Campus location check (square box around the campus point), or null when the code works anywhere. */
  geo: { areaName: string; halfSizeM: number } | null;
  rejections: LiveRejection[];
}

export interface LiveStateResponse {
  offering: FacultyOffering;
  /** Server time (unix ms) when this response was built; the countdown is based on it. */
  serverNow: number;
  /** IANA timezone the class date/time are in (e.g. Asia/Karachi); clock times use it too. */
  timeZone: string;
  /** Latest code session for this class, or null if none was ever started. */
  session: LiveSession | null;
}

export interface LiveCodeRequest {
  code: string;
}

export interface CheckInRequest {
  code: string;
  /**
   * Omitted: location not attempted yet (the server answers "location required" if needed).
   * null: the device could not provide a location (permission denied, timeout, unsupported).
   */
  location?: GeoPoint | null;
}

/** `details` key the check-in endpoint uses to ask the client for a location. */
export const LOCATION_REQUIRED_DETAIL = "location";

export interface CheckInResponse {
  courseCode: string;
  courseTitle: string;
  classDate: string;
  startTime: string;
}

/** YYYY-MM-DD -> DD-MM-YYYY */
export function formatDayMonthYear(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

/** Exact professor-facing messages for the live attendance window. */
export const liveMessages = {
  started: (isoDate: string, code: string) => [
    `Your new code for today ${formatDayMonthYear(isoDate)} is ${code}`,
    `Your Code will expire in ${LIVE_CODE_MINUTES} minutes.`,
  ],
  extended: "The code has been extended for another 5 minutes and will now expire at the end of 5 minute period.",
  stopped: (code: string) => `Your last generated Code: ${code} has been Deactivated`,
  notActive: (code: string) => `Code ${code} is not active.`,
};

/**
 * Human-readable identifier for a class session, e.g.
 * ATT-17-10-2026-morning-bscs-cs451-sec-a-2nd-year. Display only: the offering ID is
 * what decides which students belong to the class.
 */
export function classIdentifier(o: OfferingInfo, isoDate: string): string {
  const year = Math.ceil(o.semester.number / 2);
  const ordinal = ["", "1st", "2nd", "3rd", "4th"][year] ?? `${year}th`;
  return [
    "ATT",
    formatDayMonthYear(isoDate),
    o.shift,
    (o.programme ?? "na").toLowerCase(),
    o.courseCode.toLowerCase().replace(/[^a-z0-9]/g, ""),
    `sec-${o.section.toLowerCase()}`,
    `${ordinal}-year`,
  ].join("-");
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
