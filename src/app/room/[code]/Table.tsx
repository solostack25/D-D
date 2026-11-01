"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, D20, HpBar, Label, Logo } from "@/components/ui";
import { checkMod, derive, fmt, getCharacter, saveCharacter, toPublic, type Character } from "@/lib/character";
import { roll as rollExpr } from "@/lib/dice";
import HeroVault from "@/components/HeroVault";
import { useCharacters } from "@/lib/cloud";
import { useHydrated } from "@/lib/hooks";
import { getClientId, newId, useRoom, type InitEntry, type LogEntry, type Member, type RollEntry, type Token } from "@/lib/room";
import { ABILITIES, ABILITY_NAMES, SKILLS, type Skill } from "@/lib/srd";

const COLS = 16;
const ROWS = 10;
const DICE = [4, 6, 8, 10, 12, 20, 100];
const TONES = ["Heroic", "Grim", "Comedic", "Spooky"];

interface Seat {
  role: "player" | "dm";
  characterId: string | null;
}

// ---- AI tag parsing -------------------------------------------------------
interface RollReq { who: string; check: string; target: string | null; idx: number }
const ROLL_RE = /\[ROLL ([^:\]]+):\s*([^\]]+?)\]/g;
const FOE_RE = /\[FOE ([^|\]]+)\|\s*HP\s*(\d+)\s*\|\s*AC\s*(\d+)\s*\|\s*INIT\s*(\d+)\s*\]/gi;
const SCENE_RE = /\[SCENE ([^\]]+)\]/i;

function parseRequests(text: string): RollReq[] {
  const out: RollReq[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(ROLL_RE.source, "g");
  let i = 0;
  while ((m = re.exec(text))) {
    const raw = m[2].trim();
    const t = raw.match(/^(.*?)\s+((?:DC|AC)\s*\d+)$/i);
    out.push({ who: m[1].trim(), check: (t ? t[1] : raw).trim(), target: t ? t[2].toUpperCase() : null, idx: i++ });
  }
  return out;
}
const stripTags = (text: string) =>
  text.replace(new RegExp(ROLL_RE.source, "g"), "").replace(new RegExp(FOE_RE.source, "gi"), "").replace(new RegExp(SCENE_RE.source, "gi"), "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

// ---------------------------------------------------------------------------

export default function Table({ code }: { code: string }) {
  const ready = useHydrated();
  const clientId = useMemo(() => (ready ? getClientId() : null), [ready]);
  const rawChars = useCharacters(ready);
  const myChars = useMemo(() => JSON.parse(rawChars) as Character[], [rawChars]);
  const savedSeat = useMemo(() => {
    if (!ready) return null;
    try {
      return JSON.parse(sessionStorage.getItem(`tavernlight.seat.${code}`) ?? "null") as Seat | null;
    } catch {
      return null;
    }
  }, [ready, code]);
  const [seatState, setSeat] = useState<Seat | null | undefined>(undefined);
  const seat = seatState === undefined ? savedSeat : seatState;
  const seatCharId = seat?.characterId ?? null;
  const savedChar = useMemo(() => (seatCharId ? myChars.find((c) => c.id === seatCharId) ?? getCharacter(seatCharId) : null), [seatCharId, myChars]);
  const [charState, setChar] = useState<Character | null | undefined>(undefined);
  const char = charState === undefined || (charState && charState.id !== seatCharId) ? savedChar : charState;

  const me: Member | null = useMemo(
    () => (clientId && seat ? { clientId, role: seat.role, character: char ? toPublic(char) : null, joinedAt: 0 } : null),
    [clientId, seat, char],
  );

  const room = useRoom(code, me);

  function takeSeat(s: Seat) {
    setSeat(s);
    setChar(undefined);
    try {
      sessionStorage.setItem(`tavernlight.seat.${code}`, JSON.stringify(s));
    } catch {}
  }

  if (!ready) return <div className="min-h-screen" />;
  if (!seat) return <SeatPicker code={code} chars={myChars} onPick={takeSeat} />;
  return <Session code={code} seat={seat} char={char} setChar={setChar} me={me!} room={room} leave={() => { sessionStorage.removeItem(`tavernlight.seat.${code}`); setSeat(null); }} />;
}

// ---------------------------------------------------------------------------

function SeatPicker({ code, chars, onPick }: { code: string; chars: Character[]; onPick: (s: Seat) => void }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-5 py-4 md:px-10">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <span className="font-display text-lg font-extrabold tracking-[4px] text-gold">{code}</span>
      </header>
      <main className="mx-auto flex max-w-[960px] flex-col gap-8 px-5 py-12">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-[2.5px] text-ember">JOINING ROOM {code}</span>
          <h1 className="font-display text-4xl font-bold text-parch-hi md:text-5xl">Take your seat</h1>
          <p className="text-muted">Pick the character you&apos;re playing tonight.</p>
        </div>
        <HeroVault hasCharacters={chars.length > 0} compact />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {chars.map((c) => {
            const d = derive(c);
            return (
              <button key={c.id} type="button" onClick={() => onPick({ role: "player", characterId: c.id })}
                className="flex items-center gap-3 rounded-2xl border-2 border-line bg-panel p-5 text-left transition hover:border-gold">
                <Avatar color={c.color} sigil={c.sigil} size={50} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-lg font-bold text-parch-hi">{c.name}</span>
                  <span className="text-[13px] text-muted">{d.species.name} {d.cls.name} · Lv {c.level}</span>
                </div>
              </button>
            );
          })}
          <Link href="/create" className="flex min-h-[90px] items-center justify-center rounded-2xl border-2 border-dashed border-line-2 p-5 font-semibold no-underline">
            + Create a character
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <button type="button" onClick={() => onPick({ role: "dm", characterId: null })}
            className="min-h-12 rounded-xl border border-gold px-6 font-display font-extrabold tracking-[1.5px] text-gold">I&apos;M THE DM</button>
          <button type="button" onClick={() => onPick({ role: "player", characterId: null })}
            className="min-h-12 rounded-xl border border-line-2 px-6 font-semibold text-soft">Just watch</button>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Room = ReturnType<typeof useRoom>;

function Session({ code, seat, char, setChar, me, room, leave }: {
  code: string; seat: Seat; char: Character | null; setChar: (c: Character) => void; me: Member; room: Room; leave: () => void;
}) {
  const { state, members, send, live } = room;
  const isDM = seat.role === "dm";
  const myName = char?.name ?? (isDM ? "DM" : "Spectator");
  const myColor = char?.color ?? "#E8B84A";
  const aiMode = state.mode === "ai";

  // ---- first-load settings from the create-room link ----
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("new") === "1") {
      const mode = q.get("mode") === "human" ? "human" : "ai";
      setTimeout(() => send({ type: "settings", mode, tone: q.get("tone") ?? "Heroic" }), 600);
    }
    if (q.size) window.history.replaceState(null, "", `/room/${code}`);
  }, [code, send]);

  // ---- put my token on the map ----
  useEffect(() => {
    if (!char) return;
    const t = setTimeout(() => {
      if (state.tokens[char.id]) return;
      const taken = new Set(Object.values(state.tokens).map((k) => `${k.x},${k.y}`));
      let x = 1, y = 2;
      while (taken.has(`${x},${y}`)) { y++; if (y >= ROWS - 1) { y = 2; x++; } }
      send({ type: "token", id: char.id, token: { x, y, label: char.name[0].toUpperCase(), color: char.color, kind: "pc", name: char.name } });
    }, 1200);
    return () => clearTimeout(t);
  }, [char, state.tokens, send]);

  // ---- party: everyone present with a character, plus offline tokens ----
  const party = useMemo(() => {
    const seen = new Map<string, Member>();
    for (const m of members) if (m.character) seen.set(m.character.id, m);
    if (me.character) seen.set(me.character.id, me);
    return [...seen.values()];
  }, [members, me]);
  const dmPresent = members.some((m) => m.role === "dm") || isDM;

  // ---- dice ----
  const [die, setDie] = useState(20);
  const [count, setCount] = useState(1);
  const [check, setCheck] = useState<string>("Attack");
  const [secret, setSecret] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [last, setLast] = useState<RollEntry | null>(null);
  const busyDM = useRef(false);
  const [dmBusy, setDmBusy] = useState(false);

  const askDM = useCallback(async (action: string) => {
    if (busyDM.current) return;
    busyDM.current = true;
    setDmBusy(true);
    const id = newId();
    send({ type: "log-patch", id, text: "", streaming: true });
    let text = "";
    let lastSent = 0;
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone: state.tone,
          scene: state.scene,
          action,
          party: party.map((m) => ({ ...m.character!, backstory: m.character!.id === char?.id ? char?.notes : undefined })),
          log: state.log.filter((l) => !l.streaming).slice(-40).map((l) => ({ who: l.who, kind: l.kind, text: l.text })),
        }),
      });
      if (!res.ok || !res.body) {
        text = await res.text();
        send({ type: "log-patch", id, text: text || "The AI DM is unavailable right now.", streaming: false });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        if (Date.now() - lastSent > 250) {
          lastSent = Date.now();
          send({ type: "log-patch", id, text, streaming: true });
        }
      }
      send({ type: "log-patch", id, text, streaming: false });
      // apply structured tags
      const scene = text.match(SCENE_RE);
      if (scene) send({ type: "settings", scene: scene[1].trim() });
      const foes: InitEntry[] = [];
      for (const f of text.matchAll(new RegExp(FOE_RE.source, "gi"))) {
        foes.push({ id: newId(), name: f[1].trim(), hp: Number(f[2]), maxHp: Number(f[2]), ac: Number(f[3]), init: Number(f[4]), kind: "foe", color: "#F06A5A" });
      }
      if (foes.length) {
        addFoes(foes);
      }
    } catch {
      send({ type: "log-patch", id, text: text + "\n\n(Connection to the AI DM dropped.)", streaming: false });
    } finally {
      busyDM.current = false;
      setDmBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, state.tone, state.scene, state.log, party, char]);

  function addFoes(foes: InitEntry[]) {
    send({ type: "init-upsert", entries: foes });
    const taken = new Set(Object.values(state.tokens).map((k) => `${k.x},${k.y}`));
    let x = COLS - 3, y = 2;
    for (const f of foes) {
      while (taken.has(`${x},${y}`)) { y++; if (y >= ROWS - 1) { y = 2; x--; } }
      taken.add(`${x},${y}`);
      send({ type: "token", id: f.id, token: { x, y, label: f.name.slice(0, 2).replace(/\s/g, ""), color: "#F06A5A", kind: "foe", name: f.name } });
    }
  }

  function doRoll(opts: { sides: number; count?: number; label: string; mod?: number; req?: string; hidden?: boolean; after?: (e: RollEntry) => void }) {
    if (rolling) return;
    const n = opts.count ?? 1;
    const mod = opts.mod ?? 0;
    const r = rollExpr(`${n}d${opts.sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ""}`);
    setDie(opts.sides);
    setRollCount((c) => c + 1);
    setRolling(true);
    setTimeout(() => {
      const entry: RollEntry = {
        id: newId(), who: myName, color: myColor, label: opts.label, expr: `${n}d${opts.sides}${mod ? fmt(mod) : ""}`,
        dice: r.rolls, modifier: mod, total: r.total, nat: r.nat, hidden: opts.hidden, req: opts.req, byClient: me.clientId, at: Date.now(),
      };
      setLast(entry);
      setRolling(false);
      send({ type: "roll", entry });
      if (!opts.hidden) {
        const natTxt = r.nat === 20 ? " — NATURAL 20!" : r.nat === 1 ? " — natural 1" : "";
        send({ type: "log", entry: { id: newId(), kind: "roll", who: myName, color: myColor, text: `${opts.label}: ${r.total} (${entry.expr} → ${r.rolls.join(", ")})${natTxt}`, at: Date.now() } });
      }
      opts.after?.(entry);
    }, 900);
  }

  function trayRoll() {
    if (die === 20 && count === 1 && char) {
      const mod = checkMod(char, check);
      if (check === "Initiative") return rollInitiative();
      doRoll({ sides: 20, label: check, mod, hidden: isDM && secret });
    } else {
      doRoll({ sides: die, count, label: `${count}d${die}`, hidden: isDM && secret });
    }
  }

  function rollInitiative() {
    if (!char) return;
    const mod = checkMod(char, "Initiative");
    doRoll({
      sides: 20, label: "Initiative", mod,
      after: (e) => {
        const d = derive(char);
        send({ type: "init-upsert", entries: [{ id: char.id, name: char.name, init: e.total, kind: "pc", color: char.color, hp: Math.min(char.hp, d.maxHp), maxHp: d.maxHp, ac: d.ac }] });
      },
    });
  }

  function answerRequest(entry: LogEntry, req: RollReq) {
    if (!char) return;
    const isInit = /^init/i.test(req.check);
    const mod = checkMod(char, req.check);
    const reqId = `${entry.id}:${req.idx}`;
    doRoll({
      sides: 20, label: `${req.check}${req.target ? ` (${req.target})` : ""}`, mod, req: reqId,
      after: (e) => {
        if (isInit) {
          const d = derive(char);
          send({ type: "init-upsert", entries: [{ id: char.id, name: char.name, init: e.total, kind: "pc", color: char.color, hp: Math.min(char.hp, d.maxHp), maxHp: d.maxHp, ac: d.ac }] });
        }
        if (!aiMode) return;
        // When every roll this message asked for is in, hand them back to the AI DM.
        const reqs = parseRequests(entry.text);
        const done = new Map(state.rolls.filter((r) => r.req?.startsWith(entry.id + ":")).map((r) => [r.req!, r]));
        done.set(reqId, e);
        const present = new Set(party.map((p) => p.character!.name.toLowerCase()));
        const outstanding = reqs.filter((r) => !done.has(`${entry.id}:${r.idx}`) && present.has(r.who.toLowerCase()));
        if (outstanding.length === 0) {
          const summary = reqs
            .map((r) => {
              const x = done.get(`${entry.id}:${r.idx}`);
              return x ? `${r.who} rolled ${r.check}${r.target ? ` vs ${r.target}` : ""}: ${x.total} (natural ${x.dice[0]}, ${fmt(x.modifier)})` : null;
            })
            .filter(Boolean)
            .join("; ");
          setTimeout(() => askDM(`Roll results — ${summary}. Resolve them and continue.`), 300);
        }
      },
    });
  }

  // ---- story input ----
  const [draft, setDraft] = useState("");
  function submitAction(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const kind = isDM ? "dm" : "player";
    send({ type: "log", entry: { id: newId(), kind, who: myName, color: myColor, text, at: Date.now() } });
    if (aiMode && !isDM) askDM(`${myName}: ${text}`);
  }

  // ---- HP ----
  function changeHp(delta: number) {
    if (!char) return;
    const max = derive(char).maxHp;
    const next = { ...char, hp: Math.max(0, Math.min(max, char.hp + delta)) };
    saveCharacter(next);
    setChar(next);
    if (state.init.some((x) => x.id === char.id)) send({ type: "init-patch", id: char.id, hp: next.hp });
  }

  // ---- initiative ----
  const [foeName, setFoeName] = useState("");
  const [foeInit, setFoeInit] = useState("");
  const [foeHp, setFoeHp] = useState("");
  function addFoe(e: React.FormEvent) {
    e.preventDefault();
    if (!foeName.trim()) return;
    const hp = Number(foeHp) || 7;
    addFoes([{ id: newId(), name: foeName.trim(), init: Number(foeInit) || rollExpr("d20").total, hp, maxHp: hp, kind: "foe", color: "#F06A5A" }]);
    setFoeName(""); setFoeInit(""); setFoeHp("");
  }
  function nextTurn() {
    if (!state.init.length) return;
    const t = state.turn + 1;
    send({ type: "turn", turn: t % state.init.length, round: state.round + (t >= state.init.length ? 1 : 0) });
  }
  function removeInit(id: string) {
    send({ type: "init-remove", id });
    if (state.tokens[id]?.kind === "foe") send({ type: "token", id, token: null });
  }
  function foeHpChange(id: string, delta: number) {
    const cur = state.init.find((x) => x.id === id);
    if (cur) send({ type: "init-patch", id, hp: Math.max(0, Math.min(cur.maxHp ?? 999, (cur.hp ?? 0) + delta)) });
  }
  const activeId = state.init[state.turn]?.id;

  // ---- map ----
  const [picked, setSelected] = useState<string | null>(null);
  const selected = picked ?? char?.id ?? null;
  const byCell = useMemo(() => {
    const m = new Map<string, [string, Token]>();
    for (const [id, t] of Object.entries(state.tokens)) m.set(`${t.x},${t.y}`, [id, t]);
    return m;
  }, [state.tokens]);
  function clickCell(x: number, y: number) {
    const hit = byCell.get(`${x},${y}`);
    if (hit) return setSelected(hit[0]);
    if (!selected || !state.tokens[selected]) return;
    send({ type: "token", id: selected, token: { ...state.tokens[selected], x, y } });
  }

  // ---- incoming roll toast ----
  const [dismissed, setDismissed] = useState<string | null>(null);
  const newestRoll = state.rolls[0];
  const toast = newestRoll && newestRoll.id !== dismissed ? newestRoll : null;
  useEffect(() => {
    if (!newestRoll) return;
    const t = setTimeout(() => setDismissed(newestRoll.id), 3500);
    return () => clearTimeout(t);
  }, [newestRoll]);

  // ---- log autoscroll ----
  const logRef = useRef<HTMLDivElement>(null);
  const lastLog = state.log[state.log.length - 1];
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log.length, lastLog?.text]);

  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const d = char ? derive(char) : null;
  const shownRoll = last;
  const crit = !rolling && shownRoll?.nat === 20;
  const fumble = !rolling && shownRoll?.nat === 1;
  const checkOptions = ["Attack", "Initiative", ...(Object.keys(SKILLS) as Skill[]), ...ABILITIES.map((a) => `${ABILITY_NAMES[a]} save`), ...ABILITIES.map((a) => ABILITY_NAMES[a])];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------- header ---------- */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-ink-2 px-4 py-3 md:px-6">
        <Link href="/" aria-label="Home"><Logo size={26} text={false} /></Link>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-display text-base font-extrabold tracking-[2px] text-gold">{state.scene.toUpperCase()}</span>
          <span className="text-xs text-muted">Room {code} · {live ? "live" : "this device only"} · {party.length} at the table</span>
        </div>
        <div className="flex flex-[1_1_420px] flex-wrap items-center gap-2" aria-label="Initiative order">
          {state.init.length > 0 && <span className="mr-1 text-[11px] font-bold tracking-[1.8px] text-muted">ROUND {state.round}</span>}
          {state.init.map((i) => {
            const on = i.id === activeId;
            return (
              <span key={i.id} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "turn-pulse bg-gold text-gold-ink" : i.kind === "foe" ? "border border-[#4A2A20] bg-[#2A1714] text-[#F0956B]" : "border border-line bg-panel-2 text-parch"}`}>
                <b className="font-display">{i.init}</b>{i.name}
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aiMode ? (
            <span className="flex items-center gap-2 rounded-full border border-arcane-line bg-arcane-panel px-3.5 py-2">
              <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
                {[0, 0.2, 0.4].map((dl) => <span key={dl} className={`w-[3px] rounded-sm bg-arcane ${dmBusy ? "speak" : ""}`} style={{ height: dmBusy ? 16 : 6, animationDelay: `${dl}s` }} />)}
              </span>
              <span className="text-[13px] font-bold text-arcane-soft">{dmBusy ? "AI DM is narrating" : `AI DM · ${state.tone}`}</span>
            </span>
          ) : (
            <span className="rounded-full border border-gold-line bg-gold-panel px-3.5 py-2 text-[13px] font-bold text-gold">{dmPresent ? "Human DM" : "Waiting for DM"}</span>
          )}
          <button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/room/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            className="min-h-10 rounded-lg border border-gold px-3 text-sm font-semibold text-gold">{copied ? "Link copied" : "Invite"}</button>
          <button type="button" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)} className="min-h-10 rounded-lg border border-line-2 px-3 text-sm font-semibold text-soft">Settings</button>
        </div>
        {showSettings && (
          <div className="flex w-full flex-wrap items-end gap-4 rounded-xl border border-line bg-panel p-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Who runs it
              <select value={state.mode} onChange={(e) => send({ type: "settings", mode: e.target.value as "ai" | "human" })} className="min-h-10 rounded-lg border border-line-2 bg-ink px-3 text-sm text-parch">
                <option value="ai">AI Dungeon Master</option>
                <option value="human">Human DM</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">AI tone
              <select value={state.tone} onChange={(e) => send({ type: "settings", tone: e.target.value })} className="min-h-10 rounded-lg border border-line-2 bg-ink px-3 text-sm text-parch">
                {TONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <form className="flex flex-col gap-1 text-xs font-semibold text-muted" onSubmit={(e) => { e.preventDefault(); const v = (new FormData(e.currentTarget).get("scene") as string).trim(); if (v) send({ type: "settings", scene: v }); }}>
              <label htmlFor="scene">Scene name</label>
              <div className="flex gap-2">
                <input id="scene" name="scene" defaultValue={state.scene} className="min-h-10 rounded-lg border border-line-2 bg-ink px-3 text-sm text-parch" />
                <button className="min-h-10 rounded-lg border border-line-2 px-3 text-sm text-soft">Set</button>
              </div>
            </form>
            <button type="button" onClick={() => { if (confirm("Clear the story log, rolls, initiative and map for everyone?")) send({ type: "reset" }); }} className="min-h-10 rounded-lg border border-[#4A2A20] px-3 text-sm font-semibold text-[#F28B7E]">New session</button>
            <button type="button" onClick={leave} className="min-h-10 rounded-lg border border-line-2 px-3 text-sm text-soft">Change seat</button>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-wrap gap-5 p-4 md:p-5">
        {/* ---------- party ---------- */}
        <aside className="order-3 flex flex-[1_1_250px] flex-col gap-3 lg:order-none lg:max-w-[290px]">
          <Label>PARTY</Label>
          {party.length === 0 && <p className="text-sm text-muted">No one has a character seated yet.</p>}
          {party.map((m) => {
            const c = m.character!;
            const mine = c.id === char?.id;
            const turn = c.id === activeId;
            const hp = mine && char ? char.hp : c.hp;
            return (
              <div key={c.id} className={`flex flex-col gap-2.5 rounded-xl border bg-panel p-3.5 ${turn ? "turn-pulse border-gold" : "border-line"}`}>
                <div className="flex items-center gap-2.5">
                  <Avatar color={c.color} sigil={c.sigil} size={40} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-bold text-parch-hi">{c.name}{mine ? " (you)" : ""}</span>
                    <span className="truncate text-xs text-muted">{c.summary}</span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg border border-line-2 px-2 py-1">
                    <span className="text-[10px] font-bold text-muted">AC</span>
                    <span className="font-display text-[15px] font-extrabold text-parch-hi">{c.ac}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs"><span className="text-muted">HP</span><b className="text-parch-hi">{hp} / {c.maxHp}</b></div>
                <HpBar hp={hp} max={c.maxHp} />
                {mine && (
                  <div className="flex gap-2">
                    {[-5, -1, 1, 5].map((n) => (
                      <button key={n} type="button" onClick={() => changeHp(n)} aria-label={`${n > 0 ? "Heal" : "Damage"} ${Math.abs(n)}`}
                        className={`min-h-10 flex-1 rounded-lg text-sm font-bold ${n < 0 ? "border border-[#4A2A20] bg-[#2A1714] text-[#F28B7E]" : "border border-[#1F4A30] bg-[#16301F] text-[#6EE7A0]"}`}>
                        {n > 0 ? `+${n}` : n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {d && char && (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3.5">
              <Label>YOUR SHEET · PROF {fmt(d.prof)}</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {ABILITIES.map((a) => (
                  <button key={a} type="button" onClick={() => doRoll({ sides: 20, label: `${ABILITY_NAMES[a]} check`, mod: d.m(a) })}
                    className="flex flex-col items-center rounded-lg border border-gold-line bg-gold-panel py-1.5" aria-label={`Roll ${ABILITY_NAMES[a]} check`}>
                    <span className="text-[10px] font-bold text-soft">{a}</span>
                    <span className="font-display text-base font-extrabold text-gold">{fmt(d.m(a))}</span>
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">Skills: {[...d.skills].map((s) => `${s} ${fmt(d.skillMod(s))}`).join(" · ")}</span>
            </div>
          )}
        </aside>

        {/* ---------- map + story ---------- */}
        <main className="order-1 flex min-w-0 flex-[999_1_560px] flex-col gap-4 lg:order-none">
          <div className="relative overflow-hidden rounded-2xl border border-[#2E3242] bg-[#0B0C10]">
            <div className="grid gap-[2px] p-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }} role="grid" aria-label="Battle map">
              {Array.from({ length: COLS * ROWS }, (_, i) => {
                const x = i % COLS, y = Math.floor(i / COLS);
                const hit = byCell.get(`${x},${y}`);
                const sel = hit && hit[0] === selected;
                return (
                  <button key={i} type="button" onClick={() => clickCell(x, y)} aria-label={hit ? hit[1].name : `Square ${x + 1}, ${y + 1}`}
                    className="flex aspect-square items-center justify-center hover:brightness-125" style={{ background: (x + y) % 2 ? "#24252E" : "#272833" }}>
                    {hit && (
                      <span className="flex h-[78%] w-[78%] items-center justify-center rounded-full font-display text-[clamp(9px,1.1vw,15px)] font-extrabold text-ink transition-all"
                        style={{ background: hit[1].color, boxShadow: `0 0 0 3px ${hit[1].kind === "foe" ? "#2A1714" : "#0E0F14"}${sel ? ", 0 0 0 6px #E8B84A" : ""}` }}>
                        {hit[1].label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
              <span className="rounded-lg border border-gold-line bg-[rgba(14,15,20,.85)] px-2.5 py-1.5 font-display text-[13px] font-bold tracking-[1px] text-gold">{state.scene.toUpperCase()}</span>
              <span className="rounded-lg border border-line bg-[rgba(14,15,20,.85)] px-2.5 py-1.5 text-xs font-semibold text-soft">Tap a token, then a square to move it</span>
            </div>
            {toast && (
              <div key={toast.id} className="rise absolute bottom-3 right-3 flex items-center gap-3 rounded-xl border border-gold-line bg-[rgba(22,21,15,.95)] px-4 py-3" aria-live="polite">
                <span className="h-3 w-3 rounded-full" style={{ background: toast.color }} />
                <span className="text-sm text-soft"><b className="text-parch-hi">{toast.who}</b> · {toast.hidden && toast.byClient !== me.clientId ? "secret roll" : toast.label}</span>
                <span className={`font-display text-2xl font-extrabold ${toast.nat === 20 ? "text-gold" : toast.nat === 1 ? "text-[#F28B7E]" : "text-parch-hi"}`}>
                  {toast.hidden && toast.byClient !== me.clientId ? "?" : toast.total}
                </span>
              </div>
            )}
          </div>

          <section aria-label="Story log" className="flex flex-col rounded-2xl border border-line bg-[#14151C]">
            <div ref={logRef} className="flex max-h-[460px] min-h-[220px] flex-col gap-3.5 overflow-y-auto px-5 py-5">
              {state.log.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="font-display text-xl font-bold text-parch-hi">The table is set.</span>
                  <span className="max-w-md text-sm text-muted">{aiMode ? "When the party's seated, start the adventure and the AI DM will set the scene." : "DM: describe the opening scene below. Players: type what your character does."}</span>
                  {aiMode && (
                    <button type="button" disabled={dmBusy} onClick={() => askDM("Begin the adventure: introduce the setting, bring the party together, and present a hook.")}
                      className="mt-2 min-h-12 rounded-xl bg-arcane px-6 font-display font-extrabold tracking-[1.5px] text-[#0B1322] disabled:opacity-50">BEGIN THE ADVENTURE</button>
                  )}
                </div>
              )}
              {state.log.map((l) => <LogLine key={l.id} entry={l} rolls={state.rolls} myName={char?.name} onRoll={answerRequest} canRoll={!rolling} />)}
            </div>
            <form onSubmit={submitAction} className="flex flex-wrap items-end gap-2.5 border-t border-line p-4">
              <label className="flex flex-[1_1_320px] flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">{isDM ? "Narrate as the DM" : char ? `What does ${char.name} do?` : "Say something"}</span>
                <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  placeholder={isDM ? "The door creaks open onto a flooded chapel…" : "I raise my shield and charge…"}
                  className="resize-none rounded-xl border border-line-2 bg-[#0F1016] px-3.5 py-3 text-[15px] text-parch placeholder:text-[#6B7080]" />
              </label>
              <button type="submit" className="min-h-12 rounded-xl bg-gold px-5 font-bold text-gold-ink">{aiMode && !isDM ? "Send to DM" : "Send"}</button>
              {aiMode && state.log.length > 0 && (
                <button type="button" disabled={dmBusy} onClick={() => askDM("Continue the story from where it left off.")} className="min-h-12 rounded-xl border border-arcane-line px-4 text-sm font-semibold text-arcane-soft disabled:opacity-50">Continue</button>
              )}
            </form>
          </section>
        </main>

        {/* ---------- dice + initiative ---------- */}
        <aside className="order-2 flex flex-[1_1_280px] flex-col gap-3.5 lg:order-none lg:max-w-[330px]">
          <section aria-label="Dice tray" className="flex flex-col items-center gap-4 rounded-2xl border border-gold-line bg-gold-panel px-4 py-5">
            <span className="self-start"><Label>DICE TRAY</Label></span>
            <D20 value={shownRoll ? shownRoll.total : 20} rolling={rolling} spin={rollCount} sides={die} size={140} crit={crit} fumble={fumble} />
            <div className="flex min-h-[48px] flex-col items-center">
              <span className={`font-display text-2xl font-extrabold ${crit ? "text-gold" : fumble ? "text-[#F28B7E]" : "text-parch-hi"}`}>
                {rolling ? "Rolling…" : crit ? "CRITICAL!" : fumble ? "FUMBLE" : shownRoll ? `${shownRoll.total}` : "Ready"}
              </span>
              <span className="text-center text-sm text-soft">{rolling ? "The table is watching" : shownRoll ? `${shownRoll.label} · ${shownRoll.expr} → ${shownRoll.dice.join(", ")}` : "Pick a die and roll"}</span>
            </div>
            <div className="grid w-full grid-cols-7 gap-1.5">
              {DICE.map((n) => (
                <button key={n} type="button" aria-pressed={die === n} onClick={() => setDie(n)}
                  className={`min-h-11 rounded-lg text-[13px] font-bold ${die === n ? "bg-gold text-gold-ink" : "border border-gold-line bg-[#1C1A12] text-[#D9CFB5]"}`}>d{n}</button>
              ))}
            </div>
            <div className="flex w-full gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">How many
                <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="min-h-11 rounded-lg border border-gold-line bg-ink px-2 text-sm text-parch">
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              {die === 20 && count === 1 && char && (
                <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold text-muted">Check ({fmt(checkMod(char, check))})
                  <select value={check} onChange={(e) => setCheck(e.target.value)} className="min-h-11 rounded-lg border border-gold-line bg-ink px-2 text-sm text-parch">
                    {checkOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
              )}
            </div>
            {isDM && (
              <label className="flex items-center gap-2 self-start text-sm text-soft">
                <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} className="h-5 w-5 accent-[#E8B84A]" /> Secret roll (only you see it)
              </label>
            )}
            <button type="button" onClick={trayRoll} disabled={rolling}
              className="min-h-14 w-full rounded-xl bg-gold font-display text-lg font-extrabold tracking-[2px] text-gold-ink disabled:opacity-60">
              ROLL {count > 1 ? count : ""}D{die}
            </button>
          </section>

          <section aria-label="Initiative" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <Label>INITIATIVE</Label>
              <div className="flex gap-2">
                {char && <button type="button" onClick={rollInitiative} className="min-h-9 rounded-lg border border-gold px-2.5 text-xs font-semibold text-gold">Roll mine</button>}
                <button type="button" onClick={nextTurn} disabled={!state.init.length} className="min-h-9 rounded-lg bg-panel-2 px-2.5 text-xs font-semibold text-parch disabled:opacity-40">Next turn</button>
              </div>
            </div>
            {state.init.length === 0 && <p className="text-sm text-muted">No fight yet. Roll initiative when combat starts.</p>}
            {state.init.map((i) => (
              <div key={i.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${i.id === activeId ? "bg-[#2A2312]" : ""}`}>
                <span className="w-7 text-center font-display font-extrabold text-gold">{i.init}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color ?? "#C9CDD9" }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-parch-hi">{i.name}</span>
                {i.kind === "foe" && i.maxHp ? (
                  <span className="flex items-center gap-1 text-xs text-soft">
                    <button type="button" aria-label={`Damage ${i.name}`} onClick={() => foeHpChange(i.id, -1)} className="h-7 w-7 rounded-md bg-[#2A1714] text-[#F28B7E]">−</button>
                    {i.hp}/{i.maxHp}
                    <button type="button" aria-label={`Heal ${i.name}`} onClick={() => foeHpChange(i.id, 1)} className="h-7 w-7 rounded-md bg-[#16301F] text-[#6EE7A0]">+</button>
                  </span>
                ) : (
                  i.maxHp ? <span className="text-xs text-muted">{i.hp}/{i.maxHp}</span> : null
                )}
                <button type="button" aria-label={`Remove ${i.name}`} onClick={() => removeInit(i.id)} className="h-7 w-7 rounded-md text-muted hover:text-bad">×</button>
              </div>
            ))}
            <form onSubmit={addFoe} className="mt-1 flex flex-wrap gap-1.5 border-t border-line pt-3">
              <input value={foeName} onChange={(e) => setFoeName(e.target.value)} placeholder="Add foe" aria-label="Foe name" className="min-h-10 min-w-0 flex-[2_1_100px] rounded-lg border border-line-2 bg-ink px-2.5 text-sm text-parch" />
              <input value={foeInit} onChange={(e) => setFoeInit(e.target.value)} placeholder="Init" inputMode="numeric" aria-label="Foe initiative" className="min-h-10 w-14 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch" />
              <input value={foeHp} onChange={(e) => setFoeHp(e.target.value)} placeholder="HP" inputMode="numeric" aria-label="Foe hit points" className="min-h-10 w-14 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch" />
              <button className="min-h-10 rounded-lg border border-[#4A2A20] px-3 text-sm font-semibold text-[#F0956B]">Add</button>
            </form>
          </section>

          <section aria-label="Recent rolls" className="flex flex-col gap-1 rounded-2xl border border-line bg-panel p-4">
            <Label>EVERYONE&apos;S ROLLS · LIVE</Label>
            {state.rolls.length === 0 && <p className="pt-2 text-sm text-muted">Rolls from the whole table show up here.</p>}
            {state.rolls.slice(0, 8).map((r) => {
              const hide = r.hidden && r.byClient !== me.clientId;
              return (
                <div key={r.id} className="flex items-center justify-between gap-2.5 border-b border-[#22252F] py-2 last:border-0">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold text-parch-hi">{r.who}</span>
                    <span className="truncate text-xs text-muted">{hide ? "Secret DM roll" : `${r.label} · ${r.expr}`}</span>
                  </div>
                  <span className={`min-w-10 rounded-lg px-2 py-1 text-center font-display text-base font-extrabold ${r.nat === 20 && !hide ? "bg-gold text-gold-ink" : r.nat === 1 && !hide ? "bg-[#2E1614] text-[#F28B7E]" : "bg-[#232636] text-parch-hi"}`}>
                    {hide ? "?" : r.total}
                  </span>
                </div>
              );
            })}
          </section>
        </aside>
      </div>
    </div>
  );
}

function LogLine({ entry, rolls, myName, onRoll, canRoll }: { entry: LogEntry; rolls: RollEntry[]; myName?: string; onRoll: (e: LogEntry, r: RollReq) => void; canRoll: boolean }) {
  const reqs = entry.kind === "ai" && !entry.streaming ? parseRequests(entry.text) : [];
  const tag =
    entry.kind === "ai" ? ["AI DM", "bg-[#1E2C4A] text-arcane-soft"] :
    entry.kind === "dm" ? ["DM", "bg-[#33291A] text-gold"] :
    entry.kind === "roll" ? ["ROLL", "bg-[#33291A] text-gold"] :
    entry.kind === "system" ? ["NOTE", "bg-[#232636] text-soft"] :
    [(entry.who ?? "PLAYER").split(" ")[0].toUpperCase().slice(0, 9), "bg-[#232636] text-soft"];
  const story = entry.kind === "ai" || entry.kind === "dm";
  const text = entry.kind === "ai" ? stripTags(entry.text) : entry.text;
  return (
    <div className="rise flex items-start gap-3.5">
      <span className={`mt-[3px] w-16 shrink-0 rounded-md py-1 text-center text-[11px] font-bold tracking-[1px] ${tag[1]}`}>{tag[0]}</span>
      <div className="flex min-w-0 flex-col gap-2">
        <p className={`m-0 whitespace-pre-line ${story ? "font-story text-lg leading-relaxed text-parch" : "text-sm leading-relaxed text-soft"}`}>
          {entry.kind === "roll" && <b className="text-parch-hi" style={{ color: entry.color }}>{entry.who} · </b>}
          {text || (entry.streaming ? "…" : "")}
          {entry.streaming && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-arcane align-middle" aria-hidden="true" />}
        </p>
        {reqs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {reqs.map((r) => {
              const done = rolls.find((x) => x.req === `${entry.id}:${r.idx}`);
              const mine = myName && r.who.toLowerCase() === myName.toLowerCase();
              const label = `${r.who.split(" ")[0]} · ${r.check}${r.target ? ` ${r.target}` : ""}`;
              if (done) return <span key={r.idx} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted">{label} → <b className="text-parch-hi">{done.total}</b></span>;
              return mine ? (
                <button key={r.idx} type="button" disabled={!canRoll} onClick={() => onRoll(entry, r)} className="min-h-10 rounded-lg bg-gold px-3.5 text-sm font-bold text-gold-ink disabled:opacity-60">Roll {r.check}{r.target ? ` (${r.target})` : ""}</button>
              ) : (
                <span key={r.idx} className="rounded-lg border border-dashed border-gold-line px-3 py-2 text-xs font-semibold text-[#D9CFB5]">Waiting: {label}</span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
