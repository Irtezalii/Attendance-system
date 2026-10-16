import { Hono } from "hono";
import type { ApiError } from "../shared/api";
import { csrfProtection, type AppEnv } from "./lib/auth";
import { HttpError } from "./lib/http";
import { authRoutes } from "./routes/auth";
import { facultyRoutes } from "./routes/faculty";
import { studentRoutes } from "./routes/student";

// Static assets (the React app) are served by Workers Static Assets before this Worker
// runs; only /api/* and unmatched paths reach it.
const app = new Hono<AppEnv>().basePath("/api");

app.use(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
});
app.use(csrfProtection);

app.route("/auth", authRoutes);
app.route("/student", studentRoutes);
app.route("/faculty", facultyRoutes);

app.notFound((c) => c.json<ApiError>({ error: "Not found." }, 404));

app.onError((error, c) => {
  if (error instanceof HttpError) {
    return c.json<ApiError>({ error: error.message, details: error.details }, error.status);
  }
  console.error("Unhandled API error", error);
  return c.json<ApiError>({ error: "Something went wrong. Please try again." }, 500);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
