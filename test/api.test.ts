import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  FacultyOfferingDetailResponse,
  FacultyOfferingsResponse,
  MeResponse,
  RecentSessionsResponse,
  SessionDetailResponse,
  StudentCourseDetailResponse,
  StudentCoursesResponse,
  StudentHistoryResponse,
} from "../shared/api";
import { attendancePercentage } from "../shared/api";
import { api, login, PASSWORD, seedFixture } from "./helpers";

let s1: string;
let s2: string;
let profA: string;
let profB: string;

beforeAll(async () => {
  await seedFixture();
  [s1, s2, profA, profB] = await Promise.all([
    login("s1@test.edu"),
    login("s2@test.edu"),
    login("prof.a@test.edu"),
    login("prof.b@test.edu"),
  ]);
});

const today = () => new Date().toISOString().slice(0, 10);

describe("attendance percentage", () => {
  it("handles zero held classes and rounds to 2 decimals", () => {
    expect(attendancePercentage(0, 0)).toBeNull();
    expect(attendancePercentage(15, 18)).toBe(83.33);
    expect(attendancePercentage(18, 20)).toBe(90);
  });
});

describe("authentication", () => {
  it("rejects a wrong password and an unknown email with the same message", async () => {
    const wrong = await api("/auth/login", { body: { email: "s2@test.edu", password: "nope-nope" } });
    const unknown = await api("/auth/login", { body: { email: "nobody@test.edu", password: "nope-nope" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("rejects disabled accounts", async () => {
    const res = await api("/auth/login", { body: { email: "disabled@test.edu", password: PASSWORD } });
    expect(res.status).toBe(401);
  });

  it("validates the login body", async () => {
    const res = await api("/auth/login", { body: { email: "not-an-email" } });
    expect(res.status).toBe(400);
  });

  it("sets an HttpOnly, SameSite=Lax session cookie and stores only its hash", async () => {
    const res = await api("/auth/login", { body: { email: "S1@Test.edu", password: PASSWORD } });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const token = cookie.split(";")[0].split("=")[1];
    const stored = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id = ?").bind(token).first<{ n: number }>();
    expect(stored?.n).toBe(0);
  });

  it("returns the profile without any password data", async () => {
    const res = await api("/auth/me", { cookie: s1 });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("pbkdf2");
    const me = JSON.parse(text) as MeResponse;
    expect(me.user.role).toBe("student");
    expect(me.profile).toMatchObject({
      kind: "student",
      rollNumber: "R-1",
      currentSemester: 3,
      programme: { code: "BSCS", semesterCount: 8 },
    });
  });

  it("returns the faculty directory profile for professors", async () => {
    const me = (await (await api("/auth/me", { cookie: profA })).json()) as MeResponse;
    expect(me.user.role).toBe("faculty");
    expect(me.profile).toMatchObject({ kind: "faculty", name: "Prof A", department: "Department of Computer Science" });
  });

  it("rejects faculty accounts whose profile is inactive", async () => {
    const res = await api("/auth/login", { body: { email: "inactive.prof@test.edu", password: PASSWORD } });
    expect(res.status).toBe(401);
  });

  it("revokes the previous session when signing in again from the same browser", async () => {
    const first = await login("s3@test.edu");
    const res = await api("/auth/login", { cookie: first, body: { email: "s3@test.edu", password: PASSWORD } });
    expect(res.status).toBe(200);
    expect((await api("/auth/me", { cookie: first })).status).toBe(401);
  });

  it("requires a session for protected endpoints", async () => {
    expect((await api("/auth/me")).status).toBe(401);
    expect((await api("/student/courses")).status).toBe(401);
    expect((await api("/faculty/offerings")).status).toBe(401);
    expect((await api("/student/courses", { cookie: "sid=forged-token" })).status).toBe(401);
  });

  it("invalidates the session on logout", async () => {
    const cookie = await login("s3@test.edu");
    expect((await api("/auth/me", { cookie })).status).toBe(200);
    expect((await api("/auth/logout", { method: "POST", cookie })).status).toBe(200);
    expect((await api("/auth/me", { cookie })).status).toBe(401);
  });
});

describe("CSRF protection", () => {
  it("blocks cross-origin state-changing requests", async () => {
    const res = await api("/auth/logout", { method: "POST", cookie: s1, headers: { Origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("requires JSON bodies", async () => {
    const res = await api("/auth/login", {
      body: { email: "s1@test.edu", password: PASSWORD },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(res.status).toBe(415);
  });
});

describe("role-based access", () => {
  it("keeps students out of faculty endpoints and vice versa", async () => {
    expect((await api("/faculty/offerings", { cookie: s1 })).status).toBe(403);
    expect((await api("/faculty/offerings/1/sessions", { cookie: s1, body: {} })).status).toBe(403);
    expect((await api("/student/courses", { cookie: profA })).status).toBe(403);
  });
});

describe("student dashboard", () => {
  it("lists only the student's own courses with correct summaries", async () => {
    const res = await api("/student/courses", { cookie: s1 });
    const { courses } = (await res.json()) as StudentCoursesResponse;
    expect(courses.map((c) => c.offeringId).sort()).toEqual([1, 2, 3]);

    // Cancelled session 4 has a record for s1 but must not count.
    const one = courses.find((c) => c.offeringId === 1)!;
    expect(one.summary).toEqual({ held: 3, attended: 2, missed: 1, percentage: 66.67 });

    // Completed semester with no sessions: no division by zero.
    const three = courses.find((c) => c.offeringId === 3)!;
    expect(three.summary).toEqual({ held: 0, attended: 0, missed: 0, percentage: null });
  });

  it("shows per-date history including cancelled sessions", async () => {
    const res = await api("/student/courses/1", { cookie: s2 });
    const body = (await res.json()) as StudentCourseDetailResponse;
    expect(body.course.summary.percentage).toBe(33.33);
    expect(body.entries.map((e) => [e.classDate, e.sessionStatus, e.status])).toEqual([
      ["2026-09-07", "cancelled", null],
      ["2026-09-05", "held", "absent"],
      ["2026-09-03", "held", "absent"],
      ["2026-09-01", "held", "present"],
    ]);
  });

  it("lists attendance across the student's own courses only", async () => {
    const current = (await (await api("/student/attendance", { cookie: s2 })).json()) as StudentHistoryResponse;
    expect(current.scope).toBe("current");
    // s2 is only in offering 1 (4 sessions, one cancelled).
    expect(new Set(current.entries.map((e) => e.offeringId))).toEqual(new Set([1]));
    expect(current.entries).toHaveLength(4);

    const all = (await (await api("/student/attendance?scope=all", { cookie: s1 })).json()) as StudentHistoryResponse;
    expect(new Set(all.entries.map((e) => e.courseCode))).toEqual(new Set(["CS-1", "CS-2"]));
  });

  it("cannot read a course the student is not enrolled in", async () => {
    expect((await api("/student/courses/2", { cookie: s2 })).status).toBe(404);
    expect((await api("/student/courses/999", { cookie: s2 })).status).toBe(404);
    expect((await api("/student/courses/abc", { cookie: s2 })).status).toBe(404);
  });
});

describe("faculty access control", () => {
  it("lists only the professor's assigned offerings", async () => {
    const a = (await (await api("/faculty/offerings", { cookie: profA })).json()) as FacultyOfferingsResponse;
    const b = (await (await api("/faculty/offerings", { cookie: profB })).json()) as FacultyOfferingsResponse;
    expect(a.offerings.map((o) => o.offeringId).sort()).toEqual([1, 3]);
    expect(b.offerings.map((o) => o.offeringId)).toEqual([2]);
  });

  it("cannot read or change another professor's offerings or sessions", async () => {
    expect((await api("/faculty/offerings/2", { cookie: profA })).status).toBe(404);
    expect((await api("/faculty/offerings/2/students/3", { cookie: profA })).status).toBe(404);
    expect((await api("/faculty/sessions/5", { cookie: profA })).status).toBe(404);
    expect(
      (await api("/faculty/sessions/5", { method: "PUT", cookie: profA, body: { status: "cancelled" } })).status,
    ).toBe(404);
    expect((await api("/faculty/sessions/5", { method: "DELETE", cookie: profA })).status).toBe(404);
    expect(
      (
        await api("/faculty/offerings/2/sessions", {
          cookie: profA,
          body: { classDate: today(), startTime: "10:00", records: [{ enrollmentId: 3, status: "present" }, { enrollmentId: 4, status: "present" }] },
        })
      ).status,
    ).toBe(404);
  });

  it("lists recent classes only from the professor's own offerings", async () => {
    const a = (await (await api("/faculty/sessions", { cookie: profA })).json()) as RecentSessionsResponse;
    const b = (await (await api("/faculty/sessions", { cookie: profB })).json()) as RecentSessionsResponse;
    expect(new Set(a.sessions.map((s) => s.offering.offeringId))).toEqual(new Set([1]));
    expect(b.sessions.map((s) => s.id)).toEqual([5]);
  });

  it("cannot view a student who is not in the offering", async () => {
    // Enrollment 3 belongs to offering 2, not 1.
    expect((await api("/faculty/offerings/1/students/3", { cookie: profA })).status).toBe(404);
  });

  it("shows enrolled students with summaries", async () => {
    const body = (await (await api("/faculty/offerings/1", { cookie: profA })).json()) as FacultyOfferingDetailResponse;
    expect(body.students.map((s) => [s.rollNumber, s.summary.percentage])).toEqual([
      ["R-1", 66.67],
      ["R-2", 33.33],
    ]);
    expect(body.offering.averagePercentage).toBe(50);
    expect(body.sessions).toHaveLength(4);
  });
});

describe("taking attendance", () => {
  const marks = (s1Status: string, s2Status: string) => [
    { enrollmentId: 1, status: s1Status },
    { enrollmentId: 2, status: s2Status },
  ];

  it("requires every enrolled student to be marked, once, and nobody else", async () => {
    const base = { classDate: today(), startTime: "08:00" };
    const missing = await api("/faculty/offerings/1/sessions", { cookie: profA, body: { ...base, records: [{ enrollmentId: 1, status: "present" }] } });
    expect(missing.status).toBe(400);
    const foreign = await api("/faculty/offerings/1/sessions", { cookie: profA, body: { ...base, records: [...marks("present", "present"), { enrollmentId: 3, status: "present" }] } });
    expect(foreign.status).toBe(400);
    const dup = await api("/faculty/offerings/1/sessions", { cookie: profA, body: { ...base, records: [{ enrollmentId: 1, status: "present" }, { enrollmentId: 1, status: "absent" }] } });
    expect(dup.status).toBe(400);
    const badStatus = await api("/faculty/offerings/1/sessions", { cookie: profA, body: { ...base, records: marks("late", "present") } });
    expect(badStatus.status).toBe(400);
  });

  it("rejects invalid and future dates", async () => {
    for (const classDate of ["2026-02-30", "2099-01-01", "yesterday"]) {
      const res = await api("/faculty/offerings/1/sessions", { cookie: profA, body: { classDate, startTime: "08:00", records: marks("present", "present") } });
      expect(res.status, classDate).toBe(400);
    }
  });

  it("creates a session, updates student totals, and blocks duplicates", async () => {
    const body = { classDate: today(), startTime: "13:30", topic: "Joins", records: marks("present", "present") };
    const created = await api("/faculty/offerings/1/sessions", { cookie: profA, body });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };

    const detail = (await (await api(`/faculty/sessions/${id}`, { cookie: profA })).json()) as SessionDetailResponse;
    expect(detail.session.topic).toBe("Joins");
    expect(detail.records.map((r) => r.status)).toEqual(["present", "present"]);

    const course = (await (await api("/student/courses/1", { cookie: s2 })).json()) as StudentCourseDetailResponse;
    expect(course.course.summary).toEqual({ held: 4, attended: 2, missed: 2, percentage: 50 });

    const again = await api("/faculty/offerings/1/sessions", { cookie: profA, body });
    expect(again.status).toBe(409);

    // Correct a mark, then cancel the session: it must stop counting.
    expect((await api(`/faculty/sessions/${id}`, { method: "PUT", cookie: profA, body: { records: [{ enrollmentId: 2, status: "absent" }] } })).status).toBe(200);
    let s2Course = (await (await api("/student/courses/1", { cookie: s2 })).json()) as StudentCourseDetailResponse;
    expect(s2Course.course.summary).toEqual({ held: 4, attended: 1, missed: 3, percentage: 25 });

    expect((await api(`/faculty/sessions/${id}`, { method: "PUT", cookie: profA, body: { status: "cancelled" } })).status).toBe(200);
    s2Course = (await (await api("/student/courses/1", { cookie: s2 })).json()) as StudentCourseDetailResponse;
    expect(s2Course.course.summary.held).toBe(3);

    expect((await api(`/faculty/sessions/${id}`, { method: "DELETE", cookie: profA })).status).toBe(200);
    expect((await api(`/faculty/sessions/${id}`, { cookie: profA })).status).toBe(404);
  });

  it("leaves dropped students out of the roster and attendance taking, but keeps their history", async () => {
    // Student 3 is in offering 2 (prof B) as enrollment 4. Drop them.
    await env.DB.prepare("UPDATE enrollments SET status = 'dropped' WHERE id = 4").run();
    try {
      const detail = (await (await api("/faculty/offerings/2", { cookie: profB })).json()) as FacultyOfferingDetailResponse;
      expect(detail.students.map((s) => s.enrollmentId)).toEqual([3]);
      expect(detail.offering.enrolledCount).toBe(1);

      const withDropped = await api("/faculty/offerings/2/sessions", {
        cookie: profB,
        body: { classDate: today(), startTime: "07:00", records: [{ enrollmentId: 3, status: "present" }, { enrollmentId: 4, status: "present" }] },
      });
      expect(withDropped.status).toBe(400);

      // Their existing mark in session 5 is still shown on that class.
      const session = (await (await api("/faculty/sessions/5", { cookie: profB })).json()) as SessionDetailResponse;
      expect(session.records.map((r) => r.enrollmentId)).toEqual([3, 4]);
    } finally {
      await env.DB.prepare("UPDATE enrollments SET status = 'enrolled' WHERE id = 4").run();
    }
  });

  it("does not allow changes in a completed semester", async () => {
    const res = await api("/faculty/offerings/3/sessions", { cookie: profA, body: { classDate: today(), startTime: "08:00", records: [{ enrollmentId: 5, status: "present" }] } });
    expect(res.status).toBe(409);
  });
});

describe("database constraints", () => {
  it("prevents duplicate enrollments", async () => {
    await expect(env.DB.prepare("INSERT INTO enrollments (student_id, offering_id) VALUES (1, 1)").run()).rejects.toThrow(/UNIQUE/);
  });

  it("prevents duplicate attendance records for the same session and student", async () => {
    await expect(
      env.DB.prepare("INSERT INTO attendance_records (session_id, enrollment_id, status) VALUES (1, 1, 'present')").run(),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("rejects a record whose enrollment belongs to a different offering", async () => {
    // Session 1 is offering 1; enrollment 4 is offering 2.
    await expect(
      env.DB.prepare("INSERT INTO attendance_records (session_id, enrollment_id, status) VALUES (1, 4, 'present')").run(),
    ).rejects.toThrow(/does not belong/);
  });

  it("rejects invalid statuses and semester numbers", async () => {
    await expect(env.DB.prepare("INSERT INTO attendance_records (session_id, enrollment_id, status) VALUES (2, 2, 'late')").run()).rejects.toThrow(/CHECK/);
    await expect(env.DB.prepare("INSERT INTO semesters (number, academic_year) VALUES (9, '2026-2027')").run()).rejects.toThrow(/CHECK/);
  });
});
