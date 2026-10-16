import { Hono } from "hono";
import { z } from "zod";
import type { MeResponse, Role } from "../../shared/api";
import { endSession, requireAuth, startSession, type AppEnv } from "../lib/auth";
import { HttpError, parseBody } from "../lib/http";
import { DUMMY_HASH, verifyPassword } from "../lib/password";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const authRoutes = new Hono<AppEnv>()
  .post("/login", async (c) => {
    const { email, password } = await parseBody(c, loginSchema);

    const ip = c.req.header("CF-Connecting-IP") ?? "local";
    const { success } = await c.env.LOGIN_LIMITER.limit({ key: `${ip}:${email}` });
    if (!success) throw new HttpError(429, "Too many sign-in attempts. Please wait a minute and try again.");

    const user = await c.env.DB.prepare(
      "SELECT id, password_hash, status FROM users WHERE email = ?",
    )
      .bind(email)
      .first<{ id: number; password_hash: string; status: string }>();

    // Always run a hash comparison so timing does not reveal whether the email exists.
    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid || user.status !== "active") {
      throw new HttpError(401, "Invalid email or password.");
    }

    await startSession(c, user.id);
    return c.json({ ok: true });
  })
  .post("/logout", async (c) => {
    await endSession(c);
    return c.json({ ok: true });
  })
  .get("/me", requireAuth(), async (c) => {
    const auth = c.get("auth");
    const db = c.env.DB;
    let profile: MeResponse["profile"];

    if (auth.role === "student") {
      const row = await db
        .prepare(
          `SELECT st.name, st.roll_number, st.current_semester, p.code AS program_code, p.name AS program_name
             FROM students st JOIN programs p ON p.id = st.program_id WHERE st.id = ?`,
        )
        .bind(auth.profileId)
        .first<{ name: string; roll_number: string; current_semester: number; program_code: string; program_name: string }>();
      if (!row) throw new HttpError(401, "Please sign in to continue.");
      profile = {
        kind: "student",
        name: row.name,
        email: auth.email,
        rollNumber: row.roll_number,
        currentSemester: row.current_semester,
        program: { code: row.program_code, name: row.program_name },
      };
    } else {
      const row = await db
        .prepare("SELECT name, employee_id, designation FROM faculty WHERE id = ?")
        .bind(auth.profileId)
        .first<{ name: string; employee_id: string; designation: string }>();
      if (!row) throw new HttpError(401, "Please sign in to continue.");
      profile = {
        kind: "faculty",
        name: row.name,
        email: auth.email,
        employeeId: row.employee_id,
        designation: row.designation,
      };
    }

    const body: MeResponse = { user: { id: auth.userId, email: auth.email, role: auth.role as Role }, profile };
    return c.json(body);
  });
