"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, Logo } from "@/components/ui";
import HeroVault from "@/components/HeroVault";
import { deleteCharacter, derive, type Character } from "@/lib/character";
import { useCharacters } from "@/lib/cloud";
import { useHydrated } from "@/lib/hooks";
import { makeRoomCode, realtimeEnabled } from "@/lib/room";
import { SRD_ATTRIBUTION } from "@/lib/srd";

const MODES = [
  { id: "human", badge: "HUMAN DM", title: "Someone's running it", body: "The DM gets secret rolls, monster tracking and the battle map. Everyone else plays from their own screen.", tags: ["Secret rolls", "Initiative", "Battle map"] },
  { id: "ai", badge: "AI DUNGEON MASTER", title: "Nobody wants to DM", body: "The AI narrates the scene, voices every NPC, runs the monsters and calls for rolls — everyone plays.", tags: ["Story narration", "Calls for rolls", "Reads your backstories"] },
] as const;
const TONES = ["Heroic", "Grim", "Comedic", "Spooky"];

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const raw = useCharacters(hydrated);
  const chars: Character[] = useMemo(() => JSON.parse(raw) as Character[], [raw]);
  const newId = useMemo(() => (hydrated ? new URLSearchParams(window.location.search).get("created") : null), [hydrated]);
  const [mode, setMode] = useState<"ai" | "human">("ai");
  const [tone, setTone] = useState("Heroic");
  const [join, setJoin] = useState("");

  function createRoom() {
    router.push(`/room/${makeRoomCode()}?mode=${mode}&tone=${tone}&new=1`);
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = join.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (code.length >= 4) router.push(`/room/${code}`);
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-10">
        <Logo />
        <Link href="/create" className="min-h-11 rounded-lg bg-panel-2 px-4 py-2.5 text-sm font-semibold text-parch">New character</Link>
      </header>

      <main className="mx-auto flex max-w-[1240px] flex-col gap-12 px-5 py-10 md:px-10">
        <section className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex max-w-[640px] flex-col gap-3">
            <span className="text-xs font-bold tracking-[2.5px] text-ember">YOUR ONLINE TABLE</span>
            <h1 className="font-display text-5xl font-bold leading-[1.05] text-parch-hi md:text-6xl">Gather the party.</h1>
            <p className="text-lg leading-relaxed text-muted">One table, wherever you are. Shared dice everyone sees land, a battle map, and an AI Dungeon Master for nights nobody wants to run it.</p>
          </div>
          <form onSubmit={joinRoom} className="flex flex-col gap-2 rounded-2xl border border-gold-line bg-gold-panel p-5">
            <label htmlFor="join" className="text-xs font-bold tracking-[1.5px] text-muted">JOIN WITH A ROOM CODE</label>
            <div className="flex gap-2">
              <input id="join" value={join} onChange={(e) => setJoin(e.target.value)} placeholder="EMBR-7Q" autoCapitalize="characters"
                className="min-h-12 w-44 rounded-xl border border-line-2 bg-ink px-4 font-display text-xl font-bold tracking-[3px] text-gold placeholder:text-[#5A5440]" />
              <button type="submit" className="min-h-12 rounded-xl border border-gold px-5 font-semibold text-gold">Join</button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold text-parch-hi">Start a room — who&apos;s running tonight?</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            {MODES.map((m) => {
              const on = mode === m.id;
              const ai = m.id === "ai";
              return (
                <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={on}
                  className={`flex flex-col items-start gap-3.5 rounded-2xl border-2 p-6 text-left transition ${on ? (ai ? "border-arcane bg-arcane-panel" : "border-gold bg-[#1C1810]") : "border-line bg-panel hover:border-line-2"}`}>
                  <div className="flex w-full items-center justify-between">
                    <span className={`rounded-md px-2.5 py-1.5 text-xs font-bold tracking-[1.2px] ${ai ? "bg-[#1E2C4A] text-arcane-soft" : "bg-[#33291A] text-gold"}`}>{m.badge}</span>
                    <span className="box-border h-5 w-5 rounded-full" style={{ border: on ? `6px solid ${ai ? "#6FA8FF" : "#E8B84A"}` : "2px solid #4A4F62" }} />
                  </div>
                  <span className="font-display text-2xl font-bold text-parch-hi">{m.title}</span>
                  <span className="text-[15px] leading-relaxed text-muted">{m.body}</span>
                  <div className="flex flex-wrap gap-2">
                    {m.tags.map((t) => <span key={t} className="rounded-full bg-[#232636] px-2.5 py-1.5 text-xs font-semibold text-soft">{t}</span>)}
                  </div>
                </button>
              );
            })}
          </div>
          {mode === "ai" && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-arcane-line bg-arcane-panel px-5 py-4">
              <span className="text-sm font-semibold text-arcane-soft">AI DM tone</span>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(t)}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tone === t ? "bg-arcane text-[#0B1322]" : "border border-[#3A4562] text-soft"}`}>{t}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-muted">
              {realtimeEnabled ? "Live sync is on — share the room link with the party." : "Live sync isn't configured yet — rooms sync between tabs on this device only."}
            </span>
            <button type="button" onClick={createRoom}
              className="inline-flex min-h-14 items-center gap-2.5 rounded-xl bg-gold px-8 font-display text-lg font-extrabold tracking-[1.5px] text-gold-ink">
              CREATE ROOM
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-parch-hi">Your characters</h2>
            <Link href="/create" className="text-sm font-semibold">+ Create a character</Link>
          </div>
          {hydrated && <HeroVault hasCharacters={chars.length > 0} />}
          {chars.length === 0 ? (
            <Link href="/create" className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-2 p-10 text-center no-underline">
              <span className="font-display text-xl font-bold text-parch-hi">No heroes yet</span>
              <span className="text-muted">Build one in a few minutes — class, species, background, stats.</span>
            </Link>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {chars.map((c) => {
                const d = derive(c);
                return (
                  <div key={c.id} className={`flex flex-col gap-3 rounded-2xl border bg-panel p-5 ${newId === c.id ? "rise border-gold" : "border-line"}`}>
                    <div className="flex items-center gap-3">
                      <Avatar color={c.color} sigil={c.sigil} size={46} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-bold text-parch-hi">{c.name}</span>
                        <span className="text-[13px] text-muted">{d.species.name} {d.cls.name} · Lv {c.level}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-3 text-[13px] text-soft">
                      <span>HP {d.maxHp} · AC {d.ac}</span>
                      <button type="button" className="text-muted hover:text-bad" onClick={() => { if (confirm(`Delete ${c.name}?`)) { deleteCharacter(c.id); } }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="border-t border-line pt-6 text-xs leading-relaxed text-[#7C8192]">
          Tavernlight is an unofficial fan project, not affiliated with Wizards of the Coast. {SRD_ATTRIBUTION}
        </footer>
      </main>
    </div>
  );
}
