/**
 * A small, dependency-free MCP server (Streamable HTTP, stateless, JSON responses).
 * Claude does all the thinking; these tools only save, read and change trips.
 */
import { applyPatch, normalizeTrip, obj, str } from "./trip";
import type { TripData } from "./types";

export interface Store {
  createTrip(data: TripData): Promise<{ slug: string; editKey: string }>;
  getTrip(slug: string): Promise<{ editKey: string; data: TripData } | null>;
  saveTrip(slug: string, data: TripData): Promise<void>;
  keyMatches(given: unknown, actual: string): boolean;
}

export interface Ctx {
  baseUrl: string;
  store: Store;
}

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

// ---------- tool schemas ----------

const itemSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Keep the existing id when updating." },
    time: { type: "string", description: "e.g. '06:10', 'Morning', 'Overnight'" },
    type: { type: "string", enum: ["travel", "stay", "activity", "food"] },
    title: { type: "string", description: "e.g. 'IndiGo BLR → DEL' or 'Kheerganga trek starts at Barshaini'" },
    notes: { type: "string", description: "Practical tips: duration, what to carry, how to get there." },
    place: { type: "string" },
    est_cost: { type: "number", description: "Estimated cost PER PERSON in INR." },
    link: { type: "string", description: "https link to book or read more." },
  },
  required: ["type", "title"],
};

const daySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    date: { type: "string", description: "YYYY-MM-DD" },
    title: { type: "string", description: "Short theme for the day, e.g. 'Travel day' or 'Kheerganga trek'" },
    items: { type: "array", items: itemSchema },
  },
  required: ["title", "items"],
};

const optionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    category: { type: "string", enum: ["stay", "transport", "activity"] },
    title: { type: "string" },
    price: { type: "string", description: "Human-readable, e.g. '₹700/night per bed'" },
    link: { type: "string" },
    notes: { type: "string", description: "Why it's a good pick: location, vibe, trade-offs." },
  },
  required: ["category", "title"],
};

const bookingSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    what: { type: "string", description: "e.g. 'Flights BLR → DEL for 4'" },
    link: { type: "string" },
  },
  required: ["what"],
};

const tripProperties = {
  title: { type: "string" },
  origin: { type: "string" },
  destination: { type: "string" },
  start_date: { type: "string", description: "YYYY-MM-DD" },
  end_date: { type: "string", description: "YYYY-MM-DD" },
  travellers: { type: "array", items: { type: "string" }, description: "Names, or 'Friend 1'... if unknown" },
  budget_per_person: { type: "number", description: "INR" },
  vibe: { type: "array", items: { type: "string" }, description: "e.g. party, trek, sightseeing, chill, food" },
  notes: { type: "string", description: "Short overview and important tips (permits, weather, cash, network)." },
  days: { type: "array", items: daySchema },
  options: { type: "array", items: optionSchema, description: "Choices the group votes on" },
  bookings: { type: "array", items: bookingSchema, description: "Things someone in the group must book" },
};

const slugProp = { type: "string", description: "The trip id: the part after /t/ in the trip link." };
const keyProp = { type: "string", description: "The edit key: the value of ?key= in the private edit link." };

export const TOOLS = [
  {
    name: "create_trip",
    title: "Create group trip",
    description:
      "Create a shareable group trip plan in TripSquad and get its links. " +
      "BEFORE calling, make sure you know: origin, destination, travel dates, number of travellers (names if given), " +
      "budget per person in INR, preferred way to travel (flight/train/bus) and the vibe (party, sightseeing, trek, chill, food...). " +
      "Ask the user for anything missing in one short message. Use web search if you have it for current transport options, " +
      "stays near the main hotspots and must-visit places. Build a realistic day-by-day plan: travel legs with timings, " +
      "activities grouped by area to minimise back-and-forth, food stops and where the group sleeps each night. " +
      "Put 2-4 stay choices (and transport choices if there's a real decision) in `options` so the group can vote. " +
      "Put everything someone must book in `bookings`. All costs are per-person estimates in INR. " +
      "AFTER calling, give the user BOTH links: the edit link is private to them; the share link is for their friends.",
    inputSchema: {
      type: "object",
      properties: tripProperties,
      required: ["origin", "destination", "days"],
    },
  },
  {
    name: "get_trip",
    title: "Get trip",
    description:
      "Get the latest version of a trip, including the organiser's edits in the app, friends' votes and who is booking what. " +
      "Always call this before update_trip so you work from the current version.",
    inputSchema: { type: "object", properties: { slug: slugProp }, required: ["slug"] },
  },
  {
    name: "update_trip",
    title: "Update trip",
    description:
      "Change an existing trip, e.g. 'add a day in Tosh' or 'make it cheaper'. Send only the top-level fields you want to replace " +
      "(for example the complete new `days` array). Keep the `id` of existing days, items, options and bookings so votes " +
      "and booking claims are kept. Needs the edit key from the private edit link.",
    inputSchema: {
      type: "object",
      properties: { slug: slugProp, edit_key: keyProp, ...tripProperties },
      required: ["slug", "edit_key"],
    },
  },
  {
    name: "add_options",
    title: "Add options to vote on",
    description:
      "Add choices for the group to vote on, e.g. 3 hostels near Chalal or 2 ways to get from Delhi to Kasol. " +
      "Needs the edit key from the private edit link.",
    inputSchema: {
      type: "object",
      properties: {
        slug: slugProp,
        edit_key: keyProp,
        options: { type: "array", items: optionSchema },
      },
      required: ["slug", "edit_key", "options"],
    },
  },
];

// ---------- tool implementations ----------

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: t }], isError: true });

const links = (base: string, slug: string, key: string) => ({
  share_link: `${base}/t/${slug}`,
  edit_link: `${base}/t/${slug}?key=${encodeURIComponent(key)}`,
});

function summary(d: TripData) {
  const items = d.days.reduce((n, day) => n + day.items.length, 0);
  return `${d.days.length} days, ${items} plan items, ${d.options.length} options to vote on, ${d.bookings.length} bookings`;
}

async function loadForEdit(args: Record<string, unknown>, ctx: Ctx) {
  const slug = str(args.slug, 80);
  const trip = slug ? await ctx.store.getTrip(slug) : null;
  if (!trip) return { error: fail(`No trip found with id "${slug}". Check the trip link.`) };
  if (!ctx.store.keyMatches(args.edit_key, trip.editKey))
    return { error: fail("The edit key is wrong. Ask the user for their private edit link (the one with ?key=).") };
  return { slug, trip };
}

export async function callTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  try {
    switch (name) {
      case "create_trip": {
        const data = normalizeTrip(args);
        if (!data.days.length) return fail("A trip needs at least one day in `days`.");
        const { slug, editKey } = await ctx.store.createTrip(data);
        const l = links(ctx.baseUrl, slug, editKey);
        return text(
          `Trip created: ${data.title} (${summary(data)}).\n` +
            `Edit link (private, for the organiser): ${l.edit_link}\n` +
            `Share link (send to the group): ${l.share_link}\n` +
            JSON.stringify({ slug, edit_key: editKey, ...l }),
        );
      }

      case "get_trip": {
        const slug = str(args.slug, 80);
        const trip = slug ? await ctx.store.getTrip(slug) : null;
        if (!trip) return fail(`No trip found with id "${slug}".`);
        return text(JSON.stringify({ slug, share_link: `${ctx.baseUrl}/t/${slug}`, ...trip.data }));
      }

      case "update_trip": {
        const r = await loadForEdit(args, ctx);
        if ("error" in r) return r.error!;
        const { slug: _s, edit_key: _k, ...patch } = args;
        const next = applyPatch(r.trip.data, patch);
        await ctx.store.saveTrip(r.slug, next);
        return text(`Trip updated (${summary(next)}). The app shows the new version at ${ctx.baseUrl}/t/${r.slug}`);
      }

      case "add_options": {
        const r = await loadForEdit(args, ctx);
        if ("error" in r) return r.error!;
        const incoming = Array.isArray(args.options) ? args.options : [];
        if (!incoming.length) return fail("Send at least one option.");
        const next = applyPatch(r.trip.data, { options: [...r.trip.data.options, ...incoming] });
        await ctx.store.saveTrip(r.slug, next);
        return text(`Added ${incoming.length} option(s). The group can vote at ${ctx.baseUrl}/t/${r.slug}`);
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    console.error("tool error", name, err);
    return fail(`Something went wrong on the TripSquad server: ${(err as Error).message}`);
  }
}

// ---------- JSON-RPC ----------

type Rpc = Record<string, unknown> | null;

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
export const rpcError = (id: unknown, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

/** Handle one JSON-RPC message. Returns null for notifications and client responses. */
export async function handleMessage(raw: unknown, ctx: Ctx): Promise<Rpc> {
  const m = obj(raw);
  const id = m.id;
  const method = typeof m.method === "string" ? m.method : undefined;
  if (!method) return id === undefined ? null : rpcError(id ?? null, -32600, "Invalid request");
  if (id === undefined || id === null) return null; // notification, e.g. notifications/initialized

  const params = obj(m.params);
  switch (method) {
    case "initialize": {
      const asked = str(params.protocolVersion, 20);
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "tripsquad", title: "TripSquad", version: "1.0.0" },
        instructions:
          "TripSquad turns your trip plan into a live page the whole group can open, edit, vote on and split bookings. " +
          "Plan the trip in chat, then call create_trip and share the links.",
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call":
      return ok(id, await callTool(str(params.name, 60), obj(params.arguments), ctx));
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
