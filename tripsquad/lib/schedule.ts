/**
 * The time engine. No AI: plain arithmetic.
 * Each item has a duration. Items run one after another from the start of the day;
 * pinned items (flights, bus departures) stay at their clock time.
 * Arrival sets when the arrival day starts; departure sets a "leave by" deadline.
 */
import type { DepartMode, ItemType, TripData, TripItem } from "./types";

export const DEFAULT_DURATION: Record<ItemType, number> = { travel: 120, stay: 30, activity: 120, food: 60 };

/** How long before the way out you need to leave (getting there + check-in). */
export const LEAVE_BUFFER: Record<DepartMode, number> = { flight: 180, train: 60, bus: 45, cab: 30, other: 60 };

export const GAP_MIN = 15; // walking/settling time between plans
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

export interface Slot {
  start: number;
  end: number;
  /** A fixed-time item starts before the previous plan has finished. */
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

export function scheduleDay(t: TripData, di: number): DaySchedule {
  const day = t.days[di];
  if (!day) return { slots: [] };

  const dayStart = toMin(normTime(t.day_start) ?? DEFAULT_DAY_START);
  const arriveAt = arrivalDayIndex(t) === di ? toMin(normTime(t.arrive!.time)!) : undefined;
  const isDep = departureDayIndex(t) === di;
  const departAt = isDep ? toMin(normTime(t.depart!.time)!) : undefined;
  const leaveBy = departAt != null ? departAt - LEAVE_BUFFER[t.depart?.mode ?? "other"] : undefined;

  const base = arriveAt != null ? arriveAt + SETTLE_MIN : dayStart;
  let cursor: number | null = null;

  const slots = day.items.map((it) => {
    const dur = durationOf(it);
    let start: number;
    let clash = false;
    if (isPinned(it)) {
      start = toMin(normTime(it.time)!);
      clash = cursor != null && start < cursor - GAP_MIN;
    } else {
      start = cursor == null ? base : Math.max(cursor, base);
    }
    const end = start + dur;
    cursor = Math.max(cursor ?? 0, end + GAP_MIN);
    const late = leaveBy != null && !isPinned(it) && end > leaveBy;
    return { start, end, clash, late };
  });

  return { slots, arriveAt, leaveBy, departAt };
}

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
