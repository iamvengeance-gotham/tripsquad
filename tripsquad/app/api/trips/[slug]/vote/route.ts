import { changeTrip } from "@/lib/db";
import { obj, str, toggleVote } from "@/lib/trip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anyone with the share link can vote. Body: { optionId, name } */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = obj(await req.json().catch(() => null));
  const optionId = str(body.optionId, 40);
  const name = str(body.name, 40);
  if (!optionId || !name) return Response.json({ error: "optionId and name are required" }, { status: 400 });

  const data = await changeTrip(slug, (d) => toggleVote(d, optionId, name));
  if (!data) return Response.json({ error: "Trip not found" }, { status: 404 });
  return Response.json({ data });
}
