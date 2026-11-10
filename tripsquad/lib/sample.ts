/**
 * A sample trip, shaped exactly like what Claude sends to create_trip.
 * Used by the "Try a sample trip" button. Arrival/exit times are left out on purpose,
 * so the organiser is asked for them when the page opens.
 */
export const SAMPLE_TRIP = {
  title: "Kasol with the boys",
  origin: "Bangalore",
  destination: "Kasol",
  start_date: "2026-12-12",
  end_date: "2026-12-17",
  travellers: ["Aman", "Rahul", "Karan", "Vikram"],
  budget_per_person: 18000,
  vibe: ["party", "trek", "cafes"],
  day_start: "09:00",
  notes:
    "December is cold (around 0–10°C): pack thermals and a proper jacket. Phone network is patchy beyond Kasol and ATMs are few, so carry cash. Sample estimates only: check prices when booking.",
  days: [
    {
      date: "2026-12-12",
      title: "Bangalore → Delhi → overnight bus",
      items: [
        { type: "travel", pinned: true, time: "06:00", duration_min: 165, title: "Flight BLR → DEL", est_cost: 5500, link: "https://www.makemytrip.com/flights/" },
        { type: "food", duration_min: 120, title: "Brunch & wander at Majnu ka Tilla", notes: "Tibetan food, close to where the Himachal buses leave.", place: "Majnu ka Tilla, Delhi", est_cost: 500 },
        { type: "travel", pinned: true, time: "19:00", duration_min: 780, title: "Overnight Volvo Delhi → Kasol", notes: "Book seats together.", est_cost: 1500, link: "https://www.redbus.in/" },
      ],
    },
    {
      date: "2026-12-13",
      title: "Arrive & settle into Kasol",
      items: [
        { type: "stay", duration_min: 45, title: "Check in & freshen up", notes: "Pick the stay in the group vote.", place: "Kasol", est_cost: 750 },
        { type: "activity", duration_min: 120, title: "Walk to Chalal village", notes: "Easy riverside walk across the bridge.", place: "Chalal" },
        { type: "food", duration_min: 90, title: "Riverside café lunch", place: "Kasol main market", est_cost: 500 },
        { type: "activity", pinned: true, time: "21:00", duration_min: 180, title: "Night out in Kasol", notes: "Cafés with music around the market and Chalal.", place: "Kasol / Chalal", est_cost: 1200 },
      ],
    },
    {
      date: "2026-12-14",
      title: "Kheerganga trek",
      items: [
        { type: "travel", pinned: true, time: "08:00", duration_min: 60, title: "Bus/cab Kasol → Barshaini", place: "Barshaini", est_cost: 300 },
        { type: "activity", duration_min: 330, title: "Trek to Kheerganga", notes: "About 12 km. Carry water, snacks and a torch.", place: "Kheerganga" },
        { type: "activity", duration_min: 90, title: "Hot spring at the top", place: "Kheerganga" },
        { type: "stay", duration_min: 30, title: "Camp at Kheerganga", notes: "Tents with dinner included.", est_cost: 900 },
      ],
    },
    {
      date: "2026-12-15",
      title: "Down the hill → Manikaran → Tosh",
      items: [
        { type: "activity", duration_min: 240, title: "Trek back down to Barshaini" },
        { type: "activity", duration_min: 150, title: "Manikaran Sahib & hot springs", notes: "Langar lunch at the gurudwara.", place: "Manikaran" },
        { type: "travel", duration_min: 90, title: "Cab to Tosh village", est_cost: 400 },
        { type: "stay", duration_min: 30, title: "Stay in Tosh", notes: "Mountain views, quieter than Kasol.", place: "Tosh", est_cost: 700 },
      ],
    },
    {
      date: "2026-12-16",
      title: "Tosh morning → bus back",
      items: [
        { type: "activity", duration_min: 180, title: "Explore Tosh village", place: "Tosh" },
        { type: "travel", duration_min: 90, title: "Back to Kasol", est_cost: 400 },
        { type: "food", duration_min: 90, title: "Last café stop", place: "Kasol", est_cost: 500 },
        { type: "activity", duration_min: 120, title: "Shopping at the market", place: "Kasol" },
      ],
    },
    {
      date: "2026-12-17",
      title: "Delhi → Bangalore",
      items: [
        { type: "travel", pinned: true, time: "12:00", duration_min: 165, title: "Flight DEL → BLR", notes: "Keep a buffer: buses from the hills often run late.", est_cost: 5500, link: "https://www.makemytrip.com/flights/" },
      ],
    },
  ],
  options: [
    { category: "stay", title: "Riverside hostel near Chalal bridge", price: "₹700/night per bed", notes: "Walk to the cafés, river views, social common room.", link: "https://www.hostelworld.com/" },
    { category: "stay", title: "Backpacker hostel in Kasol market", price: "₹600/night per bed", notes: "Cheapest, right in the middle of the action, can be noisy." },
    { category: "stay", title: "Private 4-bed room in a homestay", price: "₹3,200/night for the room", notes: "Quiet and private, about ₹800 each." },
    { category: "transport", title: "Overnight Volvo both ways", price: "≈₹1,500 each way", notes: "Cheapest, saves two hotel nights." },
    { category: "transport", title: "Fly DEL → Bhuntar (Kullu)", price: "≈₹6,000+ each way", notes: "Faster but pricey and weather-dependent in winter." },
  ],
  bookings: [
    { what: "Flights BLR → DEL for 4", link: "https://www.makemytrip.com/flights/" },
    { what: "Volvo Delhi → Kasol for 4", link: "https://www.redbus.in/" },
    { what: "Hostel in Kasol (2 nights)" },
    { what: "Kheerganga camp (1 night)" },
    { what: "Volvo Kasol → Delhi for 4", link: "https://www.redbus.in/" },
    { what: "Flights DEL → BLR for 4", link: "https://www.makemytrip.com/flights/" },
  ],
};
