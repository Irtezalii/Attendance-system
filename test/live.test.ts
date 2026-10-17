import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { LiveStateResponse } from "../shared/api";
import { liveMessages } from "../shared/api";
import { api, login, seedFixture } from "./helpers";

// Fixture: offering 1 = CS-1 Morning (prof A; students s1, s2), offering 4 = CS-1 Evening
// (prof A; student s.evening), offering 2 = CS-2 (prof B; s1, s3).
let s1: string;
let s2: string;
let s3: string;
let evening: string;
let profA: string;
let profB: string;

beforeAll(async () => {
  await seedFixture();
  [s1, s2, s3, evening, profA, profB] = await Promise.all([
    login("s1@test.edu"),
    login("s2@test.edu"),
    login("s3@test.edu"),
    login("s.evening@test.edu"),
    login("prof.a@test.edu"),
    login("prof.b@test.edu"),
  ]);
});

const MINUTE = 60_000;
const start = (offering: number, cookie = profA) => api(`/faculty/offerings/${offering}/live/start`, { method: "POST", cookie });
const extend = (offering: number, code: string, cookie = profA) =>
  api(`/faculty/offerings/${offering}/live/extend`, { cookie, body: { code } });
const stop = (offering: number, code: string, cookie = profA) => api(`/faculty/offerings/${offering}/live/stop`, { cookie, body: { code } });
const state = async (offering: number, cookie = profA) =>
  (await (await api(`/faculty/offerings/${offering}/live`, { cookie })).json()) as LiveStateResponse;
const checkIn = (cookie: string, code: string) => api("/student/check-in", { cookie, body: { code } });
const otherCode = (code: string) => String((Number(code) + 1) % 10_000).padStart(4, "0");

describe("live attendance codes", () => {
  let code = "";

  it("starts a session with a 4-digit code valid for 10 minutes, everyone Absent", async () => {
    const res = await start(1);
    expect(res.status).toBe(201);
    const body = (await res.json()) as LiveStateResponse;
    const s = body.session!;
    code = s.code;
    expect(s.code).toMatch(/^\d{4}$/);
    expect(s.status).toBe("active");
    expect(s.expiresAt - s.startedAt).toBe(10 * MINUTE);
    expect(s.identifier).toMatch(/^ATT-\d{2}-\d{2}-\d{4}-morning-.*-cs1-sec-a-2nd-year$/);
    expect([s.presentCount, s.enrolledCount]).toEqual([0, 2]);
    const marks = await env.DB.prepare("SELECT status FROM attendance_records WHERE session_id = ?").bind(s.sessionId).all();
    expect(marks.results.map((r) => r.status)).toEqual(["absent", "absent"]);
  });

  it("refuses a second active code for the same class, including concurrent double clicks", async () => {
    const [a, b] = await Promise.all([start(1), start(1)]);
    expect([a.status, b.status]).toEqual([409, 409]);
    const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM attendance_sessions WHERE offering_id = 1 AND code_status = 'active'").first<{ n: number }>();
    expect(active?.n).toBe(1);
  });

  it("rejects malformed codes and codes that are not this class's active code", async () => {
    expect((await extend(1, "12a4")).status).toBe(400);
    const wrong = otherCode(code);
    const res = await extend(1, wrong);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(liveMessages.notActive(wrong));
  });

  it("extends by exactly 5 minutes, and a refresh returns the same server expiry", async () => {
    const before = (await state(1)).session!;
    const res = await extend(1, code);
    expect(res.status).toBe(200);
    const after = ((await res.json()) as LiveStateResponse).session!;
    expect(after.expiresAt - before.expiresAt).toBe(5 * MINUTE);
    expect((await state(1)).session!.expiresAt).toBe(after.expiresAt);
  });

  it("does not let another professor see or manage the session", async () => {
    expect((await api("/faculty/offerings/1/live", { cookie: profB })).status).toBe(404);
    expect((await extend(1, code, profB)).status).toBe(404);
    expect((await stop(1, code, profB)).status).toBe(404);
    expect((await api("/faculty/offerings/1/live", { cookie: s1 })).status).toBe(403);
  });

  it("records a check-in once and only for students enrolled in that exact offering", async () => {
    const ok = await checkIn(s1, code);
    expect(ok.status).toBe(200);
    expect(JSON.stringify(await ok.json())).not.toContain(code);
    expect((await checkIn(s1, code)).status).toBe(409); // duplicate
    expect((await checkIn(evening, code)).status).toBe(400); // same course, Evening schedule
    expect((await checkIn(s3, code)).status).toBe(400); // not enrolled in CS-1
    const s = (await state(1)).session!;
    expect(s.presentCount).toBe(1);
    expect(s.checkIns.map((c) => c.rollNumber)).toEqual(["R-1"]);
  });

  it("stops immediately: later check-ins, extends and stops are refused, marks are kept", async () => {
    const res = await stop(1, code);
    expect(res.status).toBe(200);
    expect(((await res.json()) as LiveStateResponse).session!.status).toBe("deactivated");
    expect((await checkIn(s2, code)).status).toBe(400);
    expect(((await (await extend(1, code)).json()) as { error: string }).error).toBe(liveMessages.notActive(code));
    expect((await stop(1, code)).status).toBe(409);
    const s = (await state(1)).session!;
    expect([s.status, s.presentCount]).toEqual(["deactivated", 1]);
  });

  it("treats a code as expired from its timestamp alone, then allows a new code", async () => {
    const res = await start(1); // also checks restarting within the same minute works
    expect(res.status).toBe(201);
    const s = ((await res.json()) as LiveStateResponse).session!;
    await env.DB.prepare("UPDATE attendance_sessions SET code_expires_at = ? WHERE id = ?").bind(Date.now() - 1, s.sessionId).run();
    expect((await state(1)).session!.status).toBe("expired");
    expect((await checkIn(s2, s.code)).status).toBe(400);
    expect((await extend(1, s.code)).status).toBe(409);
    expect((await stop(1, s.code)).status).toBe(409);
    const again = await start(1);
    expect(again.status).toBe(201);
    await stop(1, ((await again.json()) as LiveStateResponse).session!.code);
  });

  it("creates exactly one session when two starts race on an idle class", async () => {
    const [a, b] = await Promise.all([start(4), start(4)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const winner = (await (a.status === 201 ? a : b).json()) as LiveStateResponse;
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM attendance_sessions WHERE offering_id = 4 AND code_status = 'active'").first<{ n: number }>();
    expect(n?.n).toBe(1);
    await stop(4, winner.session!.code);
  });

  it("keeps Morning and Evening completely separate", async () => {
    const res = await start(4);
    expect(res.status).toBe(201);
    const s = ((await res.json()) as LiveStateResponse).session!;
    expect(s.identifier).toContain("-evening-");
    expect(s.enrolledCount).toBe(1);
    expect((await checkIn(s1, s.code)).status).toBe(400); // morning student, same course
    expect((await checkIn(evening, s.code)).status).toBe(200);
    const rows = await env.DB.prepare(
      "SELECT r.enrollment_id, r.status FROM attendance_records r WHERE r.session_id = ?",
    ).bind(s.sessionId).all();
    expect(rows.results).toEqual([{ enrollment_id: 6, status: "present" }]);
    await stop(4, s.code);
  });

  it("rate-limits code guessing per student", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await checkIn(s3, String(1000 + i))).status);
    expect(statuses).toContain(429);
  });
});
