import { changeTrip } from "@/lib/db";
import { obj, str, updateBooking, type BookingAction } from "@/lib/trip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: BookingAction[] = ["claim", "unclaim", "booked", "todo"];

/** Anyone with the share link can claim a booking. Body: { bookingId, name, action } */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = obj(await req.json().catch(() => null));
  const bookingId = str(body.bookingId, 40);
  const name = str(body.name, 40);
  const action = str(body.action, 20) as BookingAction;
  if (!bookingId || !name || !ACTIONS.includes(action))
    return Response.json({ error: "bookingId, name and a valid action are required" }, { status: 400 });

  const data = await changeTrip(slug, (d) => updateBooking(d, bookingId, name, action));
  if (!data) return Response.json({ error: "Trip not found" }, { status: 404 });
  return Response.json({ data });
}
