import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTrip, keyMatches } from "@/lib/db";
import TripView from "./TripView";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ key?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTrip(slug);
  return { title: trip ? `${trip.data.title} · TripSquad` : "Trip not found · TripSquad" };
}

export default async function TripPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { key } = await searchParams;
  const trip = await getTrip(slug);
  if (!trip) notFound();

  const k = Array.isArray(key) ? key[0] : key;
  const editKey = k && keyMatches(k, trip.editKey) ? k : null;

  return <TripView slug={slug} initial={trip.data} editKey={editKey} />;
}
