# TripSquad

**Plan the trip in Claude. Run it with your squad.**

You tell Claude: *"Plan a trip for 4 guys from Bangalore to Kasol."* Claude asks for the dates, budget and vibe, researches the trip and plans it. Then it sends the plan to TripSquad over MCP. TripSquad turns it into a live page that the organiser can edit and the whole group can open, vote on and use to split up the bookings.

- **Claude does:** the questions, research and the day-by-day plan (paid for by the user's own Claude plan).
- **TripSquad does:** saving, editing, a live share link, group votes, booking claims and the budget maths.
- **No AI inside:** there are no OpenAI, Anthropic or other AI keys anywhere in this app.

---

## 1. Run it locally (about 10 minutes)

You need Node 18.18 or newer and a free [Neon](https://neon.tech) Postgres database.

1. Create a Neon project, open **Connect**, and copy the connection string.
2. In this folder:
   ```bash
   cp .env.example .env.local      # paste your DATABASE_URL into it
   npm install
   npm run dev
   ```
3. Open http://localhost:3000 and click **Try a sample trip**. You should land on an editable Kasol trip. The `trips` table is created automatically the first time it's used.

### Test the MCP server without Claude
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
You should see 4 tools: `create_trip`, `get_trip`, `update_trip` and `add_options`.

You can also use the MCP Inspector: run `npx @modelcontextprotocol/inspector`, choose transport **Streamable HTTP** and URL `http://localhost:3000/api/mcp`.

## 2. Deploy to Vercel (about 5 minutes)

1. Push this folder to a new GitHub repo.
2. On [vercel.com](https://vercel.com), choose **Add New → Project**, import the repo, and add the environment variable `DATABASE_URL`.
3. Deploy. Your app is at `https://<project>.vercel.app` and your MCP URL is `https://<project>.vercel.app/api/mcp`.
4. Optional: set `APP_URL=https://<project>.vercel.app` so the links Claude hands out always use your main domain.

## 3. Connect it to Claude

1. In Claude, add a **custom connector** with the URL `https://<project>.vercel.app/api/mcp`. No login is needed.
2. In a new chat, turn the TripSquad connector on.
3. Ask: *"Plan a trip for 4 guys from Bangalore to Kasol, 12–17 Dec, mostly party plus one trek, ₹18k each. Create it in TripSquad."*

Claude replies with two links:
- **Edit link** (`/t/<id>?key=…`): private to the organiser. Use **Edit trip** to change anything.
- **Share link** (`/t/<id>`): for the group. Friends enter their name, vote on options and claim bookings. The page refreshes every 8 seconds.

Follow-ups also work in the same chat: *"Add a day in Tosh"* or *"Make it cheaper, swap flights for trains."* Claude calls `get_trip` and then `update_trip`, and the votes and claims are kept.

---

## How it's built

| Part | File |
|---|---|
| MCP server (JSON-RPC over Streamable HTTP, stateless, no SDK needed) | `lib/mcp.ts`, `app/api/mcp/route.ts` |
| Trip rules: cleaning input, keeping votes on edit, votes, booking claims | `lib/trip.ts` |
| Database (Neon Postgres, one `trips` table with JSONB) | `lib/db.ts` |
| Trip page, edit mode, votes, bookings | `app/t/[slug]/` |
| Web API for the page | `app/api/trips/[slug]/…` |
| Landing page + connect guide | `app/page.tsx` |
| Sample trip (same shape Claude sends) | `lib/sample.ts`, `app/api/demo/route.ts` |

**Access model:** there are no accounts. Each trip has an unguessable id (the share link) and a separate secret edit key (the organiser link, also needed by Claude to update the trip).

**Safety:** all input is cleaned and its length capped, and only `http(s)` links are kept.

**Running cost:** Vercel Hobby and Neon free tiers cover the MVP. Each trip is one small database row, so the cost per customer is effectively ₹0 until there's real scale.

---

## Demo script (2 minutes of the video)

1. **Claude** (0:00–0:40): type the Kasol request. Claude asks one or two questions, then calls `create_trip` and returns the links.
2. **App** (0:40–1:10): open the edit link and walk through the header (budget versus estimate), day by day, stays to vote on, and who's booking what.
3. **Edit** (1:10–1:30): click **Edit trip**, move "Night out in Kasol" to day 4, change the hostel price, and save.
4. **Group** (1:30–1:50): open the share link on your phone as "Rahul", vote for a hostel and click "I'll book it" on the Volvo. The laptop updates within a few seconds.
5. **Claude again** (1:50–2:00): *"Add a day in Tosh."* Refresh, and the new day is there and Rahul's vote is still there.

**Tips:** record in a fresh chat; create one backup trip beforehand in case the live call is slow.

## Submission checklist
- [ ] Video link (5 minutes or less)
- [ ] Live app: `https://<project>.vercel.app` (no login; the "Try a sample trip" button works without Claude)
- [ ] MCP link: `https://<project>.vercel.app/api/mcp`, plus the 3 connect steps above
