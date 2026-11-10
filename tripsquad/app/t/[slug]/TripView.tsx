"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  DEPART_MODES,
  ITEM_TYPES,
  LOCAL_MODES,
  OPTION_CATEGORIES,
  type DepartMode,
  type LocalMode,
  type ItemType,
  type OptionCategory,
  type TripData,
  type TripItem,
} from "@/lib/types";
import {
  LEAVE_BUFFER,
  durationOf,
  fmtDur,
  fmtMin,
  guessArrivalDate,
  guessDepartureDate,
  isPinned,
  normTime,
  scheduleTrip,
  toMin,
} from "@/lib/schedule";

// ---------------------------------------------------------------- constants & helpers

const ICON: Record<ItemType, string> = { travel: "🚌", stay: "🛏️", activity: "⛰️", food: "🍜" };
const TYPE_LABEL: Record<ItemType, string> = { travel: "Travel", stay: "Stay", activity: "Activity", food: "Food" };
const MODE_ICON: Record<DepartMode, string> = { flight: "✈️", train: "🚆", bus: "🚌", cab: "🚕", other: "🧭" };
const LOCAL_ICON: Record<LocalMode, string> = { cab: "🚕", scooter: "🛵", walk: "🚶" };
const LOCAL_LABEL: Record<LocalMode, string> = { cab: "Cab / auto", scooter: "Scooter / bike", walk: "Walking" };
const CATEGORY_TITLE: Record<OptionCategory, string> = {
  stay: "Where should we stay?",
  transport: "How do we get there?",
  activity: "What should we do?",
};
const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600, 720, 780, 900];
const NAME_KEY = "tripsquad:name";

const uid = () => Math.random().toString(36).slice(2, 10);
const inr = (n?: number) => (n == null ? "" : "₹" + n.toLocaleString("en-IN"));
const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function fmtDate(s?: string, long = false) {
  if (!s) return "";
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

const AVATAR_COLORS = ["#0f766e", "#7c3aed", "#db2777", "#ea580c", "#2563eb", "#65a30d", "#0891b2", "#9333ea"];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Take friends' votes and booking claims from the server copy, keep everything else local. */
function mergeGroup(local: TripData, server: TripData): TripData {
  const so = new Map(server.options.map((o) => [o.id, o]));
  const sb = new Map(server.bookings.map((b) => [b.id, b]));
  return {
    ...local,
    options: local.options.map((o) => (so.has(o.id) ? { ...o, votes: so.get(o.id)!.votes } : o)),
    bookings: local.bookings.map((b) => {
      const s = sb.get(b.id);
      return s ? { ...b, owner: s.owner, status: s.status } : b;
    }),
  };
}

type Pos = { di: number; ii: number };
type SaveState = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------- main view

export default function TripView({ slug, initial, editKey }: { slug: string; initial: TripData; editKey: string | null }) {
  const canEdit = !!editKey;
  const [trip, setTrip] = useState<TripData>(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [drag, setDrag] = useState<Pos | null>(null);
  const [drop, setDrop] = useState<Pos | null>(null);
  const [askTimes, setAskTimes] = useState(
    canEdit && (!normTime(initial.arrive?.time) || !normTime(initial.depart?.time)),
  );
  const [editTimes, setEditTimes] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mapDay, setMapDay] = useState(0);
  const [toast, setToast] = useState("");
  const [me, setMe] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // refs used by timers
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const revRef = useRef(0);
  const savedRevRef = useRef(0);
  const busyRef = useRef(false);
  busyRef.current = !!drag || !!openItem || !!openOption;
  const [rev, setRev] = useState(0);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const n = localStorage.getItem(NAME_KEY) ?? "";
      setMe(n);
      setNameDraft(n);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- organiser edits: change locally, autosave shortly after ----------
  const edit = useCallback((fn: (d: TripData) => void) => {
    setTrip((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });
    revRef.current += 1;
    setRev(revRef.current);
  }, []);

  useEffect(() => {
    if (!editKey || rev === 0) return;
    setSave("saving");
    const myRev = rev;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/trips/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: editKey, data: tripRef.current }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Save failed");
        savedRevRef.current = Math.max(savedRevRef.current, myRev);
        setTrip((prev) => mergeGroup(prev, j.data));
        if (revRef.current === myRev) setSave("saved");
      } catch {
        setSave("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [rev, editKey, slug]);

  // ---------- keep the page live: friends' votes, claims and Claude's updates ----------
  useEffect(() => {
    const t = setInterval(async () => {
      if (busyRef.current) return;
      try {
        const r = await fetch(`/api/trips/${slug}`, { cache: "no-store" });
        if (!r.ok) return;
        const server: TripData = (await r.json()).data;
        const idle = revRef.current === savedRevRef.current;
        setTrip((prev) => (idle ? server : mergeGroup(prev, server)));
      } catch {
        /* offline for a moment */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [slug]);

  // ---------- group actions (anyone with the link) ----------
  async function group(path: "vote" | "booking", body: Record<string, string>) {
    if (!me) {
      setToast("Type your name in “You” first, so the group knows who it is.");
      document.getElementById("your-name")?.focus();
      return;
    }
    try {
      const r = await fetch(`/api/trips/${slug}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, name: me }),
      });
      if (!r.ok) throw new Error();
      const server: TripData = (await r.json()).data;
      setTrip((prev) => (canEdit ? mergeGroup(prev, server) : server));
    } catch {
      setToast("Couldn't save that. Check your connection and try again.");
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
    if (n) setToast(`Hi ${n}! You can now vote and claim bookings.`);
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast("Copy didn't work. Select the link and copy it manually.");
    }
  }

  // ---------- item helpers ----------
  const setItem = (di: number, ii: number, patch: Partial<TripItem>) =>
    edit((d) => {
      d.days[di].items[ii] = { ...d.days[di].items[ii], ...patch };
    });

  const moveTo = (from: Pos, to: Pos) =>
    edit((d) => {
      const [it] = d.days[from.di].items.splice(from.ii, 1);
      if (!it) return;
      let ti = to.ii;
      if (from.di === to.di && ti > from.ii) ti -= 1;
      d.days[to.di].items.splice(Math.max(0, ti), 0, it);
    });

  const moveDay = (di: number, dir: -1 | 1) =>
    edit((d) => {
      const j = di + dir;
      if (j < 0 || j >= d.days.length) return;
      [d.days[di], d.days[j]] = [d.days[j], d.days[di]];
    });

  // ---------- drag & drop ----------
  const endDrag = () => {
    setDrag(null);
    setDrop(null);
  };
  const onDragStart = (p: Pos) => (e: DragEvent) => {
    setOpenItem(null);
    setDrag(p);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", "tripsquad-item");
    } catch {
      /* some browsers */
    }
  };
  const onItemDragOver = (di: number, ii: number) => (e: DragEvent<HTMLDivElement>) => {
    if (!drag) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const pos = e.clientY > r.top + r.height / 2 ? ii + 1 : ii;
    if (!drop || drop.di !== di || drop.ii !== pos) setDrop({ di, ii: pos });
  };
  const onZoneDragOver = (p: Pos) => (e: DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    if (!drop || drop.di !== p.di || drop.ii !== p.ii) setDrop(p);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (drag && drop) {
      const same = drag.di === drop.di && (drop.ii === drag.ii || drop.ii === drag.ii + 1);
      if (!same) {
        moveTo(drag, drop);
        setToast("Moved. Times updated.");
      }
    }
    endDrag();
  };

  // ---------- derived ----------
  const shareUrl = origin ? `${origin}/t/${slug}` : `/t/${slug}`;
  const schedules = useMemo(() => scheduleTrip(trip), [trip]);
  const perPerson = useMemo(
    () => trip.days.reduce((s, d) => s + d.items.reduce((t, i) => t + (i.est_cost ?? 0), 0), 0),
    [trip],
  );
  const booked = trip.bookings.filter((b) => b.status === "booked").length;
  const timesSet = !!normTime(trip.arrive?.time) && !!normTime(trip.depart?.time);
  const categories = OPTION_CATEGORIES.filter((c) => canEdit || trip.options.some((o) => o.category === c));
  const totalDays = trip.days.length;

  const saveLabel = !canEdit
    ? "● Live"
    : save === "saving"
      ? "Saving…"
      : save === "error"
        ? "⚠ Not saved, check connection"
        : save === "saved"
          ? "✓ All changes saved"
          : "Changes save automatically";

  // ---------------------------------------------------------------- render

  return (
    <div className="trip-page">
      {/* ---------- Hero ---------- */}
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <a className="logo light" href="/">
              Trip<span>Squad</span>
            </a>
            <span className={`save-state ${save}`}>{saveLabel}</span>
          </div>
          <div className="eyebrow">
            {trip.origin ? `${trip.origin} → ` : ""}
            {trip.destination}
          </div>
          {canEdit ? (
            <input
              className="hero-title editable"
              value={trip.title}
              onChange={(e) => edit((d) => void (d.title = e.target.value))}
              aria-label="Trip name"
            />
          ) : (
            <h1 className="hero-title">{trip.title}</h1>
          )}
          <div className="hero-meta">
            {trip.start_date && (
              <span>
                📅 {fmtDate(trip.start_date)}
                {trip.end_date && ` – ${fmtDate(trip.end_date)}`}
              </span>
            )}
            <span>🗓 {totalDays} day{totalDays === 1 ? "" : "s"}</span>
            {trip.travellers.length > 0 && <span>👥 {trip.travellers.length} people</span>}
            {trip.budget_per_person != null && <span>💰 {inr(trip.budget_per_person)} each</span>}
          </div>
          <div className="hero-bottom">
            <div className="avatars">
              {trip.travellers.map((t) => (
                <span key={t.name} className="avatar" style={{ background: avatarColor(t.name) }} title={t.name}>
                  {t.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
            <div className="vibes">
              {trip.vibe.map((v) => (
                <span key={v} className="vibe">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="layout">
        {/* ================= main column ================= */}
        <main className="main-col">
          {canEdit && (
            <div className="hint">
              <b>Tip:</b> drag plans by the ⠿ handle to reorder them or move them to another day. Click a plan to edit it.
              Times update by themselves.
            </div>
          )}

          {trip.notes && (
            <section className="panel notes-panel">
              <div className="panel-title">💡 Good to know</div>
              <p>{trip.notes}</p>
            </section>
          )}

          {/* ---------- Timeline ---------- */}
          {trip.days.map((day, di) => {
            const sch = schedules[di];
            return (
              <section key={day.id} className="day-card">
                <div className="day-top">
                  <div className="day-badge">
                    <small>DAY</small>
                    {di + 1}
                  </div>
                  <div className="day-head">
                    <div className="day-when">{fmtDate(day.date, true)}</div>
                    {canEdit ? (
                      <input
                        className="day-title editable"
                        value={day.title}
                        onChange={(e) => edit((d) => void (d.days[di].title = e.target.value))}
                        aria-label={`Day ${di + 1} title`}
                      />
                    ) : (
                      <h3 className="day-title">{day.title}</h3>
                    )}
                  </div>
                  <button
                    className={`icon-btn map-btn ${mapDay === di ? "on" : ""}`}
                    title="Show this day on the map"
                    onClick={() => setMapDay(di)}
                  >
                    🗺
                  </button>
                  {canEdit && (
                    <div className="day-tools">
                      <button className="icon-btn" title="Move day up" onClick={() => moveDay(di, -1)} disabled={di === 0}>
                        ↑
                      </button>
                      <button className="icon-btn" title="Move day down" onClick={() => moveDay(di, 1)} disabled={di === totalDays - 1}>
                        ↓
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Delete day"
                        onClick={() => {
                          if (day.items.length === 0 || window.confirm(`Delete Day ${di + 1} and its ${day.items.length} plans?`))
                            edit((d) => void d.days.splice(di, 1));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="timeline">
                  {sch.arriveAt != null && (
                    <div className="anchor arrive">
                      <span className="anchor-time">{fmtMin(sch.arriveAt)}</span>
                      <span>🛬 You reach {trip.destination || "the destination"}</span>
                    </div>
                  )}

                  {day.items.map((it, ii) => {
                    const slot = sch.slots[ii];
                    const prev = ii > 0 ? sch.slots[ii - 1] : null;
                    const gap = prev ? slot.start - prev.end - (slot.commute?.min ?? 0) : 0;
                    const open = openItem === it.id;
                    const dragging = drag?.di === di && drag.ii === ii;
                    return (
                      <div key={it.id}>
                        {drag && drop?.di === di && drop.ii === ii && (
                          <div className="drop-line" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} />
                        )}
                        {prev && gap >= 60 && !slot.clash && (
                          <div className="free-time">☕ Free time · {fmtDur(gap)}</div>
                        )}
                        {slot.commute && (
                          <div className={`commute ${slot.commute.min >= 90 ? "long" : ""}`}>
                            {LOCAL_ICON[slot.commute.how]} {fmtDur(slot.commute.min)}
                            {slot.commute.how === "walk" ? " walk" : ""} · {slot.commute.km} km
                            {slot.commute.from ? ` from ${slot.commute.from}` : ""}
                            {slot.commute.min >= 90 && " · long transfer, maybe add a travel plan"}
                          </div>
                        )}
                        <div
                          className={`tl-item t-${it.type} ${dragging ? "dragging" : ""} ${open ? "open" : ""} ${slot.clash || slot.late ? "has-warn" : ""}`}
                          draggable={canEdit && !open}
                          onDragStart={canEdit ? onDragStart({ di, ii }) : undefined}
                          onDragOver={canEdit ? onItemDragOver(di, ii) : undefined}
                          onDrop={canEdit ? onDrop : undefined}
                          onDragEnd={endDrag}
                        >
                          <div className="tl-time">
                            <b>{fmtMin(slot.start)}</b>
                            <span>{fmtMin(slot.end)}</span>
                          </div>
                          <div className="tl-dot" title={TYPE_LABEL[it.type]}>
                            {ICON[it.type]}
                          </div>
                          <div
                            className={`tl-body ${canEdit ? "clickable" : ""}`}
                            onClick={() => canEdit && setOpenItem(open ? null : it.id)}
                          >
                            <div className="tl-title">
                              {it.title}
                              {isPinned(it) && (
                                <span className="pin" title="Fixed time">
                                  📌 fixed
                                </span>
                              )}
                            </div>
                            <div className="tl-meta">
                              <span>⏱ {fmtDur(durationOf(it))}</span>
                              {it.place && <span>📍 {it.place}</span>}
                              {it.est_cost != null && <span>{inr(it.est_cost)} pp</span>}
                              {it.link && (
                                <a href={it.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                  {it.type === "travel" || it.type === "stay" ? "Book ↗" : "Open ↗"}
                                </a>
                              )}
                            </div>
                            {it.notes && <div className="tl-notes">{it.notes}</div>}
                            {slot.clash && <div className="warn">⚠ You can&apos;t get here in time from the previous plan. Move it or shorten something.</div>}
                            {slot.late && sch.leaveBy != null && (
                              <div className="warn">⚠ Ends after {fmtMin(sch.leaveBy)}, when you need to leave.</div>
                            )}
                          </div>
                          {canEdit && (
                            <div className="tl-handle" title="Drag to move">
                              ⠿
                            </div>
                          )}
                        </div>

                        {open && canEdit && (
                          <ItemEditor
                            item={it}
                            destination={trip.destination}
                            startLabel={fmtMin(slot.start).slice(0, 5)}
                            dayIndex={di}
                            index={ii}
                            dayCount={totalDays}
                            itemCount={day.items.length}
                            onChange={(patch) => setItem(di, ii, patch)}
                            onMove={(to) => {
                              moveTo({ di, ii }, to);
                              if (to.di !== di) setOpenItem(null);
                            }}
                            onDelete={() => {
                              edit((d) => void d.days[di].items.splice(ii, 1));
                              setOpenItem(null);
                            }}
                            onClose={() => setOpenItem(null)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {drag && (
                    <div
                      className={`drop-zone ${drop?.di === di && drop.ii === day.items.length ? "active" : ""}`}
                      onDragOver={onZoneDragOver({ di, ii: day.items.length })}
                      onDrop={onDrop}
                    >
                      Drop here to put it at the end of Day {di + 1}
                    </div>
                  )}

                  {!day.items.length && !drag && <div className="empty">Nothing planned yet.</div>}

                  {sch.leaveBy != null && sch.departAt != null && (
                    <div className="anchor depart">
                      <span className="anchor-time">{fmtMin(sch.leaveBy)}</span>
                      <span>
                        🚪 Leave{trip.depart?.from ? ` for ${trip.depart.from}` : ""} · {MODE_ICON[trip.depart?.mode ?? "other"]}{" "}
                        {trip.depart?.mode ?? "way out"} at {fmtMin(sch.departAt)}
                      </span>
                    </div>
                  )}

                  {canEdit && (
                    <button
                      className="add-plan"
                      onClick={() => {
                        const id = uid();
                        edit((d) => void d.days[di].items.push({ id, type: "activity", title: "New plan", duration_min: 60 }));
                        setOpenItem(id);
                      }}
                    >
                      + Add a plan
                    </button>
                  )}
                </div>
              </section>
            );
          })}

          {canEdit && (
            <button
              className="add-day"
              onClick={() => {
                const last = trip.days[trip.days.length - 1]?.date;
                let date: string | undefined;
                if (last) {
                  const d = new Date(`${last}T00:00:00`);
                  d.setDate(d.getDate() + 1);
                  date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                }
                edit((d) => void d.days.push({ id: uid(), title: "New day", date, items: [] }));
              }}
            >
              + Add a day
            </button>
          )}

          {/* ---------- Votes ---------- */}
          {categories.length > 0 && (
            <section className="panel">
              <div className="panel-title">🗳 Vote as a group</div>
              {categories.map((cat) => {
                const opts = trip.options.filter((o) => o.category === cat);
                const max = Math.max(0, ...opts.map((o) => o.votes.length));
                return (
                  <div key={cat} className="vote-group">
                    <div className="vote-q">{CATEGORY_TITLE[cat]}</div>
                    <div className="opts">
                      {opts.map((o) => {
                        const idx = trip.options.findIndex((x) => x.id === o.id);
                        const mine = !!me && o.votes.some((v) => v.toLowerCase() === me.toLowerCase());
                        const leading = max > 0 && o.votes.length === max;
                        const editing = openOption === o.id;
                        return (
                          <div key={o.id} className={`opt ${leading ? "leading" : ""}`}>
                            {leading && <span className="badge">Leading</span>}
                            {!editing ? (
                              <>
                                <div className="opt-title">{o.title}</div>
                                {o.price && <div className="opt-price">{o.price}</div>}
                                {o.notes && <div className="opt-notes">{o.notes}</div>}
                                {o.link && (
                                  <a href={o.link} target="_blank" rel="noopener noreferrer" className="opt-link">
                                    See / book ↗
                                  </a>
                                )}
                                <div className="opt-foot">
                                  <button className={`vote-btn ${mine ? "on" : ""}`} onClick={() => group("vote", { optionId: o.id })}>
                                    {mine ? "✓ Voted" : "Vote"}
                                  </button>
                                  <div className="voters">
                                    {o.votes.map((v) => (
                                      <span key={v} className="avatar xs" style={{ background: avatarColor(v) }} title={v}>
                                        {v.slice(0, 1).toUpperCase()}
                                      </span>
                                    ))}
                                    <span>{o.votes.length || "No"} vote{o.votes.length === 1 ? "" : "s"}</span>
                                  </div>
                                  {canEdit && (
                                    <button className="icon-btn" title="Edit option" onClick={() => setOpenOption(o.id)}>
                                      ✎
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="opt-edit">
                                <input value={o.title} onChange={(e) => edit((d) => void (d.options[idx].title = e.target.value))} placeholder="Name" />
                                <input value={o.price ?? ""} onChange={(e) => edit((d) => void (d.options[idx].price = e.target.value || undefined))} placeholder="Price, e.g. ₹700/night" />
                                <input value={o.link ?? ""} onChange={(e) => edit((d) => void (d.options[idx].link = e.target.value || undefined))} placeholder="Link (https://…)" />
                                <textarea rows={2} value={o.notes ?? ""} onChange={(e) => edit((d) => void (d.options[idx].notes = e.target.value || undefined))} placeholder="Why this one?" />
                                <div className="row">
                                  <button
                                    className="btn small danger"
                                    onClick={() => {
                                      edit((d) => void d.options.splice(idx, 1));
                                      setOpenOption(null);
                                    }}
                                  >
                                    Remove
                                  </button>
                                  <span className="grow" />
                                  <button className="btn small primary" onClick={() => setOpenOption(null)}>
                                    Done
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {canEdit && (
                        <button
                          className="opt add-opt"
                          onClick={() => {
                            const id = uid();
                            edit((d) => void d.options.push({ id, category: cat, title: "New option", votes: [] }));
                            setOpenOption(id);
                          }}
                        >
                          + Add option
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <p className="footnote">Planned with Claude · Costs are estimates, so check prices when booking.</p>
        </main>

        {/* ================= sidebar ================= */}
        <aside className="side-col">
          <section className="side-card map-card">
            <div className="side-title">
              🗺 Route
              <div className="day-pills">
                {trip.days.map((d, i) => (
                  <button key={d.id} className={`day-pill ${mapDay === i ? "on" : ""}`} onClick={() => setMapDay(i)}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <TripMap trip={trip} dayIndex={Math.min(mapDay, Math.max(0, totalDays - 1))} />
          </section>

          {/* You & share */}
          <section className="side-card">
            <div className="side-title">👋 You</div>
            <div className="share">
              <input
                id="your-name"
                value={nameDraft}
                placeholder="Your name"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <button className="btn" onClick={saveName} disabled={!nameDraft.trim() || nameDraft.trim() === me}>
                {me && nameDraft.trim() === me ? "✓" : "Save"}
              </button>
            </div>
            <div className="side-title" style={{ marginTop: 14 }}>
              🔗 Share with the group
            </div>
            <div className="share">
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <button className="btn primary" onClick={copyShare}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {canEdit && (
              <p className="small muted" style={{ marginTop: 8 }}>
                You&apos;re the organiser. Your link can edit the trip, so keep it private. Friends can vote and claim bookings.
              </p>
            )}
          </section>

          {/* Budget */}
          <section className="side-card">
            <div className="side-title">💰 Budget</div>
            <div className="big-num">
              {inr(perPerson)} <small>est. per person</small>
            </div>
            {trip.budget_per_person != null && trip.budget_per_person > 0 && (
              <>
                <div className="meter">
                  <div
                    className={perPerson > trip.budget_per_person ? "over" : ""}
                    style={{ width: `${Math.min(100, (perPerson / trip.budget_per_person) * 100)}%` }}
                  />
                </div>
                <div className={`small ${perPerson > trip.budget_per_person ? "danger-text" : "muted"}`}>
                  {perPerson > trip.budget_per_person
                    ? `${inr(perPerson - trip.budget_per_person)} over the ${inr(trip.budget_per_person)} budget`
                    : `${inr(trip.budget_per_person - perPerson)} left of ${inr(trip.budget_per_person)}`}
                </div>
              </>
            )}
          </section>

          {/* Timings */}
          <section className="side-card">
            <div className="side-title">
              🕒 Arrival & exit
              {canEdit && timesSet && !editTimes && (
                <button className="link-btn" onClick={() => setEditTimes(true)}>
                  Change
                </button>
              )}
            </div>
            {editTimes && canEdit ? (
              <TimingsForm
                trip={trip}
                compact
                onSave={(patch) => {
                  edit((d) => Object.assign(d, patch));
                  setEditTimes(false);
                  setToast("Timings updated.");
                }}
                onCancel={() => setEditTimes(false)}
              />
            ) : timesSet ? (
              <div className="times">
                <div>
                  🛬 Reach {trip.destination}: <b>{fmtDate(trip.arrive?.date, true) || "Day 1"}, {trip.arrive?.time}</b>
                </div>
                <div>
                  {MODE_ICON[trip.depart?.mode ?? "other"]} Way out: <b>{fmtDate(trip.depart?.date, true) || "last day"}, {trip.depart?.time}</b>
                </div>
                <div className="muted small">
                  Leave by {fmtMin(toMin(trip.depart!.time!) - LEAVE_BUFFER[trip.depart?.mode ?? "other"])}
                  {trip.depart?.from ? ` for ${trip.depart.from}` : ""}
                </div>
              </div>
            ) : canEdit ? (
              <button className="btn primary full" onClick={() => setAskTimes(true)}>
                Set arrival & exit times
              </button>
            ) : (
              <p className="small muted">The organiser hasn&apos;t set these yet.</p>
            )}
          </section>

          {/* Bookings */}
          {(trip.bookings.length > 0 || canEdit) && (
            <section className="side-card">
              <div className="side-title">
                🎟 Who&apos;s booking what
                <span className="small muted">
                  {booked}/{trip.bookings.length}
                </span>
              </div>
              {trip.bookings.map((b, bi) => (
                <div key={b.id} className={`booking ${b.status}`}>
                  <div className="booking-main">
                    {canEdit ? (
                      <input
                        className="editable small-input"
                        value={b.what}
                        onChange={(e) => edit((d) => void (d.bookings[bi].what = e.target.value))}
                      />
                    ) : (
                      <span>{b.what}</span>
                    )}
                    {b.link && (
                      <a href={b.link} target="_blank" rel="noopener noreferrer">
                        ↗
                      </a>
                    )}
                    {canEdit && (
                      <button className="icon-btn danger" title="Remove" onClick={() => edit((d) => void d.bookings.splice(bi, 1))}>
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="booking-foot">
                    <span className={`pill ${b.status}`}>{b.status === "booked" ? "Booked" : "To book"}</span>
                    {b.owner ? (
                      <span className="owner">
                        <span className="avatar xs" style={{ background: avatarColor(b.owner) }}>
                          {b.owner.slice(0, 1).toUpperCase()}
                        </span>
                        {b.owner}
                      </span>
                    ) : (
                      <span className="owner muted">Unclaimed</span>
                    )}
                    <span className="grow" />
                    {!b.owner && (
                      <button className="btn small" onClick={() => group("booking", { bookingId: b.id, action: "claim" })}>
                        I&apos;ll book it
                      </button>
                    )}
                    {b.owner && b.status === "todo" && (
                      <>
                        <button className="btn small primary" onClick={() => group("booking", { bookingId: b.id, action: "booked" })}>
                          Done
                        </button>
                        <button className="btn small ghost" onClick={() => group("booking", { bookingId: b.id, action: "unclaim" })}>
                          ✕
                        </button>
                      </>
                    )}
                    {b.status === "booked" && (
                      <button className="btn small ghost" onClick={() => group("booking", { bookingId: b.id, action: "todo" })}>
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {canEdit && (
                <button
                  className="link-btn"
                  onClick={() => edit((d) => void d.bookings.push({ id: uid(), what: "New booking", status: "todo" }))}
                >
                  + Add booking
                </button>
              )}
            </section>
          )}

          {/* Trip details (organiser) */}
          {canEdit && (
            <section className="side-card">
              <div className="side-title">
                ⚙️ Trip details
                <button className="link-btn" onClick={() => setShowDetails((s) => !s)}>
                  {showDetails ? "Close" : "Edit"}
                </button>
              </div>
              {showDetails && (
                <div className="details">
                  <label className="f">
                    From
                    <input value={trip.origin} onChange={(e) => edit((d) => void (d.origin = e.target.value))} />
                  </label>
                  <label className="f">
                    To
                    <input value={trip.destination} onChange={(e) => edit((d) => void (d.destination = e.target.value))} />
                  </label>
                  <div className="grid2">
                    <label className="f">
                      Start
                      <input type="date" value={trip.start_date ?? ""} onChange={(e) => edit((d) => void (d.start_date = e.target.value || undefined))} />
                    </label>
                    <label className="f">
                      End
                      <input type="date" value={trip.end_date ?? ""} onChange={(e) => edit((d) => void (d.end_date = e.target.value || undefined))} />
                    </label>
                  </div>
                  <div className="grid2">
                    <label className="f">
                      Budget each (₹)
                      <input
                        type="number"
                        min={0}
                        value={trip.budget_per_person ?? ""}
                        onChange={(e) =>
                          edit((d) => void (d.budget_per_person = e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value)))))
                        }
                      />
                    </label>
                    <label className="f">
                      Days start at
                      <input type="time" value={trip.day_start ?? "09:00"} onChange={(e) => edit((d) => void (d.day_start = e.target.value || undefined))} />
                    </label>
                  </div>
                  <label className="f">
                    Getting around locally
                    <select value={trip.local_transport ?? "cab"} onChange={(e) => edit((d) => void (d.local_transport = e.target.value as LocalMode))}>
                      {LOCAL_MODES.map((m) => (
                        <option key={m} value={m}>
                          {LOCAL_ICON[m]} {LOCAL_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <label className="f">
                    Good to know
                    <textarea rows={3} value={trip.notes ?? ""} onChange={(e) => edit((d) => void (d.notes = e.target.value || undefined))} />
                  </label>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* ---------- First-visit timing question ---------- */}
      {askTimes && canEdit && (
        <div className="modal-back">
          <div className="modal">
            <h2>Two quick questions so the timings work</h2>
            <p className="muted">
              Claude planned the days. Tell us when you actually land in {trip.destination || "the destination"} and when you
              have to leave, and every plan gets real clock times.
            </p>
            <TimingsForm
              trip={trip}
              onSave={(patch) => {
                edit((d) => Object.assign(d, patch));
                setAskTimes(false);
                setToast("Timings set. Every plan now has real clock times.");
              }}
              onCancel={() => setAskTimes(false)}
              cancelLabel="Skip for now"
            />
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- item editor

function ItemEditor({
  item,
  destination,
  startLabel,
  dayIndex,
  index,
  dayCount,
  itemCount,
  onChange,
  onMove,
  onDelete,
  onClose,
}: {
  item: TripItem;
  destination: string;
  startLabel: string;
  dayIndex: number;
  index: number;
  dayCount: number;
  itemCount: number;
  onChange: (patch: Partial<TripItem>) => void;
  onMove: (to: Pos) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState("");
  async function locate() {
    const q = [item.place || item.title, destination].filter(Boolean).join(", ");
    setLocating(true);
    setLocMsg("");
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
      });
      const j = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (!j[0]) throw new Error("not found");
      onChange({ lat: Number(Number(j[0].lat).toFixed(5)), lng: Number(Number(j[0].lon).toFixed(5)), to_lat: undefined, to_lng: undefined });
      setLocMsg(`Found: ${j[0].display_name.split(",").slice(0, 3).join(",")}`);
    } catch {
      setLocMsg("Couldn't find that place. Try a more specific name.");
    } finally {
      setLocating(false);
    }
  }
  const dur = durationOf(item);
  const durOptions = DURATIONS.includes(dur) ? DURATIONS : [...DURATIONS, dur].sort((a, b) => a - b);
  return (
    <div className="tl-editor">
      <div className="ed-grid">
        <label className="f wide">
          What
          <input autoFocus value={item.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="f">
          Type
          <select value={item.type} onChange={(e) => onChange({ type: e.target.value as ItemType })}>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {ICON[t]} {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Takes
          <select value={dur} onChange={(e) => onChange({ duration_min: Number(e.target.value) })}>
            {durOptions.map((m) => (
              <option key={m} value={m}>
                {fmtDur(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Cost per person (₹)
          <input
            type="number"
            min={0}
            value={item.est_cost ?? ""}
            onChange={(e) => onChange({ est_cost: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value))) })}
          />
        </label>
      </div>

      <div className="ed-grid">
        <label className="f check">
          <input
            type="checkbox"
            checked={!!item.pinned}
            onChange={(e) =>
              onChange(e.target.checked ? { pinned: true, time: normTime(item.time) ?? startLabel } : { pinned: undefined })
            }
          />
          <span>
            Fixed time <small className="muted">(flight, bus, booked slot)</small>
          </span>
        </label>
        {item.pinned && (
          <label className="f">
            Starts at
            <input type="time" value={item.time ?? ""} onChange={(e) => onChange({ time: e.target.value || undefined })} />
          </label>
        )}
        <label className="f">
          Place
          <input value={item.place ?? ""} onChange={(e) => onChange({ place: e.target.value || undefined })} />
        </label>
        <label className="f">
          Link
          <input value={item.link ?? ""} placeholder="https://…" onChange={(e) => onChange({ link: e.target.value || undefined })} />
        </label>
      </div>

      <div className="loc-row">
        <span className="small muted">
          {item.lat != null ? `📍 On the map (${item.lat.toFixed(3)}, ${item.lng?.toFixed(3)})` : "📍 Not on the map yet: travel time can't be worked out."}
          {locMsg && ` · ${locMsg}`}
        </span>
        <button className="btn small" onClick={locate} disabled={locating || !(item.place || item.title)}>
          {locating ? "Finding…" : item.lat != null ? "Re-find on map" : "Find on map"}
        </button>
      </div>

      <label className="f">
        Notes
        <textarea rows={2} value={item.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value || undefined })} />
      </label>

      <div className="row">
        <button className="btn small" onClick={() => onMove({ di: dayIndex, ii: index - 1 })} disabled={index === 0}>
          ↑ Earlier
        </button>
        <button className="btn small" onClick={() => onMove({ di: dayIndex, ii: index + 2 })} disabled={index === itemCount - 1}>
          ↓ Later
        </button>
        <select
          className="auto"
          value={dayIndex}
          onChange={(e) => {
            const target = Number(e.target.value);
            if (target !== dayIndex) onMove({ di: target, ii: Number.MAX_SAFE_INTEGER });
          }}
        >
          {Array.from({ length: dayCount }, (_, k) => (
            <option key={k} value={k}>
              {k === dayIndex ? `On day ${k + 1}` : `Move to day ${k + 1}`}
            </option>
          ))}
        </select>
        <span className="grow" />
        <button className="btn small danger" onClick={onDelete}>
          Delete
        </button>
        <button className="btn small primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- arrival / exit form

function TimingsForm({
  trip,
  onSave,
  onCancel,
  cancelLabel = "Cancel",
  compact = false,
}: {
  trip: TripData;
  onSave: (patch: Pick<TripData, "arrive" | "depart">) => void;
  onCancel: () => void;
  cancelLabel?: string;
  compact?: boolean;
}) {
  const dated = trip.days.filter((d) => d.date);
  const [aDate, setADate] = useState(trip.arrive?.date ?? guessArrivalDate(trip) ?? dated[0]?.date ?? "");
  const [aTime, setATime] = useState(trip.arrive?.time ?? "");
  const [mode, setMode] = useState<DepartMode>(trip.depart?.mode ?? "flight");
  const [dDate, setDDate] = useState(trip.depart?.date ?? guessDepartureDate(trip) ?? dated[dated.length - 1]?.date ?? "");
  const [dTime, setDTime] = useState(trip.depart?.time ?? "");
  const [from, setFrom] = useState(trip.depart?.from ?? "");

  const leaveBy = normTime(dTime) ? fmtMin(toMin(dTime) - LEAVE_BUFFER[mode]) : null;
  const ok = !!normTime(aTime) && !!normTime(dTime);

  const daySelect = (value: string, onChange: (v: string) => void) =>
    dated.length ? (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {trip.days.map((d, i) =>
          d.date ? (
            <option key={d.id} value={d.date}>
              Day {i + 1} · {fmtDate(d.date, true)}
            </option>
          ) : null,
        )}
      </select>
    ) : (
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    );

  return (
    <div className={`timings-form ${compact ? "compact" : ""}`}>
      <div className="tf-block">
        <div className="tf-q">🛬 When do you reach {trip.destination || "the destination"}?</div>
        <div className="grid2">
          <label className="f">
            Day
            {daySelect(aDate, setADate)}
          </label>
          <label className="f">
            Time
            <input type="time" value={aTime} onChange={(e) => setATime(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="tf-block">
        <div className="tf-q">🛫 When does your way out leave?</div>
        <div className="mode-pills">
          {DEPART_MODES.filter((m) => m !== "other").map((m) => (
            <button key={m} type="button" className={`mode-pill ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>
              {MODE_ICON[m]} {m}
            </button>
          ))}
        </div>
        <div className="grid2">
          <label className="f">
            Day
            {daySelect(dDate, setDDate)}
          </label>
          <label className="f">
            Departs at
            <input type="time" value={dTime} onChange={(e) => setDTime(e.target.value)} />
          </label>
        </div>
        <label className="f">
          From (optional)
          <input value={from} placeholder={mode === "flight" ? "e.g. Bhuntar airport" : "e.g. Kasol bus stand"} onChange={(e) => setFrom(e.target.value)} />
        </label>
        {leaveBy && (
          <div className="small muted">
            You&apos;ll need to leave by <b>{leaveBy}</b> ({fmtDur(LEAVE_BUFFER[mode])} before the {mode}). Plans after that get flagged.
          </div>
        )}
      </div>

      <div className="row">
        <button className="btn ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
        <span className="grow" />
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() =>
            onSave({
              arrive: { date: aDate || undefined, time: normTime(aTime) },
              depart: { date: dDate || undefined, time: normTime(dTime), mode, from: from.trim() || undefined },
            })
          }
        >
          Build my timings
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- map (Leaflet + OpenStreetMap, no API key)

type LeafletLike = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function useLeaflet(): LeafletLike | null {
  const [L, setL] = useState<LeafletLike | null>(null);
  useEffect(() => {
    const w = window as unknown as { L?: LeafletLike };
    if (w.L) {
      setL(w.L);
      return;
    }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    let script = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }
    const onLoad = () => setL(w.L ?? null);
    script.addEventListener("load", onLoad);
    return () => script?.removeEventListener("load", onLoad);
  }, []);
  return L;
}

function TripMap({ trip, dayIndex }: { trip: TripData; dayIndex: number }) {
  const L = useLeaflet();
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletLike | null>(null);
  const layerRef = useRef<LeafletLike | null>(null);

  useEffect(() => {
    if (!L || !el.current || mapRef.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.setView([20.6, 78.9], 4); // India
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [L]);

  const day = trip.days[dayIndex];
  const points = useMemo(() => {
    const pts: { lat: number; lng: number; label: string; title: string; type: ItemType; end?: boolean }[] = [];
    let n = 0;
    for (const it of day?.items ?? []) {
      if (it.lat != null && it.lng != null) {
        n += 1;
        pts.push({ lat: it.lat, lng: it.lng, label: String(n), title: it.title, type: it.type });
        if (it.to_lat != null && it.to_lng != null) pts.push({ lat: it.to_lat, lng: it.to_lng, label: "", title: `${it.title} (end)`, type: it.type, end: true });
      }
    }
    return pts;
  }, [day]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    if (!points.length) return;
    const latlngs = points.map((p) => [p.lat, p.lng]);
    L.polyline(latlngs, { color: "#0e7c74", weight: 3, opacity: 0.8, dashArray: "6 6" }).addTo(layer);
    points.forEach((p) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="mk mk-${p.type}${p.end ? " mk-end" : ""}">${p.end ? "" : p.label}</div>`,
        iconSize: p.end ? [14, 14] : [26, 26],
        iconAnchor: p.end ? [7, 7] : [13, 13],
      });
      L.marker([p.lat, p.lng], { icon, title: p.title }).bindTooltip(p.title).addTo(layer);
    });
    if (points.length === 1) map.setView(latlngs[0], 14);
    else map.fitBounds(latlngs, { padding: [24, 24], maxZoom: 15 });
  }, [L, points]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      {!points.length && <div className="map-empty">No map locations for Day {dayIndex + 1} yet.</div>}
      {day && (
        <div className="map-caption small muted">
          Day {dayIndex + 1}: {day.title}
        </div>
      )}
    </div>
  );
}
