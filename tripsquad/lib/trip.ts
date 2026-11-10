import { randomBytes } from "crypto";
import {
  ITEM_TYPES,
  OPTION_CATEGORIES,
  type Booking,
  type TripData,
  type TripDay,
  type TripItem,
  type TripOption,
} from "./types";

// ---------- small, defensive helpers (input comes from Claude or the browser) ----------

export const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const str = (v: unknown, max = 500): string =>
  typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";

const opt = (v: unknown, max = 500): string | undefined => str(v, max) || undefined;

const num = (v: unknown): number | undefined => {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

function pick<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  const s = str(v).toLowerCase();
  return (list as readonly string[]).includes(s) ? (s as T) : fallback;
}

/** Only allow http(s) links, so nobody can inject javascript: URLs. */
const safeUrl = (v: unknown): string | undefined => {
  const s = str(v, 1000);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
};

export const newId = () => randomBytes(4).toString("hex");

// ---------- normalisation ----------

function normItem(v: unknown): TripItem {
  const r = obj(v);
  return {
    id: str(r.id, 40) || newId(),
    time: opt(r.time, 30),
    type: pick(r.type, ITEM_TYPES, "activity"),
    title: str(r.title, 160) || "Untitled",
    notes: opt(r.notes, 1000),
    place: opt(r.place, 120),
    est_cost: num(r.est_cost),
    link: safeUrl(r.link),
  };
}

function normDay(v: unknown, i: number): TripDay {
  const r = obj(v);
  return {
    id: str(r.id, 40) || newId(),
    date: opt(r.date, 20),
    title: str(r.title, 120) || `Day ${i + 1}`,
    items: arr(r.items).slice(0, 40).map(normItem),
  };
}

function normOption(v: unknown): TripOption {
  const r = obj(v);
  return {
    id: str(r.id, 40) || newId(),
    category: pick(r.category, OPTION_CATEGORIES, "stay"),
    title: str(r.title, 160) || "Option",
    price: opt(r.price, 60),
    link: safeUrl(r.link),
    notes: opt(r.notes, 600),
    votes: [...new Set(arr(r.votes).map((x) => str(x, 40)).filter(Boolean))].slice(0, 50),
  };
}

function normBooking(v: unknown): Booking {
  const r = typeof v === "string" ? { what: v } : obj(v);
  return {
    id: str(r.id, 40) || newId(),
    what: str(r.what, 160) || "Something to book",
    link: safeUrl(r.link),
    owner: opt(r.owner, 40),
    status: str(r.status) === "booked" ? "booked" : "todo",
  };
}

export function normalizeTrip(raw: unknown): TripData {
  const r = obj(raw);
  const destination = str(r.destination, 80);
  return {
    title: str(r.title, 120) || (destination ? `${destination} trip` : "Our trip"),
    origin: str(r.origin, 80),
    destination,
    start_date: opt(r.start_date, 20),
    end_date: opt(r.end_date, 20),
    travellers: arr(r.travellers)
      .map((t) => ({ name: typeof t === "string" ? str(t, 40) : str(obj(t).name, 40) }))
      .filter((t) => t.name)
      .slice(0, 30),
    budget_per_person: num(r.budget_per_person),
    vibe: arr(r.vibe).map((v) => str(v, 30)).filter(Boolean).slice(0, 10),
    notes: opt(r.notes, 2000),
    days: arr(r.days).slice(0, 30).map(normDay),
    options: arr(r.options).slice(0, 50).map(normOption),
    bookings: arr(r.bookings).slice(0, 50).map(normBooking),
  };
}

/**
 * Votes and booking claims come from friends, not from the organiser or Claude.
 * When the organiser (or Claude) saves a new version, keep the group's votes and
 * claims for any option/booking that still exists.
 */
export function keepGroupState(prev: TripData, next: TripData): TripData {
  const prevOpts = new Map(prev.options.map((o) => [o.id, o]));
  const prevBookings = new Map(prev.bookings.map((b) => [b.id, b]));
  return {
    ...next,
    options: next.options.map((o) => {
      const p = prevOpts.get(o.id);
      return p ? { ...o, votes: p.votes } : o;
    }),
    bookings: next.bookings.map((b) => {
      const p = prevBookings.get(b.id);
      return p ? { ...b, owner: p.owner, status: p.status } : b;
    }),
  };
}

/** Replace only the top-level fields present in `patch`. */
export function applyPatch(prev: TripData, patch: Record<string, unknown>): TripData {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return keepGroupState(prev, normalizeTrip({ ...prev, ...defined }));
}

export function toggleVote(data: TripData, optionId: string, name: string): TripData {
  const who = name.toLowerCase();
  return {
    ...data,
    options: data.options.map((o) => {
      if (o.id !== optionId) return o;
      const has = o.votes.some((v) => v.toLowerCase() === who);
      return { ...o, votes: has ? o.votes.filter((v) => v.toLowerCase() !== who) : [...o.votes, name] };
    }),
  };
}

export type BookingAction = "claim" | "unclaim" | "booked" | "todo";

export function updateBooking(
  data: TripData,
  bookingId: string,
  name: string,
  action: BookingAction,
): TripData {
  return {
    ...data,
    bookings: data.bookings.map((b) => {
      if (b.id !== bookingId) return b;
      switch (action) {
        case "claim":
          return { ...b, owner: name };
        case "unclaim":
          return { ...b, owner: undefined, status: "todo" };
        case "booked":
          return { ...b, owner: b.owner || name, status: "booked" };
        case "todo":
          return { ...b, status: "todo" };
      }
    }),
  };
}

export function slugFor(destination: string): string {
  const base =
    destination
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "trip";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export const newEditKey = () => randomBytes(12).toString("base64url");
