import type { Context } from "hono";
import type { z } from "zod";

export class HttpError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429;
  readonly details?: Record<string, string[]>;

  constructor(status: HttpError["status"], message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function issuesToDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/** Parses and validates a JSON body, throwing a 400 with field details on failure. */
export async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(400, "Some fields are invalid.", issuesToDetails(result.error));
  return result.data;
}

/** Parses a positive integer route parameter. Invalid IDs are treated as not found. */
export function idParam(c: Context, name: string): number {
  const value = c.req.param(name);
  if (!value || !/^[1-9][0-9]{0,15}$/.test(value)) throw new HttpError(404, "Not found.");
  return Number(value);
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
