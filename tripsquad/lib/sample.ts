/** A sample trip, shaped exactly like what Claude sends to create_trip. Used by the "Try a sample trip" button. */
export const SAMPLE_TRIP = {
  title: "Kasol with the boys",
  origin: "Bangalore",
  destination: "Kasol",
  start_date: "2026-12-12",
  end_date: "2026-12-17",
  travellers: ["Aman", "Rahul", "Karan", "Vikram"],
  budget_per_person: 18000,
  vibe: ["party", "trek", "cafes"],
  notes:
    "December is cold (around 0–10°C): pack thermals and a proper jacket. Phone network is patchy beyond Kasol and ATMs are few, so carry cash. Sample estimates only: check prices when booking.",
  days: [
    {
      date: "2026-12-12",
      title: "Bangalore → Delhi → overnight bus",
      items: [
        { time: "06:00", type: "travel", title: "Flight BLR → DEL", notes: "Early flight leaves the day free in Delhi.", est_cost: 5500, link: "https://www.makemytrip.com/flights/" },
        { time: "13:00", type: "food", title: "Lunch at Majnu ka Tilla", notes: "Tibetan food, close to where the Himachal buses leave.", place: "Majnu ka Tilla, Delhi", est_cost: 400 },
        { time: "19:00", type: "travel", title: "Overnight Volvo Delhi → Bhuntar/Kasol", notes: "About 12–13 hours. Book seats together.", est_cost: 1500, link: "https://www.redbus.in/" },
      ],
    },
    {
      date: "2026-12-13",
      title: "Arrive & settle into Kasol",
      items: [
        { time: "09:00", type: "stay", title: "Check in at the hostel", notes: "Pick from the stay options below.", place: "Kasol", est_cost: 750 },
        { time: "11:00", type: "activity", title: "Walk to Chalal village", notes: "Easy 30-min riverside walk across the bridge.", place: "Chalal" },
        { time: "14:00", type: "food", title: "Riverside café lunch", place: "Kasol main market", est_cost: 500 },
        { time: "21:00", type: "activity", title: "Night out in Kasol", notes: "Cafés with music around the market and Chalal.", place: "Kasol / Chalal", est_cost: 1200 },
      ],
    },
    {
      date: "2026-12-14",
      title: "Kheerganga trek",
      items: [
        { time: "08:00", type: "travel", title: "Bus/cab Kasol → Barshaini", notes: "About 1 hour. Start early.", place: "Barshaini", est_cost: 300 },
        { time: "09:30", type: "activity", title: "Trek to Kheerganga", notes: "About 12 km, 5–6 hours. Carry water, snacks and a torch.", place: "Kheerganga" },
        { time: "16:00", type: "activity", title: "Hot spring at the top", place: "Kheerganga" },
        { time: "Night", type: "stay", title: "Camp at Kheerganga", notes: "Tents with dinner included.", est_cost: 900 },
      ],
    },
    {
      date: "2026-12-15",
      title: "Down the hill → Manikaran → Tosh",
      items: [
        { time: "08:00", type: "activity", title: "Trek back down to Barshaini", notes: "About 4 hours." },
        { time: "13:00", type: "activity", title: "Manikaran Sahib & hot springs", notes: "Langar lunch at the gurudwara.", place: "Manikaran" },
        { time: "17:00", type: "travel", title: "Cab to Tosh village", est_cost: 400 },
        { time: "Night", type: "stay", title: "Stay in Tosh", notes: "Mountain views, quieter than Kasol.", place: "Tosh", est_cost: 700 },
      ],
    },
    {
      date: "2026-12-16",
      title: "Tosh morning → bus back",
      items: [
        { time: "09:00", type: "activity", title: "Explore Tosh village", place: "Tosh" },
        { time: "13:00", type: "travel", title: "Back to Kasol, last café stop", est_cost: 400 },
        { time: "17:00", type: "travel", title: "Overnight Volvo Kasol → Delhi", est_cost: 1500, link: "https://www.redbus.in/" },
      ],
    },
    {
      date: "2026-12-17",
      title: "Delhi → Bangalore",
      items: [
        { time: "12:00", type: "travel", title: "Flight DEL → BLR", notes: "Keep a buffer: buses from the hills often run late.", est_cost: 5500, link: "https://www.makemytrip.com/flights/" },
      ],
    },
  ],
  options: [
    { category: "stay", title: "Riverside hostel near Chalal bridge", price: "₹700/night per bed", notes: "Walk to the cafés, river views, social common room.", link: "https://www.hostelworld.com/" },
    { category: "stay", title: "Backpacker hostel in Kasol market", price: "₹600/night per bed", notes: "Cheapest, right in the middle of the action, can be noisy." },
    { category: "stay", title: "Private 4-bed room in a homestay", price: "₹3,200/night for the room", notes: "Quiet and private, about ₹800 each. A 10-min walk from the market." },
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
