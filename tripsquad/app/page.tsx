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
        <a className="logo" href="/">
          Trip<span>Squad</span>
        </a>
        <a className="btn" href="/api/demo">
          Try a sample trip
        </a>
      </div>

      <h1>
        Plan the trip in Claude.
        <br />
        <em>Run it with your squad.</em>
      </h1>
      <p className="lead">
        Tell Claude &ldquo;Plan a trip for 4 of us from Bangalore to Kasol.&rdquo; TripSquad turns the plan into a live,
        timed itinerary your whole group can open, rearrange, vote on and split bookings from. No AI inside TripSquad: your
        own Claude does the thinking.
      </p>
      <div className="cta-row">
        <a className="btn primary" href="/api/demo">
          See a sample Kasol trip →
        </a>
        <a className="btn" href="#connect">
          Connect to Claude
        </a>
      </div>

      <div className="flow">
        <div className="card">
          <div className="num">1</div>
          <b>Ask Claude</b>
          <div className="muted">Claude asks about dates and vibe, researches, and plans every day.</div>
        </div>
        <div className="card">
          <div className="num">2</div>
          <b>It lands here, timed</b>
          <div className="muted">Tell us when you land and when you leave, and every plan gets a real clock time.</div>
        </div>
        <div className="card">
          <div className="num">3</div>
          <b>Drag to rearrange</b>
          <div className="muted">Move plans between days and the times recalculate. Clashes and late exits get flagged.</div>
        </div>
        <div className="card">
          <div className="num">4</div>
          <b>Share with the group</b>
          <div className="muted">Friends vote on stays and claim what they&apos;ll book, live.</div>
        </div>
      </div>

      <div className="card" id="connect">
        <h2 className="section-title">Connect TripSquad to Claude</h2>
        <ol className="steps">
          <li>
            In Claude, add a <b>custom connector</b> and paste this URL (no login needed):
            <span className="code">{mcpUrl}</span>
          </li>
          <li>In a new chat, make sure the TripSquad connector is turned on.</li>
          <li>
            Ask:{" "}
            <i>
              &ldquo;Plan a trip for 4 guys from Bangalore to Kasol, 12–17 Dec, mostly party plus one trek, ₹18k each.
              Create it in TripSquad.&rdquo;
            </i>
          </li>
          <li>Open the private edit link Claude gives you, set your arrival and exit times, drag things around, and send the share link to your group.</li>
        </ol>
      </div>

      <div className="card">
        <h2 className="section-title">What Claude does vs what TripSquad does</h2>
        <div className="grid2">
          <div>
            <b>Claude (your plan pays)</b>
            <div className="muted">Asks the questions, researches places, transport and stays, and writes the day-by-day plan with durations.</div>
          </div>
          <div>
            <b>TripSquad (no AI)</b>
            <div className="muted">Works out clock times, lets you drag and edit, keeps it live at a link, and runs group votes and booking claims.</div>
          </div>
        </div>
      </div>
    </main>
  );
}
