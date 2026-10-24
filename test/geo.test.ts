import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { ApiError, LiveStateResponse } from "../shared/api";
import { LOCATION_REQUIRED_DETAIL } from "../shared/api";
import { api, login, seedFixture } from "./helpers";

// Fixture: offering 1 = CS-1 Morning (prof A; s1, s2); offering 4 = CS-1 Evening (prof A; s.evening).
// Campus box (wrangler vars): 200 m north/south/east/west of the UBIT point.
let s1: string;
let s2: string;
let evening: string;
let profA: string;

beforeAll(async () => {
  await seedFixture();
  [s1, s2, evening, profA] = await Promise.all([
    login("s1@test.edu"),
    login("s2@test.edu"),
    login("s.evening@test.edu"),
    login("prof.a@test.edu"),
  ]);
});

const LAT = Number(env.CAMPUS_LAT);
const LNG = Number(env.CAMPUS_LNG);
const M_LAT = 1 / 111_320; // degrees per metre north
const M_LNG = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180)); // degrees per metre east
const at = (northM: number, eastM: number, accuracy = 15) => ({ lat: LAT + northM * M_LAT, lng: LNG + eastM * M_LNG, accuracy });

const start = (offering: number, body?: object) =>
  api(`/faculty/offerings/${offering}/live/start`, body ? { cookie: profA, body } : { method: "POST", cookie: profA });
const checkIn = (cookie: string, body: object) => api("/student/check-in", { cookie, body });
const rejections = () =>
  env.DB.prepare("SELECT e.student_id, cr.reason, cr.distance_m FROM checkin_rejections cr JOIN enrollments e ON e.id = cr.enrollment_id ORDER BY cr.id").all<{
    student_id: number;
    reason: string;
    distance_m: number | null;
  }>();

describe("campus location check (box around UBIT)", () => {
  let code = "";

  it("starts without needing the professor's location", async () => {
    const res = await start(1, { requireLocation: true });
    expect(res.status).toBe(201);
    const s = ((await res.json()) as LiveStateResponse).session!;
    code = s.code;
    expect(s.geo).toEqual({ areaName: "UBIT", halfSizeM: 200 });
  });

  it("asks for a location without logging a rejection", async () => {
    const res = await checkIn(s2, { code });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).details?.[LOCATION_REQUIRED_DETAIL]).toEqual(["required"]);
    expect((await rejections()).results).toEqual([]);
  });

  it("refuses and logs: no location, outside the box, too imprecise", async () => {
    expect((await checkIn(s2, { code, location: null })).status).toBe(400);
    const outside = await checkIn(s2, { code, location: at(220, 0) }); // 20 m past the north edge
    expect(outside.status).toBe(400);
    expect(((await outside.json()) as ApiError).error).toMatch(/about 20 m outside the UBIT area/);
    expect((await checkIn(s1, { code, location: at(0, 0, 250) })).status).toBe(400);
    expect((await rejections()).results.map((r) => [r.student_id, r.reason, r.distance_m === null ? null : Math.round(r.distance_m)])).toEqual([
      [2, "no_location", null],
      [2, "out_of_range", 20],
      [1, "imprecise", 0],
    ]);
  });

  it("accepts anywhere inside the square, including near a corner", async () => {
    // 190 m north and 190 m east: inside the box (a 200 m circle would reject this, ~269 m).
    expect((await checkIn(s1, { code, location: at(190, 190) })).status).toBe(200);
    expect((await checkIn(s1, { code, location: at(190, 190) })).status).toBe(409);
  });

  it("shows the professor who is on campus and the latest refusal per absent student", async () => {
    const s = ((await (await api("/faculty/offerings/1/live", { cookie: profA })).json()) as LiveStateResponse).session!;
    expect(s.checkIns.map((c) => [c.rollNumber, c.distanceM])).toEqual([["R-1", 0]]);
    expect(s.rejections.map((r) => [r.rollNumber, r.reason, r.distanceM])).toEqual([["R-2", "out_of_range", 20]]);
  });

  it("refuses a student far away (west), measured to the box edge", async () => {
    const res = await checkIn(s2, { code, location: at(0, -1200) });
    expect(((await res.json()) as ApiError).error).toMatch(/about 1000 m outside/);
  });

  it("tells students outside the class nothing about the location check", async () => {
    const res = await checkIn(evening, { code, location: at(0, 0) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toBe("This code is not valid for any of your classes right now.");
    expect((await rejections()).results).toHaveLength(4);
    await api("/faculty/offerings/1/live/stop", { cookie: profA, body: { code } });
  });

  it("keeps the location check off by default", async () => {
    const res = await start(4);
    expect(res.status).toBe(201);
    const s = ((await res.json()) as LiveStateResponse).session!;
    expect(s.geo).toBeNull();
    expect((await checkIn(evening, { code: s.code })).status).toBe(200);
  });
});
