import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role } from "../../shared/api";
import { HttpError } from "./http";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  userId: number;
  email: string;
  role: Role;
  /** students.id for students, faculty.id for faculty. */
  profileId: number;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: AuthUser };
};

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isHttps(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

// Over HTTPS the cookie uses the __Host- prefix: browsers only accept it when it is
// Secure, has Path=/ and no Domain, so a subdomain or plain-HTTP page cannot plant or
// overwrite it. Local development over http://localhost falls back to a plain name.
function sessionCookieName(c: Context): string {
  return isHttps(c) ? "__Host-sid" : "sid";
}

function cookieOptions(c: Context) {
  return {
    httpOnly: true,
    secure: isHttps(c),
    sameSite: "Lax" as const,
    path: "/",
  };
}

export async function startSession(c: Context<AppEnv>, userId: number): Promise<void> {
  const token = randomToken();
  const now = Date.now();
  const db = c.env.DB;
  const previous = getCookie(c, sessionCookieName(c));
  await db.batch([
    // Cleanup of expired sessions (indexed on expires_at).
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    // Signing in again revokes the session this browser had before.
    ...(previous ? [db.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256Hex(previous))] : []),
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(
      await sha256Hex(token),
      userId,
      now + SESSION_TTL_MS,
    ),
  ]);
  setCookie(c, sessionCookieName(c), token, { ...cookieOptions(c), maxAge: SESSION_TTL_MS / 1000 });
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, sessionCookieName(c));
  if (token) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256Hex(token)).run();
  }
  deleteCookie(c, sessionCookieName(c), cookieOptions(c));
}

async function loadAuthUser(c: Context<AppEnv>): Promise<AuthUser | null> {
  const token = getCookie(c, sessionCookieName(c));
  if (!token || token.length > 100) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id AS user_id, u.email, u.role, st.id AS student_id, f.id AS faculty_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN students st ON st.user_id = u.id
       LEFT JOIN faculty f ON f.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'
        -- A faculty profile marked inactive also blocks sign-in.
        AND (u.role <> 'faculty' OR f.status = 'active')`,
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ user_id: number; email: string; role: Role; student_id: number | null; faculty_id: number | null }>();
  if (!row) return null;
  const profileId = row.role === "student" ? row.student_id : row.faculty_id;
  // A user whose profile row is missing cannot use the app.
  if (profileId === null) return null;
  return { userId: row.user_id, email: row.email, role: row.role, profileId };
}

/** Requires a valid session; optionally restricts to one role. */
export function requireAuth(role?: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = await loadAuthUser(c);
    if (!auth) throw new HttpError(401, "Please sign in to continue.");
    if (role && auth.role !== role) throw new HttpError(403, "You do not have access to this page.");
    c.set("auth", auth);
    await next();
  };
}

/**
 * CSRF protection for state-changing requests. The session cookie is SameSite=Lax,
 * and on top of that we reject any unsafe request whose Origin (or Sec-Fetch-Site)
 * shows it came from another site, and require JSON bodies (which cross-site forms
 * cannot send without a CORS preflight, which this API never allows).
 */
export const csrfProtection: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  const origin = c.req.header("Origin");
  if (origin !== undefined) {
    if (origin !== new URL(c.req.url).origin) throw new HttpError(403, "Cross-site request blocked.");
  } else if (c.req.header("Sec-Fetch-Site") === "cross-site") {
    throw new HttpError(403, "Cross-site request blocked.");
  }

  const length = c.req.header("Content-Length");
  const hasBody = (length !== undefined && length !== "0") || c.req.header("Transfer-Encoding") !== undefined;
  if (hasBody && !c.req.header("Content-Type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Requests must be sent as JSON.");
  }
  await next();
};
