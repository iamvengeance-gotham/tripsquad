import { createTrip } from "@/lib/db";
import { SAMPLE_TRIP } from "@/lib/sample";
import { normalizeTrip } from "@/lib/trip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates a fresh copy of the sample trip and opens it in edit mode. */
export async function GET(req: Request) {
  const { slug, editKey } = await createTrip(normalizeTrip(SAMPLE_TRIP));
  return Response.redirect(new URL(`/t/${slug}?key=${encodeURIComponent(editKey)}`, req.url), 303);
}
