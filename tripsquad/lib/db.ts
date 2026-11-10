import { neon } from "@neondatabase/serverless";
import { timingSafeEqual } from "crypto";
import { newEditKey, slugFor } from "./trip";
import type { TripData } from "./types";

export interface StoredTrip {
  slug: string;
  editKey: string;
  data: TripData;
  updatedAt: string;
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local or your Vercel project.");
  return neon(url);
}

// Create the table on first use, so there is no separate migration step.
let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) {
    ready = sql()`
      CREATE TABLE IF NOT EXISTS trips (
        slug        TEXT PRIMARY KEY,
        edit_key    TEXT NOT NULL,
        data        JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`.then(
      () => undefined,
      (err) => {
        ready = null;
        throw err;
      },
    );
  }
  return ready;
}

export async function createTrip(data: TripData): Promise<{ slug: string; editKey: string }> {
  await ensureTable();
  const slug = slugFor(data.destination || data.title);
  const editKey = newEditKey();
  await sql()`INSERT INTO trips (slug, edit_key, data) VALUES (${slug}, ${editKey}, ${JSON.stringify(data)}::jsonb)`;
  return { slug, editKey };
}

export async function getTrip(slug: string): Promise<StoredTrip | null> {
  await ensureTable();
  const rows = (await sql()`SELECT slug, edit_key, data, updated_at FROM trips WHERE slug = ${slug}`) as {
    slug: string;
    edit_key: string;
    data: TripData;
    updated_at: string | Date;
  }[];
  const r = rows[0];
  if (!r) return null;
  return { slug: r.slug, editKey: r.edit_key, data: r.data, updatedAt: new Date(r.updated_at).toISOString() };
}

export async function saveTrip(slug: string, data: TripData): Promise<void> {
  await ensureTable();
  await sql()`UPDATE trips SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE slug = ${slug}`;
}

/** Read, change and save a trip. Returns the new data, or null if the trip doesn't exist. */
export async function changeTrip(
  slug: string,
  fn: (data: TripData) => TripData,
): Promise<TripData | null> {
  const trip = await getTrip(slug);
  if (!trip) return null;
  const next = fn(trip.data);
  await saveTrip(slug, next);
  return next;
}

export function keyMatches(given: unknown, actual: string): boolean {
  if (typeof given !== "string" || given.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(actual));
}
