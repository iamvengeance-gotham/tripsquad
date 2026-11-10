import { getTrip, keyMatches, saveTrip } from "@/lib/db";
import { keepGroupState, normalizeTrip, obj } from "@/lib/trip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ slug: string }> };

/** Public read: used by the page to refresh votes and bookings. */
export async function GET(_req: Request, { params }: P) {
  const { slug } = await params;
  const trip = await getTrip(slug);
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  return Response.json({ data: trip.data, updatedAt: trip.updatedAt });
}

/** Organiser save from edit mode. Needs the edit key. */
export async function PUT(req: Request, { params }: P) {
  const { slug } = await params;
  const body = obj(await req.json().catch(() => null));
  const trip = await getTrip(slug);
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  if (!keyMatches(body.key, trip.editKey))
    return Response.json({ error: "You need the edit link to change this trip." }, { status: 403 });

  const next = keepGroupState(trip.data, normalizeTrip(body.data));
  await saveTrip(slug, next);
  return Response.json({ data: next });
}
