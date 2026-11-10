/**
 * The time engine. No AI: plain arithmetic.
 * Each item has a duration. Items run one after another from the start of the day;
 * pinned items (flights, bus departures) stay at their clock time.
 * Arrival sets when the arrival day starts; departure sets a "leave by" deadline.
 */
import type { DepartMode, ItemType, LocalMode, TripData, TripItem } from "./types";

export const DEFAULT_DURATION: Record<ItemType, number> = { travel: 120, stay: 30, activity: 120, food: 60 };

/** How long before the way out you need to leave (getting there + check-in). */
export const LEAVE_BUFFER: Record<DepartMode, number> = { flight: 180, train: 60, bus: 45, cab: 30, other: 60 };

export const GAP_MIN = 10; // buffer between plans at the same place (or when we don't know where)
export const SETTLE_MIN = 30; // freshen up after arriving
export const DEFAULT_DAY_START = "09:00";

export function normTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** 1450 -> "00:10 +1" */
export function fmtMin(total: number): string {
  const dayOffset = Math.floor(total / 1440);
  const m = ((total % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return dayOffset > 0 ? `${s} +${dayOffset}` : dayOffset < 0 ? `${s} (prev day)` : s;
}

export function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const durationOf = (it: TripItem) => it.duration_min ?? DEFAULT_DURATION[it.type];
export const isPinned = (it: TripItem) => !!it.pinned && !!normTime(it.time);

export function arrivalDayIndex(t: TripData): number {
  if (!normTime(t.arrive?.time)) return -1;
  if (t.arrive?.date) return t.days.findIndex((d) => d.date === t.arrive!.date);
  return t.days.length ? 0 : -1;
}

export function departureDayIndex(t: TripData): number {
  if (!normTime(t.depart?.time)) return -1;
  if (t.depart?.date) return t.days.findIndex((d) => d.date === t.depart!.date);
  return t.days.length - 1;
}

// ---------- distance & travel time ----------

type Point = { lat: number; lng: number; name?: string };

export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Roads wind: real road distance is roughly 1.35x the straight line. */
export const ROAD_FACTOR = 1.35;
export const SPEED_KMH: Record<LocalMode, number> = { cab: 22, scooter: 28, walk: 4.5 };
const up5 = (m: number) => Math.max(5, Math.ceil(m / 5) * 5);

export interface Commute {
  min: number;
  km: number;
  how: LocalMode;
  from?: string;
}

/** Travel time between two points. Short hops are walked; longer ones use the trip's local transport. */
export function commuteBetween(a: Point, b: Point, mode: LocalMode = "cab"): Commute | null {
  const km = distanceKm(a, b);
  if (km < 0.15) return null; // same spot
  const road = km * ROAD_FACTOR;
  const round = (x: number) => Math.round(x * 10) / 10;
  if (mode === "walk" || road <= 1.2) return { min: up5((road / SPEED_KMH.walk) * 60), km: round(road), how: "walk", from: a.name };
  return { min: up5((road / SPEED_KMH[mode]) * 60 + 5), km: round(road), how: mode, from: a.name };
}

const startPoint = (it: TripItem): Point | null =>
  it.lat != null && it.lng != null ? { lat: it.lat, lng: it.lng, name: it.place ?? it.title } : null;

const endPoint = (it: TripItem): Point | null =>
  it.to_lat != null && it.to_lng != null ? { lat: it.to_lat, lng: it.to_lng, name: it.place ?? it.title } : null;

// ---------- schedule ----------

export interface Slot {
  start: number;
  end: number;
  /** Travel from the previous place, before this plan starts. */
  commute?: Commute;
  /** A fixed-time item starts before you can get there from the previous plan. */
  clash: boolean;
  /** Ends after the group needs to leave for the way out. */
  late: boolean;
}

export interface DaySchedule {
  slots: Slot[];
  /** Minute the group reaches the destination (arrival day only). */
  arriveAt?: number;
  /** Minute the group must leave (departure day only). */
  leaveBy?: number;
  /** Minute the way out departs (departure day only). */
  departAt?: number;
}

/**
 * Works out every day in order, carrying "where the group is" from one plan to the next
 * (and overnight, from the last stay or travel leg into the next morning).
 */
export function scheduleTrip(t: TripData): DaySchedule[] {
  const dayStart = toMin(normTime(t.day_start) ?? DEFAULT_DAY_START);
  const arrIdx = arrivalDayIndex(t);
  const depIdx = departureDayIndex(t);
  const mode = t.local_transport ?? "cab";
  let here: Point | null = null;

  return t.days.map((day, di) => {
    const arriveAt = arrIdx === di ? toMin(normTime(t.arrive!.time)!) : undefined;
    const departAt = depIdx === di ? toMin(normTime(t.depart!.time)!) : undefined;
    const leaveBy = departAt != null ? departAt - LEAVE_BUFFER[t.depart?.mode ?? "other"] : undefined;
    const base = arriveAt != null ? arriveAt + SETTLE_MIN : dayStart;
    let prevEnd: number | null = null;

    const slots = day.items.map((it): Slot => {
      const dur = durationOf(it);
      const from = startPoint(it);
      const commute = here && from ? commuteBetween(here, from, mode) ?? undefined : undefined;
      const travel = commute?.min ?? 0;

      let start: number;
      let clash = false;
      if (isPinned(it)) {
        start = toMin(normTime(it.time)!);
        clash = prevEnd != null && start < prevEnd + travel;
      } else if (prevEnd == null) {
        start = base + travel;
      } else {
        start = Math.max(prevEnd + (commute ? travel : GAP_MIN), base);
      }
      const end = start + dur;
      prevEnd = Math.max(prevEnd ?? 0, end);

      // Where the group is after this plan. A travel leg with no location means we don't know any more.
      here = endPoint(it) ?? from ?? (it.type === "travel" ? null : here);

      const late = leaveBy != null && !isPinned(it) && end > leaveBy;
      return { start, end, commute, clash, late };
    });

    return { slots, arriveAt, leaveBy, departAt };
  });
}

export const scheduleDay = (t: TripData, di: number): DaySchedule => scheduleTrip(t)[di] ?? { slots: [] };

/** Best guess for the arrival date: the first day that doesn't start with travel. */
export function guessArrivalDate(t: TripData): string | undefined {
  const d = t.days.find((day) => day.items[0] && day.items[0].type !== "travel") ?? t.days[0];
  return d?.date ?? t.start_date;
}

/** Best guess for the departure date: the last day that doesn't end with travel. */
export function guessDepartureDate(t: TripData): string | undefined {
  const d =
    [...t.days].reverse().find((day) => day.items.length && day.items[day.items.length - 1].type !== "travel") ??
    t.days[t.days.length - 1];
  return d?.date ?? t.end_date;
}
