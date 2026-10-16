import { Hono } from "hono";
import { z } from "zod";
import type { FacultyCategory, MeResponse } from "../../shared/api";
import { endSession, requireAuth, startSession, type AppEnv } from "../lib/auth";
import { HttpError, parseBody } from "../lib/http";
import { DUMMY_HASH, verifyPassword } from "../lib/password";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

const TOO_MANY = "Too many sign-in attempts. Please wait a minute and try again.";

export const authRoutes = new Hono<AppEnv>()
  .post("/login", async (c) => {
    const { email, password } = await parseBody(c, loginSchema);

    // Two limits: per IP + account (guessing one password), and per IP (spraying many accounts).
    const ip = c.req.header("CF-Connecting-IP") ?? "local";
    const [account, client] = await Promise.all([
      c.env.LOGIN_LIMITER.limit({ key: `${ip}:${email}` }),
      c.env.LOGIN_IP_LIMITER.limit({ key: ip }),
    ]);
    if (!account.success || !client.success) throw new HttpError(429, TOO_MANY);

    // Role comes from the account itself; the client never chooses it. A faculty
    // account also needs an active faculty profile.
    const user = await c.env.DB.prepare(
      `SELECT u.id, u.password_hash,
         (u.status = 'active' AND (u.role <> 'faculty' OR f.status = 'active')) AS can_sign_in
         FROM users u LEFT JOIN faculty f ON f.user_id = u.id
        WHERE u.email = ?`,
    )
      .bind(email)
      .first<{ id: number; password_hash: string; can_sign_in: number }>();

    // Always run a hash comparison so timing does not reveal whether the email exists.
    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid || !user.can_sign_in) {
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
          `SELECT st.name, st.roll_number, st.current_semester,
             p.code AS programme_code, p.name AS programme_name, p.semester_count
             FROM students st JOIN programmes p ON p.id = st.programme_id WHERE st.id = ?`,
        )
        .bind(auth.profileId)
        .first<{
          name: string;
          roll_number: string;
          current_semester: number;
          programme_code: string;
          programme_name: string;
          semester_count: number;
        }>();
      if (!row) throw new HttpError(401, "Please sign in to continue.");
      profile = {
        kind: "student",
        name: row.name,
        email: auth.email,
        rollNumber: row.roll_number,
        currentSemester: row.current_semester,
        programme: { code: row.programme_code, name: row.programme_name, semesterCount: row.semester_count },
      };
    } else {
      const row = await db
        .prepare(
          `SELECT name, employee_id, designation, department, category, email,
             qualifications, research_interests
             FROM faculty WHERE id = ?`,
        )
        .bind(auth.profileId)
        .first<{
          name: string;
          employee_id: string | null;
          designation: string | null;
          department: string;
          category: FacultyCategory;
          email: string | null;
          qualifications: string | null;
          research_interests: string | null;
        }>();
      if (!row) throw new HttpError(401, "Please sign in to continue.");
      profile = {
        kind: "faculty",
        name: row.name,
        email: auth.email,
        employeeId: row.employee_id,
        designation: row.designation,
        department: row.department,
        category: row.category,
        officialEmail: row.email && row.email.toLowerCase() !== auth.email.toLowerCase() ? row.email : null,
        qualifications: row.qualifications,
        researchInterests: row.research_interests,
      };
    }

    const body: MeResponse = { user: { id: auth.userId, email: auth.email, role: auth.role }, profile };
    return c.json(body);
  });
