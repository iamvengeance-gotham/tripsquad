export const ITEM_TYPES = ["travel", "stay", "activity", "food"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const OPTION_CATEGORIES = ["stay", "transport", "activity"] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

export const LOCAL_MODES = ["cab", "scooter", "walk"] as const;
export type LocalMode = (typeof LOCAL_MODES)[number];

export const DEPART_MODES = ["flight", "train", "bus", "cab", "other"] as const;
export type DepartMode = (typeof DEPART_MODES)[number];

export interface TripItem {
  id: string;
  type: ItemType;
  title: string;
  /** How long it takes, in minutes. Times are worked out from this. */
  duration_min?: number;
  /** true = happens at a fixed clock time (flight, bus departure, booked slot). */
  pinned?: boolean;
  /** "HH:MM" (24h). Only used when pinned. */
  time?: string;
  notes?: string;
  place?: string;
  /** Where it starts (decimal degrees). Used for travel time and the map. */
  lat?: number;
  lng?: number;
  /** Where you end up, for things that move you (travel legs, treks). */
  to_lat?: number;
  to_lng?: number;
  /** Estimated cost per person, INR */
  est_cost?: number;
  link?: string;
}

export interface TripDay {
  id: string;
  date?: string;
  title: string;
  items: TripItem[];
}

export interface TripOption {
  id: string;
  category: OptionCategory;
  title: string;
  price?: string;
  link?: string;
  notes?: string;
  votes: string[];
}

export interface Booking {
  id: string;
  what: string;
  link?: string;
  owner?: string;
  status: "todo" | "booked";
}

export interface Arrival {
  date?: string;
  time?: string;
}

export interface Departure {
  date?: string;
  time?: string;
  mode?: DepartMode;
  /** Where the way out leaves from, e.g. "Bhuntar airport" or "Kasol bus stand" */
  from?: string;
}

export interface TripData {
  title: string;
  origin: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  travellers: { name: string }[];
  budget_per_person?: number;
  vibe: string[];
  notes?: string;
  /** How the group gets around locally. Sets travel speed between places. */
  local_transport?: LocalMode;
  /** "HH:MM" when a normal day starts. Default 09:00. */
  day_start?: string;
  /** When the group reaches the destination. */
  arrive?: Arrival;
  /** When the group's way out (return flight/bus/train) leaves. */
  depart?: Departure;
  days: TripDay[];
  options: TripOption[];
  bookings: Booking[];
}
