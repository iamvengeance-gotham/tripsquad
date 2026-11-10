"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ITEM_TYPES,
  OPTION_CATEGORIES,
  type ItemType,
  type OptionCategory,
  type TripData,
  type TripItem,
} from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

const ICON: Record<ItemType, string> = { travel: "🚌", stay: "🛏️", activity: "⛰️", food: "🍜" };
const CATEGORY_TITLE: Record<OptionCategory, string> = {
  stay: "Where should we stay?",
  transport: "How do we get there?",
  activity: "What should we do?",
};

const inr = (n?: number) => (n == null ? "" : "₹" + n.toLocaleString("en-IN"));

function fmtDate(s?: string) {
  if (!s) return "";
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const NAME_KEY = "tripsquad:name";

export default function TripView({
  slug,
  initial,
  editKey,
}: {
  slug: string;
  initial: TripData;
  editKey: string | null;
}) {
  const [trip, setTrip] = useState<TripData>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [me, setMe] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const n = localStorage.getItem(NAME_KEY) ?? "";
      setMe(n);
      setNameDraft(n);
    } catch {
      /* storage unavailable: name lasts for this visit only */
    }
  }, []);

  // Keep the page live: pick up friends' votes, claims and Claude's updates.
  useEffect(() => {
    if (editing) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/trips/${slug}`, { cache: "no-store" });
        if (r.ok) setTrip((await r.json()).data);
      } catch {
        /* offline for a moment; try again next tick */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [slug, editing]);

  const shareUrl = origin ? `${origin}/t/${slug}` : `/t/${slug}`;

  const perPerson = useMemo(
    () => trip.days.reduce((s, d) => s + d.items.reduce((t, i) => t + (i.est_cost ?? 0), 0), 0),
    [trip],
  );
  const booked = trip.bookings.filter((b) => b.status === "booked").length;

  // ---------- edit helpers (organiser only) ----------
  const edit = (fn: (d: TripData) => void) =>
    setTrip((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });

  const setItem = (di: number, ii: number, patch: Partial<TripItem>) =>
    edit((d) => {
      d.days[di].items[ii] = { ...d.days[di].items[ii], ...patch };
    });

  const moveItem = (di: number, ii: number, dir: -1 | 1) =>
    edit((d) => {
      const items = d.days[di].items;
      const j = ii + dir;
      if (j < 0 || j >= items.length) return;
      [items[ii], items[j]] = [items[j], items[ii]];
    });

  const moveItemToDay = (di: number, ii: number, target: number) =>
    edit((d) => {
      if (target === di) return;
      const [it] = d.days[di].items.splice(ii, 1);
      d.days[target].items.push(it);
    });

  const moveDay = (di: number, dir: -1 | 1) =>
    edit((d) => {
      const j = di + dir;
      if (j < 0 || j >= d.days.length) return;
      [d.days[di], d.days[j]] = [d.days[j], d.days[di]];
    });

  async function save() {
    if (!editKey) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/trips/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editKey, data: trip }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Couldn't save");
      setTrip(j.data);
      setEditing(false);
      setMsg("Saved. Everyone with the link now sees the new version.");
    } catch (e) {
      setMsg(`Not saved: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    try {
      const r = await fetch(`/api/trips/${slug}`, { cache: "no-store" });
      if (r.ok) setTrip((await r.json()).data);
    } catch {
      /* keep local copy */
    }
    setEditing(false);
    setMsg("");
  }

  // ---------- group actions (anyone with the link) ----------
  async function group(path: "vote" | "booking", body: Record<string, string>) {
    if (!me) {
      setMsg("Add your name first (just below the trip header) so the group knows who it is.");
      return;
    }
    try {
      const r = await fetch(`/api/trips/${slug}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, name: me }),
      });
      if (!r.ok) throw new Error();
      setTrip((await r.json()).data);
      setMsg("");
    } catch {
      setMsg("Couldn't save that. Check your connection and try again.");
    }
  }

  function saveName() {
    const n = nameDraft.trim().slice(0, 40);
    setMe(n);
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Copy didn't work. Select the link and copy it manually.");
    }
  }

  const categories = OPTION_CATEGORIES.filter((c) => editing || trip.options.some((o) => o.category === c));

  return (
    <main className="wrap">
      <div className="topbar">
        <a className="logo" href="/">
          Trip<span>Squad</span>
        </a>
        {editKey && !editing && (
          <button
            className="btn primary"
            onClick={() => {
              setEditing(true);
              setMsg("");
            }}
          >
            ✏️ Edit trip
          </button>
        )}
      </div>

      {editKey && !editing && (
        <div className="banner owner">
          You&apos;re the organiser. This link can edit the trip, so keep it to yourself. Send your group the share link below.
        </div>
      )}
      {msg && <div className="banner status">{msg}</div>}

      {/* ---------- Header ---------- */}
      <section className="card hero">
        {!editing ? (
          <>
            <h1>{trip.title}</h1>
            <div className="route">
              {trip.origin && `${trip.origin} → `}
              {trip.destination}
              {trip.start_date && ` · ${fmtDate(trip.start_date)}`}
              {trip.end_date && ` – ${fmtDate(trip.end_date)}`}
            </div>
            <div className="chips">
              {trip.travellers.map((t) => (
                <span key={t.name} className="chip grey">
                  👤 {t.name}
                </span>
              ))}
              {trip.vibe.map((v) => (
                <span key={v} className="chip">
                  {v}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <label className="f">
              Trip name
              <input value={trip.title} onChange={(e) => edit((d) => void (d.title = e.target.value))} />
            </label>
            <div className="grid2">
              <label className="f">
                From
                <input value={trip.origin} onChange={(e) => edit((d) => void (d.origin = e.target.value))} />
              </label>
              <label className="f">
                To
                <input value={trip.destination} onChange={(e) => edit((d) => void (d.destination = e.target.value))} />
              </label>
            </div>
            <div className="grid3">
              <label className="f">
                Start date
                <input type="date" value={trip.start_date ?? ""} onChange={(e) => edit((d) => void (d.start_date = e.target.value || undefined))} />
              </label>
              <label className="f">
                End date
                <input type="date" value={trip.end_date ?? ""} onChange={(e) => edit((d) => void (d.end_date = e.target.value || undefined))} />
              </label>
              <label className="f">
                Budget per person (₹)
                <input
                  type="number"
                  min={0}
                  value={trip.budget_per_person ?? ""}
                  onChange={(e) =>
                    edit((d) => void (d.budget_per_person = e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value)))))
                  }
                />
              </label>
            </div>
            <div className="grid2">
              <label className="f">
                Travellers (comma separated)
                <input
                  defaultValue={trip.travellers.map((t) => t.name).join(", ")}
                  onBlur={(e) => edit((d) => void (d.travellers = splitList(e.target.value).map((name) => ({ name }))))}
                />
              </label>
              <label className="f">
                Vibe (comma separated)
                <input defaultValue={trip.vibe.join(", ")} onBlur={(e) => edit((d) => void (d.vibe = splitList(e.target.value)))} />
              </label>
            </div>
          </div>
        )}

        <div className="stats">
          <div className="stat">
            <small>Est. per person</small>
            <b className={trip.budget_per_person && perPerson > trip.budget_per_person ? "over" : ""}>{inr(perPerson)}</b>
          </div>
          {trip.budget_per_person != null && (
            <div className="stat">
              <small>Budget per person</small>
              <b>{inr(trip.budget_per_person)}</b>
            </div>
          )}
          <div className="stat">
            <small>Days</small>
            <b>{trip.days.length}</b>
          </div>
          <div className="stat">
            <small>Booked</small>
            <b>
              {booked}/{trip.bookings.length}
            </b>
          </div>
        </div>
      </section>

      {/* ---------- You + share ---------- */}
      {!editing && (
        <section className="card">
          <div className="grid2">
            <label className="f">
              Your name (for votes and bookings)
              <div className="share" style={{ marginTop: 2 }}>
                <input value={nameDraft} placeholder="e.g. Rahul" onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} />
                <button className="btn" onClick={saveName} disabled={!nameDraft.trim() || nameDraft.trim() === me}>
                  {me && nameDraft.trim() === me ? "✓" : "Save"}
                </button>
              </div>
            </label>
            <label className="f">
              Share link for the group
              <div className="share" style={{ marginTop: 2 }}>
                <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button className="btn" onClick={copyShare}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* ---------- Tips ---------- */}
      {(trip.notes || editing) && (
        <section className="card">
          <h2 className="section-title">Good to know</h2>
          {!editing ? (
            <div className="muted">{trip.notes}</div>
          ) : (
            <textarea rows={3} value={trip.notes ?? ""} onChange={(e) => edit((d) => void (d.notes = e.target.value || undefined))} />
          )}
        </section>
      )}

      {/* ---------- Itinerary ---------- */}
      <section className="card">
        <h2 className="section-title">Day by day</h2>
        {trip.days.map((day, di) => (
          <div key={day.id} className="day">
            {!editing ? (
              <div className="day-head">
                <h3>
                  Day {di + 1}: {day.title}
                </h3>
                {day.date && <span className="day-date">{fmtDate(day.date)}</span>}
              </div>
            ) : (
              <div className="row" style={{ marginBottom: 8 }}>
                <b>Day {di + 1}</b>
                <input className="grow" style={{ width: "auto" }} value={day.title} onChange={(e) => edit((d) => void (d.days[di].title = e.target.value))} />
                <input type="date" style={{ width: 160 }} value={day.date ?? ""} onChange={(e) => edit((d) => void (d.days[di].date = e.target.value || undefined))} />
                <button className="btn small" title="Move day up" onClick={() => moveDay(di, -1)} disabled={di === 0}>↑</button>
                <button className="btn small" title="Move day down" onClick={() => moveDay(di, 1)} disabled={di === trip.days.length - 1}>↓</button>
                <button
                  className="btn small danger"
                  onClick={() => edit((d) => void d.days.splice(di, 1))}
                  title="Delete day"
                >
                  Delete day
                </button>
              </div>
            )}

            {day.items.map((it, ii) =>
              !editing ? (
                <div key={it.id} className="item">
                  <div className="time">{it.time}</div>
                  <div className="icon">{ICON[it.type]}</div>
                  <div>
                    <div className="title">
                      {it.title}{" "}
                      {it.link && (
                        <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 400, fontSize: "0.85rem" }}>
                          {it.type === "travel" || it.type === "stay" ? "Book ↗" : "Open ↗"}
                        </a>
                      )}
                    </div>
                    {it.notes && <div className="notes">{it.notes}</div>}
                    {it.place && <div className="place">📍 {it.place}</div>}
                  </div>
                  <div className="cost">{inr(it.est_cost)}</div>
                </div>
              ) : (
                <div key={it.id} className="item-edit">
                  <div className="top">
                    <input placeholder="Time" value={it.time ?? ""} onChange={(e) => setItem(di, ii, { time: e.target.value || undefined })} />
                    <select value={it.type} onChange={(e) => setItem(di, ii, { type: e.target.value as ItemType })}>
                      {ITEM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {ICON[t]} {t}
                        </option>
                      ))}
                    </select>
                    <input placeholder="What" value={it.title} onChange={(e) => setItem(di, ii, { title: e.target.value })} />
                    <input
                      type="number"
                      min={0}
                      placeholder="₹ pp"
                      value={it.est_cost ?? ""}
                      onChange={(e) =>
                        setItem(di, ii, { est_cost: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value))) })
                      }
                    />
                  </div>
                  <div className="grid2">
                    <input placeholder="Place" value={it.place ?? ""} onChange={(e) => setItem(di, ii, { place: e.target.value || undefined })} />
                    <input placeholder="Link (https://...)" value={it.link ?? ""} onChange={(e) => setItem(di, ii, { link: e.target.value || undefined })} />
                  </div>
                  <textarea rows={1} placeholder="Notes" value={it.notes ?? ""} onChange={(e) => setItem(di, ii, { notes: e.target.value || undefined })} />
                  <div className="row">
                    <button className="btn small" onClick={() => moveItem(di, ii, -1)} disabled={ii === 0}>↑</button>
                    <button className="btn small" onClick={() => moveItem(di, ii, 1)} disabled={ii === day.items.length - 1}>↓</button>
                    <select style={{ width: "auto" }} value={di} onChange={(e) => moveItemToDay(di, ii, Number(e.target.value))}>
                      {trip.days.map((_, k) => (
                        <option key={k} value={k}>
                          {k === di ? `On day ${k + 1}` : `Move to day ${k + 1}`}
                        </option>
                      ))}
                    </select>
                    <span className="grow" />
                    <button className="btn small danger" onClick={() => edit((d) => void d.days[di].items.splice(ii, 1))}>
                      Remove
                    </button>
                  </div>
                </div>
              ),
            )}

            {editing && (
              <button
                className="btn small"
                onClick={() => edit((d) => void d.days[di].items.push({ id: uid(), type: "activity", title: "New plan item" }))}
              >
                + Add item
              </button>
            )}
          </div>
        ))}
        {editing && (
          <button className="btn" onClick={() => edit((d) => void d.days.push({ id: uid(), title: "New day", items: [] }))}>
            + Add day
          </button>
        )}
        {!trip.days.length && !editing && <div className="muted">No days planned yet.</div>}
      </section>

      {/* ---------- Group votes ---------- */}
      {categories.length > 0 && (
        <section className="card">
          <h2 className="section-title">Vote as a group</h2>
          {categories.map((cat) => {
            const opts = trip.options.filter((o) => o.category === cat);
            const max = Math.max(0, ...opts.map((o) => o.votes.length));
            return (
              <div key={cat}>
                <div className="cat-title">{CATEGORY_TITLE[cat]}</div>
                <div className="opts">
                  {opts.map((o) => {
                    const idx = trip.options.findIndex((x) => x.id === o.id);
                    const mine = !!me && o.votes.some((v) => v.toLowerCase() === me.toLowerCase());
                    const leading = !editing && max > 0 && o.votes.length === max;
                    return !editing ? (
                      <div key={o.id} className={`opt ${leading ? "leading" : ""}`}>
                        {leading && <span className="badge">Leading</span>}
                        <b>{o.title}</b>
                        {o.price && <div className="price">{o.price}</div>}
                        {o.notes && <div className="notes">{o.notes}</div>}
                        {o.link && (
                          <a href={o.link} target="_blank" rel="noopener noreferrer">
                            See / book ↗
                          </a>
                        )}
                        <div className="row">
                          <button className={`btn small ${mine ? "on" : ""}`} onClick={() => group("vote", { optionId: o.id })}>
                            {mine ? "✓ Voted" : "Vote"}
                          </button>
                          <span className="voters">
                            {o.votes.length} vote{o.votes.length === 1 ? "" : "s"}
                            {o.votes.length > 0 && `: ${o.votes.join(", ")}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div key={o.id} className="opt">
                        <input value={o.title} onChange={(e) => edit((d) => void (d.options[idx].title = e.target.value))} />
                        <input placeholder="Price" value={o.price ?? ""} onChange={(e) => edit((d) => void (d.options[idx].price = e.target.value || undefined))} />
                        <input placeholder="Link" value={o.link ?? ""} onChange={(e) => edit((d) => void (d.options[idx].link = e.target.value || undefined))} />
                        <textarea rows={2} placeholder="Notes" value={o.notes ?? ""} onChange={(e) => edit((d) => void (d.options[idx].notes = e.target.value || undefined))} />
                        <div className="row">
                          <span className="voters">{o.votes.length} votes (kept when you save)</span>
                          <span className="grow" />
                          <button className="btn small danger" onClick={() => edit((d) => void d.options.splice(idx, 1))}>
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {editing && (
                  <button
                    className="btn small"
                    style={{ marginTop: 8 }}
                    onClick={() => edit((d) => void d.options.push({ id: uid(), category: cat, title: "New option", votes: [] }))}
                  >
                    + Add option
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ---------- Bookings ---------- */}
      {(trip.bookings.length > 0 || editing) && (
        <section className="card">
          <h2 className="section-title">
            Who&apos;s booking what
            <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              {booked}/{trip.bookings.length} done
            </span>
          </h2>
          {trip.bookings.map((b, bi) =>
            !editing ? (
              <div key={b.id} className="booking">
                <span className={`pill ${b.status}`}>{b.status === "booked" ? "Booked" : "To book"}</span>
                <span className="grow">
                  {b.what}{" "}
                  {b.link && (
                    <a href={b.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.85rem" }}>
                      ↗
                    </a>
                  )}
                </span>
                <span className="owner">{b.owner ? `👤 ${b.owner}` : "Unclaimed"}</span>
                {!b.owner && (
                  <button className="btn small" onClick={() => group("booking", { bookingId: b.id, action: "claim" })}>
                    I&apos;ll book it
                  </button>
                )}
                {b.owner && b.status === "todo" && (
                  <>
                    <button className="btn small" onClick={() => group("booking", { bookingId: b.id, action: "booked" })}>
                      Mark booked
                    </button>
                    <button className="btn small ghost" onClick={() => group("booking", { bookingId: b.id, action: "unclaim" })}>
                      Unclaim
                    </button>
                  </>
                )}
                {b.status === "booked" && (
                  <button className="btn small ghost" onClick={() => group("booking", { bookingId: b.id, action: "todo" })}>
                    Undo
                  </button>
                )}
              </div>
            ) : (
              <div key={b.id} className="booking">
                <input className="grow" style={{ width: "auto" }} value={b.what} onChange={(e) => edit((d) => void (d.bookings[bi].what = e.target.value))} />
                <input style={{ width: 220 }} placeholder="Link" value={b.link ?? ""} onChange={(e) => edit((d) => void (d.bookings[bi].link = e.target.value || undefined))} />
                <button className="btn small danger" onClick={() => edit((d) => void d.bookings.splice(bi, 1))}>
                  Remove
                </button>
              </div>
            ),
          )}
          {editing && (
            <button
              className="btn small"
              style={{ marginTop: 8 }}
              onClick={() => edit((d) => void d.bookings.push({ id: uid(), what: "New booking", status: "todo" }))}
            >
              + Add booking
            </button>
          )}
        </section>
      )}

      <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>
        Planned with Claude · Costs are estimates, so check prices when booking.
      </p>

      {editing && (
        <div className="savebar">
          <button className="btn" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </main>
  );
}
