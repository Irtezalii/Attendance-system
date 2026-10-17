import type { Context } from "hono";
import type { FacultyOffering } from "../../shared/api";
import type { AppEnv } from "./auth";
import { HttpError } from "./http";
import { getOwnedOffering } from "./queries";

/** Loads an offering assigned to the signed-in professor, or 404s. */
export async function requireOwnedOffering(c: Context<AppEnv>, offeringId: number): Promise<FacultyOffering> {
  const offering = await getOwnedOffering(c.env.DB, c.get("auth").profileId, offeringId);
  if (!offering) throw new HttpError(404, "Course not found.");
  return offering;
}

export function assertEditable(offering: FacultyOffering) {
  if (offering.semester.status === "completed") {
    throw new HttpError(409, "This semester is completed, so its attendance can no longer be changed.");
  }
}
