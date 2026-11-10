export const ITEM_TYPES = ["travel", "stay", "activity", "food"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const OPTION_CATEGORIES = ["stay", "transport", "activity"] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

export interface TripItem {
  id: string;
  time?: string;
  type: ItemType;
  title: string;
  notes?: string;
  place?: string;
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
  days: TripDay[];
  options: TripOption[];
  bookings: Booking[];
}
