import { env, exports } from "cloudflare:workers";
import { hashPassword } from "../worker/lib/password";

export const ORIGIN = "http://example.com";
export const PASSWORD = "correct-horse-battery";

/**
 * Minimal fixture:
 *  - prof.a teaches CS-1 (active, students s1+s2) and CS-3 (completed semester, s1)
 *  - prof.b teaches CS-2 (active, students s1+s3)
 *  - disabled@ is a disabled student account; inactive.prof@ has an inactive faculty profile
 *  - faculty 4 is a directory entry with no login account
 *  - prof.a also teaches CS-1 in the evening schedule (offering 4, evening student s.evening)
 */
export async function seedFixture() {
  const hash = await hashPassword(PASSWORD);
  const db = env.DB;
  await db.batch(
    [
      "INSERT INTO programmes (id, code, name) VALUES (1, 'BSCS', 'BS Computer Science')",
      "INSERT INTO semesters (id, number, academic_year, status) VALUES (1, 3, '2026-2027', 'active'), (2, 2, '2025-2026', 'completed')",
      "INSERT INTO courses (id, code, title, credit_hours) VALUES (1, 'CS-1', 'Course One', 3), (2, 'CS-2', 'Course Two', 3), (3, 'CS-3', 'Course Three', 3)",
      `INSERT INTO users (id, email, password_hash, role, status) VALUES
         (1, 'prof.a@test.edu', '${hash}', 'faculty', 'active'),
         (2, 'prof.b@test.edu', '${hash}', 'faculty', 'active'),
         (3, 's1@test.edu', '${hash}', 'student', 'active'),
         (4, 's2@test.edu', '${hash}', 'student', 'active'),
         (5, 's3@test.edu', '${hash}', 'student', 'active'),
         (6, 'disabled@test.edu', '${hash}', 'student', 'disabled'),
         (7, 'inactive.prof@test.edu', '${hash}', 'faculty', 'active'),
         (8, 's.evening@test.edu', '${hash}', 'student', 'active')`,
      `INSERT INTO faculty (id, user_id, employee_id, name, designation, category, status) VALUES
         (1, 1, 'F-1', 'Prof A', 'Professor', 'test_account', 'active'),
         (2, 2, 'F-2', 'Prof B', 'Lecturer', 'test_account', 'active'),
         (3, 7, 'F-3', 'Prof Inactive', 'Lecturer', 'test_account', 'inactive'),
         (4, NULL, NULL, 'Directory Only', 'Assistant Professor', 'full_time', 'active')`,
      `INSERT INTO students (id, user_id, roll_number, name, current_semester, programme_id) VALUES
         (1, 3, 'R-1', 'Student One', 3, 1), (2, 4, 'R-2', 'Student Two', 3, 1),
         (3, 5, 'R-3', 'Student Three', 3, 1), (4, 6, 'R-4', 'Disabled Student', 3, 1)`,
      `INSERT INTO course_offerings (id, course_id, semester_id, faculty_id, section) VALUES
         (1, 1, 1, 1, 'A'), (2, 2, 1, 2, 'A'), (3, 3, 2, 1, 'A')`,
      // Evening schedule: the same course CS-1 (same semester, section, professor) with its own student.
      "INSERT INTO students (id, user_id, roll_number, name, current_semester, programme_id, shift) VALUES (5, 8, 'R-5', 'Evening Student', 3, 1, 'evening')",
      "INSERT INTO course_offerings (id, course_id, semester_id, faculty_id, section, shift) VALUES (4, 1, 1, 1, 'A', 'evening')",
      `INSERT INTO enrollments (id, student_id, offering_id) VALUES
         (1, 1, 1), (2, 2, 1), (3, 1, 2), (4, 3, 2), (5, 1, 3), (6, 5, 4)`,
      // Offering 1: three held sessions + one cancelled. s1 present 2/3, s2 present 1/3.
      `INSERT INTO attendance_sessions (id, offering_id, class_date, start_time, status) VALUES
         (1, 1, '2026-09-01', '09:00', 'held'), (2, 1, '2026-09-03', '09:00', 'held'),
         (3, 1, '2026-09-05', '09:00', 'held'), (4, 1, '2026-09-07', '09:00', 'cancelled'),
         (5, 2, '2026-09-02', '11:00', 'held'),
         (6, 4, '2026-09-01', '18:00', 'held')`,
      `INSERT INTO attendance_records (session_id, enrollment_id, status) VALUES
         (1, 1, 'present'), (2, 1, 'present'), (3, 1, 'absent'),
         (1, 2, 'present'), (2, 2, 'absent'), (3, 2, 'absent'),
         (4, 1, 'absent'),
         (5, 3, 'present'), (5, 4, 'present'),
         (6, 6, 'absent')`,
    ].map((sql) => db.prepare(sql)),
  );
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
}

export function api(path: string, options: RequestOptions = {}): Promise<Response> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = { ...options.headers };
  if (method !== "GET") headers.Origin ??= ORIGIN;
  if (options.body !== undefined) headers["Content-Type"] ??= "application/json";
  if (options.cookie) headers.Cookie = options.cookie;
  return exports.default.fetch(
    new Request(`${ORIGIN}/api${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}

/** Logs in and returns the Cookie header value for later requests. */
export async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await api("/auth/login", { body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) throw new Error("no Set-Cookie header");
  return setCookie.split(";")[0];
}
