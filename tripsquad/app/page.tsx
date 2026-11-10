import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.APP_URL?.replace(/\/+$/, "") ?? `${proto}://${host}`;
  const mcpUrl = `${base}/api/mcp`;

  return (
    <main className="wrap landing">
      <div className="topbar">
        <a className="logo" href="/">Trip<span>Squad</span></a>
        <a className="btn" href="/api/demo">Try a sample trip</a>
      </div>

      <h1>Plan the trip in Claude.<br />Run it with your squad.</h1>
      <p className="lead">
        Tell Claude &ldquo;Plan a trip for 4 of us from Bangalore to Kasol.&rdquo; TripSquad turns the plan into a live page
        your whole group can open, edit, vote on and split bookings from. No AI inside TripSquad: your own Claude does the thinking.
      </p>

      <div className="flow">
        <div className="card"><b>1. Ask Claude</b><div className="muted">Claude asks for dates and vibe, researches, and plans the days.</div></div>
        <div className="card"><b>2. It lands here</b><div className="muted">A day-by-day plan with stays, travel legs and costs.</div></div>
        <div className="card"><b>3. Edit it</b><div className="muted">Move things between days, swap the hostel, fix the budget.</div></div>
        <div className="card"><b>4. Share with the group</b><div className="muted">Friends vote on stays and claim what they&apos;ll book.</div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Connect TripSquad to Claude</h2>
        <ol className="steps">
          <li>
            In Claude, add a <b>custom connector</b> and paste this URL (no login needed):
            <span className="code">{mcpUrl}</span>
          </li>
          <li>In a new chat, make sure the TripSquad connector is turned on.</li>
          <li>
            Ask: <i>&ldquo;Plan a trip for 4 guys from Bangalore to Kasol, 12–17 Dec, mostly party plus one trek, ₹18k each. Create it in TripSquad.&rdquo;</i>
          </li>
          <li>Open the private edit link Claude gives you, tweak anything, and send the share link to your group.</li>
        </ol>
      </div>

      <div className="card">
        <h2 className="section-title">What Claude does vs what TripSquad does</h2>
        <div className="grid2">
          <div><b>Claude (your plan pays)</b><div className="muted">Asks the questions, researches places, transport and stays, and writes the day-by-day plan.</div></div>
          <div><b>TripSquad (no AI)</b><div className="muted">Saves it, lets you edit it, keeps it live at a link, and runs group votes and booking claims.</div></div>
        </div>
      </div>
    </main>
  );
}
