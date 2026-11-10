import * as db from "@/lib/db";
import { handleMessage, rpcError, type Ctx } from "@/lib/mcp";
import { baseUrlFrom } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  const ctx: Ctx = { baseUrl: baseUrlFrom(req), store: db };

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }

  const out = await handleMessage(body, ctx);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
}

// This server is stateless and doesn't open server-to-client streams.
export async function GET() {
  return new Response("TripSquad MCP endpoint. Use POST (Streamable HTTP).", {
    status: 405,
    headers: { Allow: "POST", ...CORS },
  });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST", ...CORS } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
