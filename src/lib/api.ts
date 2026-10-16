import type { ApiError } from "../../shared/api";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Fired when the server says the session is gone, so the app can return to login. */
export const SESSION_EXPIRED_EVENT = "attendance:session-expired";

export async function apiRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError(0, "Could not reach the server. Check your connection and try again.");
  }

  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const error = data as ApiError | null;
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/me") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiRequestError(res.status, error?.error ?? `Request failed (${res.status}).`, error?.details);
  }
  return data as T;
}
