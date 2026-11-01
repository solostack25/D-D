"use client";

import { useState } from "react";
import { newId, type DiceStats, type JournalEntry, type Msg, type Recap } from "@/lib/room";

const KINDS: { id: JournalEntry["kind"]; label: string }[] = [
  { id: "quest", label: "Quests" },
  { id: "npc", label: "People" },
  { id: "place", label: "Places" },
  { id: "loot", label: "Loot" },
  { id: "note", label: "Notes" },
];

export function JournalPanel({ journal, send, me }: { journal: JournalEntry[]; send: (m: Msg) => void; me: string }) {
  const [kind, setKind] = useState<JournalEntry["kind"]>("note");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    send({ type: "journal-add", entry: { id: newId(), kind, title: title.trim(), text: text.trim() || undefined, by: me, at: Date.now() } });
    setTitle("");
    setText("");
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      {journal.length === 0 && (
        <p className="text-sm text-muted">The journal fills itself as you play: the AI DM records people you meet, places you go, quests and loot. Anyone can add notes too.</p>
      )}
      {KINDS.map((k) => {
        const items = journal.filter((j) => j.kind === k.id);
        if (!items.length) return null;
        return (
          <div key={k.id} className="flex flex-col gap-2">
            <span className="text-[11px] font-bold tracking-[1.8px] text-muted">{k.label.toUpperCase()}</span>
            {items.map((j) => (
              <div key={j.id} className="flex items-start gap-3 rounded-lg border border-line bg-panel px-3.5 py-2.5">
                {j.kind === "quest" && (
                  <input type="checkbox" checked={!!j.done} aria-label={`Mark ${j.title} ${j.done ? "open" : "done"}`}
                    onChange={() => send({ type: "journal-update", id: j.id, patch: { done: !j.done } })} className="mt-1 h-5 w-5 accent-[#E8B84A]" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${j.done ? "text-muted line-through" : "text-parch-hi"}`}>{j.title}</span>
                  {j.text && <span className="text-sm text-muted">{j.text}</span>}
                </div>
                <button type="button" aria-label={`Remove ${j.title}`} onClick={() => send({ type: "journal-remove", id: j.id })} className="h-8 w-8 shrink-0 rounded-md text-muted hover:text-bad">×</button>
              </div>
            ))}
          </div>
        );
      })}
      <form onSubmit={add} className="flex flex-wrap gap-2 border-t border-line pt-4">
        <select value={kind} onChange={(e) => setKind(e.target.value as JournalEntry["kind"])} aria-label="Entry type" className="min-h-11 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch">
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label.replace(/s$/, "").replace("Peopl", "Person")}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" className="min-h-11 min-w-0 flex-[1_1_160px] rounded-lg border border-line-2 bg-ink px-3 text-sm text-parch" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Details (optional)" aria-label="Details" className="min-h-11 min-w-0 flex-[2_1_200px] rounded-lg border border-line-2 bg-ink px-3 text-sm text-parch" />
        <button className="min-h-11 rounded-lg border border-gold px-4 text-sm font-semibold text-gold">Add</button>
      </form>
    </div>
  );
}

export function RecapsPanel({ recaps, busy, onRecap, aiNote }: { recaps: Recap[]; busy: boolean; onRecap: () => void; aiNote: string | null }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-muted">At the end of the night, the AI writes a &ldquo;Previously on…&rdquo; recap. It opens the next session and the AI DM remembers it.</p>
        <button type="button" disabled={busy} onClick={onRecap} className="min-h-11 rounded-xl bg-arcane px-4 text-sm font-bold text-[#0B1322] disabled:opacity-50">{busy ? "Writing…" : "Write tonight's recap"}</button>
      </div>
      {aiNote && <p className="text-sm text-[#F28B7E]" role="alert">{aiNote}</p>}
      {recaps.length === 0 && <p className="text-sm text-muted">No recaps yet.</p>}
      {[...recaps].reverse().map((r, i) => (
        <article key={r.id} className="flex flex-col gap-2 rounded-xl border border-arcane-line bg-arcane-panel p-4">
          <span className="text-[11px] font-bold tracking-[1.8px] text-arcane-soft">{i === 0 ? "LATEST · " : ""}{new Date(r.at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
          <p className="m-0 font-story text-lg leading-relaxed text-parch">{r.text}</p>
        </article>
      ))}
    </div>
  );
}

export function StatsPanel({ stats }: { stats: Record<string, DiceStats> }) {
  const rows = Object.entries(stats).filter(([, s]) => s.rolls > 0).map(([who, s]) => ({ who, ...s, avg: s.d20s ? s.d20sum / s.d20s : 0 }));
  if (!rows.length) return <p className="px-5 py-5 text-sm text-muted">Roll some dice and the luck tracker wakes up.</p>;
  const withD20 = rows.filter((r) => r.d20s >= 3);
  const luckiest = withD20.length ? withD20.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const cursed = withD20.length > 1 ? withD20.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-wrap gap-3">
        {luckiest && <span className="rounded-xl border border-gold-line bg-gold-panel px-4 py-2.5 text-sm text-soft">Luckiest: <b className="text-gold">{luckiest.who}</b> (avg d20 {luckiest.avg.toFixed(1)})</span>}
        {cursed && cursed.who !== luckiest?.who && <span className="rounded-xl border border-[#4A2A20] bg-[#2A1714] px-4 py-2.5 text-sm text-soft">Cursed dice: <b className="text-[#F28B7E]">{cursed.who}</b> (avg d20 {cursed.avg.toFixed(1)})</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead>
            <tr className="text-[11px] tracking-[1.2px] text-muted">
              <th className="py-2 font-bold">PLAYER</th><th className="font-bold">ROLLS</th><th className="font-bold">AVG D20</th><th className="font-bold">NAT 20s</th><th className="font-bold">NAT 1s</th><th className="font-bold">BEST</th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => b.avg - a.avg).map((r) => (
              <tr key={r.who} className="border-t border-line">
                <td className="py-2.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color ?? "#C9CDD9" }} /><b className="text-parch-hi">{r.who}</b></td>
                <td className="text-soft">{r.rolls}</td>
                <td className="text-soft">{r.d20s ? r.avg.toFixed(1) : "—"}</td>
                <td className="font-bold text-gold">{r.nat20}</td>
                <td className="font-bold text-[#F28B7E]">{r.nat1}</td>
                <td className="text-soft">{r.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const REACTIONS = ["🎲", "🔥", "😂", "😱", "💀", "⚔️", "🛡️", "👏"];
