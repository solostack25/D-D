"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dice3D, { type Throw } from "@/components/Dice3D";
import HeroVault from "@/components/HeroVault";
import { Avatar, D20, HpBar, Label, Logo } from "@/components/ui";
import { checkMod, derive, fmt, getCharacter, normalize, saveCharacter, toPublic, type Character } from "@/lib/character";
import { formatParts, roll as rollExpr } from "@/lib/dice";
import { modeFromConditions, skinById, type RollMode } from "@/lib/rules";
import { useCharacters } from "@/lib/cloud";
import { useHydrated } from "@/lib/hooks";
import { getClientId, newId, useRoom, type InitEntry, type LogEntry, type Member, type Msg, type RollEntry, type Token } from "@/lib/room";
import { ABILITIES, ABILITY_NAMES, SKILLS, type Ability, type Skill } from "@/lib/srd";
import { JournalPanel, REACTIONS, RecapsPanel, StatsPanel } from "./CampaignPanels";
import SheetPanel, { type Engine, type RollOpts } from "./SheetPanel";

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
const NPC_RE = /\[NPC ([^:\]]+):\s*([^\]]*)\]/gi;
const QUEST_RE = /\[QUEST ([^\]]+)\]/gi;
const QUEST_DONE_RE = /\[QUEST-DONE ([^\]]+)\]/gi;
const LOOT_RE = /\[LOOT ([^:\]]+):\s*([^\]]+)\]/gi;
const GOLD_RE = /\[GOLD ([^:\]]+):\s*(\d+)\s*\]/gi;

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
  [ROLL_RE, FOE_RE, SCENE_RE, NPC_RE, QUEST_DONE_RE, QUEST_RE, LOOT_RE, GOLD_RE]
    .reduce((t, re) => t.replace(new RegExp(re.source, "gi"), ""), text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Short "who got what" lines for loot tags, shown under the narration. */
function lootLines(text: string) {
  const out: string[] = [];
  for (const m of text.matchAll(new RegExp(LOOT_RE.source, "gi"))) out.push(`${m[1].trim()} receives ${m[2].trim()}`);
  for (const m of text.matchAll(new RegExp(GOLD_RE.source, "gi"))) out.push(`${m[1].trim()} receives ${m[2]} gp`);
  return out;
}

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
type StoryTab = "Story" | "Journal" | "Recaps" | "Stats";

function Session({ code, seat, char: rawChar, setChar, me, room, leave }: {
  code: string; seat: Seat; char: Character | null; setChar: (c: Character) => void; me: Member; room: Room; leave: () => void;
}) {
  const { state, members, send, live, onEvent, saveNow } = room;
  const char = useMemo(() => (rawChar ? normalize(rawChar) : null), [rawChar]);
  const isDM = seat.role === "dm";
  const myName = char?.name ?? (isDM ? "DM" : "Spectator");
  const myColor = char?.color ?? "#E8B84A";
  const aiMode = state.mode === "ai";

  // ---- character updates (saved locally + synced to the cloud) ----
  const charRef = useRef(char);
  useEffect(() => {
    charRef.current = char;
  }, [char]);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const update = useCallback((fn: (c: ReturnType<typeof normalize>) => Character) => {
    const cur = charRef.current;
    if (!cur) return;
    const next = normalize(fn(normalize(cur)));
    const max = derive(next).maxHp;
    next.hp = Math.max(0, Math.min(max, next.hp));
    charRef.current = next;
    saveCharacter(next);
    setChar(next);
    const st = stateRef.current;
    if (st.init.some((x) => x.id === next.id) && next.hp !== cur.hp) send({ type: "init-patch", id: next.id, hp: next.hp });
  }, [send, setChar]);

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
      if (stateRef.current.tokens[char.id]) return;
      const taken = new Set(Object.values(stateRef.current.tokens).map((k) => `${k.x},${k.y}`));
      let x = 1, y = 2;
      while (taken.has(`${x},${y}`)) { y++; if (y >= ROWS - 1) { y = 2; x++; } }
      send({ type: "token", id: char.id, token: { x, y, label: char.name[0].toUpperCase(), color: char.color, kind: "pc", name: char.name } });
    }, 1200);
    return () => clearTimeout(t);
  }, [char, send]);

  // ---- party ----
  const party = useMemo(() => {
    const seen = new Map<string, Member>();
    for (const m of members) if (m.character) seen.set(m.character.id, m);
    if (me.character) seen.set(me.character.id, me);
    return [...seen.values()];
  }, [members, me]);
  const partyChars = useMemo(() => party.map((m) => m.character!), [party]);
  const dmPresent = members.some((m) => m.role === "dm") || isDM;

  const log = useCallback((text: string, kind: LogEntry["kind"] = "system") => {
    send({ type: "log", entry: { id: newId(), kind, who: myName, color: myColor, text, at: Date.now() } });
  }, [send, myName, myColor]);

  // ---- dice engine ----
  const [die, setDie] = useState(20);
  const [count, setCount] = useState(1);
  const [check, setCheck] = useState<string>("Attack");
  const [trayMode, setTrayMode] = useState<"auto" | RollMode>("auto");
  const [secret, setSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [last, setLast] = useState<RollEntry | null>(null);

  const roll = useCallback((o: RollOpts & { after?: (e: RollEntry) => void }) => new Promise<RollEntry | null>((resolve) => {
    if (busyRef.current) return resolve(null);
    const c = charRef.current;
    let mode: RollMode = "normal";
    let reason = "";
    const isD20 = /^1?d20([+-]\d+)?$/i.test(o.expr.replace(/\s/g, ""));
    if (isD20 && (o.kind === "attack" || o.kind === "check" || o.kind === "save")) {
      if (trayMode !== "auto") {
        mode = trayMode;
        reason = trayMode === "adv" ? "Advantage" : trayMode === "dis" ? "Disadvantage" : "";
      } else if (c) {
        const r = modeFromConditions(c.conditions ?? [], o.kind, o.ability);
        if (r.autoFail) {
          log(`${myName} automatically fails the ${o.label} (${r.reason.split(":")[0]}).`);
          return resolve(null);
        }
        mode = r.mode;
        reason = r.reason;
      }
    }
    busyRef.current = true;
    setBusy(true);
    const r = rollExpr(o.expr, mode, o.crit);
    const label = reason ? `${o.label} · ${reason}` : o.label;
    const entry: RollEntry = {
      id: newId(), who: myName, color: myColor, label, expr: o.crit ? `${o.expr} (crit)` : o.expr,
      dice: r.parts.map((p) => p.value), modifier: r.modifier, total: r.total, nat: r.nat, hidden: o.hidden, req: o.req,
      byClient: me.clientId, at: Date.now(), parts: r.parts.map(({ sides, value, dropped }) => ({ sides, value, dropped })), mode, skin: c?.diceSkin ?? "gilded", kind: o.kind,
    };
    setLast(entry);
    send({ type: "roll", entry });
    setTimeout(() => {
      if (!o.hidden) {
        const nat = r.nat === 20 ? " — NATURAL 20!" : r.nat === 1 ? " — natural 1" : "";
        const verb = o.kind === "heal" ? "heals" : o.kind === "damage" ? "damage" : "";
        send({ type: "log", entry: { id: newId(), kind: "roll", who: myName, color: myColor, text: `${label}: ${r.total}${verb === "heals" ? " HP" : ""} (${entry.expr} → ${formatParts(r.parts)}${r.modifier ? ` ${fmt(r.modifier)}` : ""})${nat}`, at: Date.now() } });
      }
      busyRef.current = false;
      setBusy(false);
      o.after?.(entry);
      resolve(entry);
    }, 1550);
  }), [trayMode, log, myName, myColor, me.clientId, send]);

  const engine: Engine = useMemo(() => ({ roll, busy }), [roll, busy]);

  // ---- 3D dice for everyone's rolls ----
  const newestRoll = state.rolls[0];
  const throwData: Throw | null = useMemo(() => {
    if (!newestRoll) return null;
    const hide = newestRoll.hidden && newestRoll.byClient !== me.clientId;
    const parts = newestRoll.parts ?? newestRoll.dice.map((v) => ({ sides: 20, value: v }));
    return {
      id: newestRoll.id, who: newestRoll.who, color: newestRoll.color, label: hide ? "secret roll" : newestRoll.label,
      total: hide ? "?" : newestRoll.total, skin: newestRoll.skin, nat: hide ? null : newestRoll.nat, at: newestRoll.at,
      parts: hide ? parts.map((p) => ({ ...p, value: Math.max(1, Math.ceil(p.sides / 2)) })) : parts,
    };
  }, [newestRoll, me.clientId]);

  // ---- AI DM ----
  const busyDM = useRef(false);
  const [dmBusy, setDmBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const addFoes = useCallback((foes: InitEntry[]) => {
    send({ type: "init-upsert", entries: foes });
    const taken = new Set(Object.values(stateRef.current.tokens).map((k) => `${k.x},${k.y}`));
    let x = COLS - 3, y = 2;
    for (const f of foes) {
      while (taken.has(`${x},${y}`)) { y++; if (y >= ROWS - 1) { y = 2; x--; } }
      taken.add(`${x},${y}`);
      send({ type: "token", id: f.id, token: { x, y, label: f.name.slice(0, 2).replace(/\s/g, ""), color: "#F06A5A", kind: "foe", name: f.name } });
    }
  }, [send]);

  const askDM = useCallback(async (action: string) => {
    if (busyDM.current) return;
    busyDM.current = true;
    setDmBusy(true);
    setAiNote(null);
    const id = newId();
    let text = "";
    try {
      await saveNow().catch(() => {});
      const st = stateRef.current;
      send({ type: "log-patch", id, text: "", streaming: true });
      let lastSent = 0;
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: code,
          tone: st.tone,
          scene: st.scene,
          action,
          recap: st.recaps[st.recaps.length - 1]?.text,
          quests: st.journal.filter((j) => j.kind === "quest" && !j.done).map((j) => j.title),
          party: party.map((m) => ({ ...m.character!, backstory: m.character!.id === charRef.current?.id ? charRef.current?.notes : undefined })),
          log: st.log.filter((l) => !l.streaming).slice(-40).map((l) => ({ who: l.who, kind: l.kind, text: l.text })),
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
      // structured tags
      const scene = text.match(SCENE_RE);
      if (scene) {
        send({ type: "settings", scene: scene[1].trim() });
        send({ type: "journal-add", entry: { id: newId(), kind: "place", title: scene[1].trim(), at: Date.now() } });
      }
      const foes: InitEntry[] = [];
      for (const f of text.matchAll(new RegExp(FOE_RE.source, "gi"))) {
        foes.push({ id: newId(), name: f[1].trim(), hp: Number(f[2]), maxHp: Number(f[2]), ac: Number(f[3]), init: Number(f[4]), kind: "foe", color: "#F06A5A" });
      }
      if (foes.length) addFoes(foes);
      for (const n of text.matchAll(new RegExp(NPC_RE.source, "gi"))) send({ type: "journal-add", entry: { id: newId(), kind: "npc", title: n[1].trim(), text: n[2].trim(), at: Date.now() } });
      for (const q of text.matchAll(new RegExp(QUEST_DONE_RE.source, "gi"))) {
        const j = stateRef.current.journal.find((x) => x.kind === "quest" && x.title.toLowerCase() === q[1].trim().toLowerCase());
        if (j) send({ type: "journal-update", id: j.id, patch: { done: true } });
      }
      for (const q of text.matchAll(new RegExp(QUEST_RE.source, "gi"))) send({ type: "journal-add", entry: { id: newId(), kind: "quest", title: q[1].trim(), at: Date.now() } });
      for (const l of lootLines(text)) send({ type: "journal-add", entry: { id: newId(), kind: "loot", title: l, at: Date.now() } });
    } catch {
      send({ type: "log-patch", id, text: text + "\n\n(Connection to the AI DM dropped.)", streaming: false });
    } finally {
      busyDM.current = false;
      setDmBusy(false);
    }
  }, [code, party, saveNow, send, addFoes]);

  // ---- loot from the AI lands in my bag ----
  useEffect(() => {
    if (!char) return;
    const name = char.name.toLowerCase();
    const found: { key: string; item?: string; gold?: number }[] = [];
    for (const l of state.log) {
      if (l.kind !== "ai" || l.streaming) continue;
      let i = 0;
      for (const m of l.text.matchAll(new RegExp(LOOT_RE.source, "gi"))) {
        const key = `${l.id}:l${i++}`;
        if (m[1].trim().toLowerCase() === name && !char.lootSeen.includes(key)) found.push({ key, item: m[2].trim() });
      }
      i = 0;
      for (const m of l.text.matchAll(new RegExp(GOLD_RE.source, "gi"))) {
        const key = `${l.id}:g${i++}`;
        if (m[1].trim().toLowerCase() === name && !char.lootSeen.includes(key)) found.push({ key, gold: Number(m[2]) });
      }
    }
    if (!found.length) return;
    const t = setTimeout(() => update((c) => {
      let inventory = [...c.inventory];
      let gold = c.gold;
      for (const f of found) {
        if (f.gold) gold += f.gold;
        if (f.item) {
          const ex = inventory.find((x) => x.name.toLowerCase() === f.item!.toLowerCase());
          inventory = ex ? inventory.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x)) : [...inventory, { id: newId(), name: f.item, qty: 1 }];
        }
      }
      return { ...c, inventory, gold, lootSeen: [...c.lootSeen, ...found.map((f) => f.key)].slice(-200) };
    }), 0);
    return () => clearTimeout(t);
  }, [state.log, char, update]);

  // ---- gifts, healing and reactions from other players ----
  const [floating, setFloating] = useState<{ id: string; emoji: string; who: string; left: number }[]>([]);
  useEffect(() => onEvent((m: Msg) => {
    const c = charRef.current;
    if (m.type === "react") {
      const f = { id: m.reaction.id, emoji: m.reaction.emoji, who: m.reaction.who, left: 10 + Math.random() * 80 };
      setFloating((x) => [...x.slice(-14), f]);
      setTimeout(() => setFloating((x) => x.filter((y) => y.id !== f.id)), 2700);
    }
    if (!c) return;
    if (m.type === "give" && m.toId === c.id && !c.lootSeen.includes(m.id)) {
      update((x) => {
        let inventory = [...x.inventory];
        if (m.item) {
          const ex = inventory.find((i) => i.name.toLowerCase() === m.item!.name.toLowerCase());
          inventory = ex ? inventory.map((i) => (i === ex ? { ...i, qty: i.qty + m.item!.qty } : i)) : [...inventory, { id: newId(), name: m.item.name, qty: m.item.qty }];
        }
        return { ...x, inventory, gold: x.gold + (m.gold ?? 0), lootSeen: [...x.lootSeen, m.id].slice(-200) };
      });
    }
    if (m.type === "heal" && m.toId === c.id && !c.lootSeen.includes(m.id)) {
      update((x) => ({ ...x, hp: x.hp + m.amount, lootSeen: [...x.lootSeen, m.id].slice(-200) }));
    }
  }), [onEvent, update]);

  const heal = useCallback((toId: string, amount: number) => {
    if (charRef.current && toId === charRef.current.id) update((c) => ({ ...c, hp: c.hp + amount }));
    else send({ type: "heal", toId, amount, fromName: myName, id: newId() });
    const who = partyChars.find((p) => p.id === toId)?.name ?? "the target";
    log(`${myName} heals ${who === myName ? "themself" : who} for ${amount} HP.`);
  }, [update, send, myName, partyChars, log]);

  const give = useCallback((toId: string, item: { name: string; qty: number } | null, gold?: number) => {
    send({ type: "give", toId, fromName: myName, item: item ?? undefined, gold, id: newId() });
  }, [send, myName]);

  // ---- roll requests from the AI ----
  function answerRequest(entry: LogEntry, req: RollReq) {
    if (!char) return;
    const isInit = /^init/i.test(req.check);
    const mod = checkMod(char, req.check);
    const reqId = `${entry.id}:${req.idx}`;
    const lc = req.check.toLowerCase();
    const ability = (ABILITIES.find((a) => lc.startsWith(a.toLowerCase()) || lc.startsWith(ABILITY_NAMES[a].toLowerCase())) as Ability | undefined);
    const kind = lc.startsWith("attack") ? "attack" : lc.includes("save") ? "save" : "check";
    roll({
      expr: `1d20${fmt(mod)}`, label: `${req.check}${req.target ? ` (${req.target})` : ""}`, kind, ability, req: reqId,
      after: (e) => {
        if (isInit) {
          const d = derive(char);
          send({ type: "init-upsert", entries: [{ id: char.id, name: char.name, init: e.total, kind: "pc", color: char.color, hp: Math.min(char.hp, d.maxHp), maxHp: d.maxHp, ac: d.ac }] });
        }
        if (!aiMode) return;
        const reqs = parseRequests(entry.text);
        const done = new Map(stateRef.current.rolls.filter((r) => r.req?.startsWith(entry.id + ":")).map((r) => [r.req!, r]));
        done.set(reqId, e);
        const present = new Set(party.map((p) => p.character!.name.toLowerCase()));
        const outstanding = reqs.filter((r) => !done.has(`${entry.id}:${r.idx}`) && present.has(r.who.toLowerCase()));
        if (outstanding.length === 0) {
          const summary = reqs
            .map((r) => {
              const x = done.get(`${entry.id}:${r.idx}`);
              return x ? `${r.who} rolled ${r.check}${r.target ? ` vs ${r.target}` : ""}: ${x.total} (natural ${x.nat ?? x.dice[0]}, ${fmt(x.modifier)})` : null;
            })
            .filter(Boolean)
            .join("; ");
          setTimeout(() => askDM(`Roll results — ${summary}. Resolve them and continue.`), 300);
        }
      },
    });
  }

  function trayRoll() {
    if (die === 20 && count === 1 && char) {
      if (check === "Initiative") return rollInitiative();
      const lc = check.toLowerCase();
      const ability = ABILITIES.find((a) => lc.startsWith(ABILITY_NAMES[a].toLowerCase()));
      const kind = check === "Attack" ? "attack" : lc.includes("save") ? "save" : "check";
      roll({ expr: `1d20${fmt(checkMod(char, check))}`, label: check, kind, ability, hidden: isDM && secret });
    } else {
      roll({ expr: `${count}d${die}`, label: `${count}d${die}`, kind: "free", hidden: isDM && secret });
    }
  }

  function rollInitiative() {
    if (!char) return;
    roll({
      expr: `1d20${fmt(checkMod(char, "Initiative"))}`, label: "Initiative", kind: "check", ability: "DEX",
      after: (e) => {
        const d = derive(char);
        send({ type: "init-upsert", entries: [{ id: char.id, name: char.name, init: e.total, kind: "pc", color: char.color, hp: Math.min(char.hp, d.maxHp), maxHp: d.maxHp, ac: d.ac }] });
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
    send({ type: "log", entry: { id: newId(), kind: isDM ? "dm" : "player", who: myName, color: myColor, text, at: Date.now() } });
    if (aiMode && !isDM) askDM(`${myName}: ${text}`);
  }

  // ---- recap ----
  const [recapBusy, setRecapBusy] = useState(false);
  async function writeRecap() {
    setRecapBusy(true);
    setAiNote(null);
    try {
      await saveNow().catch(() => {});
      const st = stateRef.current;
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: code, scene: st.scene, previous: st.recaps[st.recaps.length - 1]?.text, log: st.log.filter((l) => !l.streaming).map((l) => ({ who: l.who, kind: l.kind, text: l.text })) }),
      });
      if (!res.ok) {
        setAiNote(await res.text());
        return;
      }
      const { text } = (await res.json()) as { text: string };
      send({ type: "recap", recap: { id: newId(), text, at: Date.now() } });
    } catch {
      setAiNote("Couldn't reach the recap writer.");
    } finally {
      setRecapBusy(false);
    }
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
  const condById = useMemo(() => new Map(partyChars.map((p) => [p.id, p.conditions ?? []])), [partyChars]);
  function clickCell(x: number, y: number) {
    const hit = byCell.get(`${x},${y}`);
    if (hit) return setSelected(hit[0]);
    if (!selected || !state.tokens[selected]) return;
    send({ type: "token", id: selected, token: { ...state.tokens[selected], x, y } });
  }

  // ---- log autoscroll ----
  const logRef = useRef<HTMLDivElement>(null);
  const lastLog = state.log[state.log.length - 1];
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log.length, lastLog?.text]);

  const [tab, setTab] = useState<StoryTab>("Story");
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const d = char ? derive(char) : null;
  const shown = last;
  const crit = !busy && shown?.nat === 20;
  const fumble = !busy && shown?.nat === 1;
  const skin = skinById(char?.diceSkin);
  const checkOptions = ["Attack", "Initiative", ...(Object.keys(SKILLS) as Skill[]), ...ABILITIES.map((a) => `${ABILITY_NAMES[a]} save`), ...ABILITIES.map((a) => ABILITY_NAMES[a])];
  const latestRecap = state.recaps[state.recaps.length - 1];
  const openQuests = state.journal.filter((j) => j.kind === "quest" && !j.done).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Dice3D throwData={throwData} />

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
            <button type="button" onClick={() => { if (confirm("Start a new session? This clears the story log, rolls, initiative and map for everyone. The journal, recaps and dice stats stay.")) send({ type: "reset" }); }} className="min-h-10 rounded-lg border border-[#4A2A20] px-3 text-sm font-semibold text-[#F28B7E]">New session</button>
            <button type="button" onClick={leave} className="min-h-10 rounded-lg border border-line-2 px-3 text-sm text-soft">Change seat</button>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-wrap gap-5 p-4 md:p-5">
        {/* ---------- party + sheet ---------- */}
        <aside className="order-3 flex flex-[1_1_300px] flex-col gap-3 lg:order-none lg:max-w-[340px]">
          <Label>PARTY</Label>
          {party.length === 0 && <p className="text-sm text-muted">No one has a character seated yet.</p>}
          {party.map((m) => {
            const c = m.character!;
            const mine = c.id === char?.id;
            const turn = c.id === activeId;
            const max = mine && d ? d.maxHp : c.maxHp;
            const hp = Math.min(max, mine && char ? char.hp : c.hp);
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
                <div className="flex justify-between text-xs"><span className="text-muted">HP</span><b className="text-parch-hi">{hp} / {max}</b></div>
                <HpBar hp={hp} max={max} />
                {(c.conditions ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.conditions.map((n) => <span key={n} className="rounded-md bg-[#2E1C14] px-2 py-0.5 text-[11px] font-bold tracking-[.6px] text-[#F0956B]">{n.toUpperCase()}</span>)}
                  </div>
                )}
                {mine && (
                  <div className="flex gap-2">
                    {[-5, -1, 1, 5].map((n) => (
                      <button key={n} type="button" onClick={() => update((x) => ({ ...x, hp: x.hp + n }))} aria-label={`${n > 0 ? "Heal" : "Damage"} ${Math.abs(n)}`}
                        className={`min-h-10 flex-1 rounded-lg text-sm font-bold ${n < 0 ? "border border-[#4A2A20] bg-[#2A1714] text-[#F28B7E]" : "border border-[#1F4A30] bg-[#16301F] text-[#6EE7A0]"}`}>
                        {n > 0 ? `+${n}` : n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {char && d && (
            <>
              <div className="grid grid-cols-6 gap-1.5">
                {ABILITIES.map((a) => (
                  <button key={a} type="button" disabled={busy} onClick={() => roll({ expr: `1d20${fmt(d.m(a))}`, label: `${ABILITY_NAMES[a]} check`, kind: "check", ability: a })}
                    className="flex flex-col items-center rounded-lg border border-gold-line bg-gold-panel py-1.5" aria-label={`Roll ${ABILITY_NAMES[a]} check`}>
                    <span className="text-[10px] font-bold text-soft">{a}</span>
                    <span className="font-display text-base font-extrabold text-gold">{fmt(d.m(a))}</span>
                  </button>
                ))}
              </div>
              <SheetPanel char={char} party={partyChars} engine={engine} update={update} log={(t) => log(t)} heal={heal} give={give} />
            </>
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
                const conds = hit ? condById.get(hit[0]) ?? [] : [];
                return (
                  <button key={i} type="button" onClick={() => clickCell(x, y)} aria-label={hit ? `${hit[1].name}${conds.length ? ` (${conds.join(", ")})` : ""}` : `Square ${x + 1}, ${y + 1}`}
                    className="relative flex aspect-square items-center justify-center hover:brightness-125" style={{ background: (x + y) % 2 ? "#24252E" : "#272833" }}>
                    {hit && (
                      <span className="flex h-[78%] w-[78%] items-center justify-center rounded-full font-display text-[clamp(9px,1.1vw,15px)] font-extrabold text-ink transition-all"
                        style={{ background: hit[1].color, boxShadow: `0 0 0 3px ${hit[1].kind === "foe" ? "#2A1714" : "#0E0F14"}${sel ? ", 0 0 0 6px #E8B84A" : ""}` }}>
                        {hit[1].label}
                      </span>
                    )}
                    {conds.length > 0 && <span className="absolute right-[8%] top-[8%] h-[22%] w-[22%] rounded-full border-2 border-ink bg-[#F0956B]" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
              <span className="hidden rounded-lg border border-gold-line sm:inline bg-[rgba(14,15,20,.85)] px-2.5 py-1.5 font-display text-[13px] font-bold tracking-[1px] text-gold">{state.scene.toUpperCase()}</span>
              <span className="hidden rounded-lg border border-line bg-[rgba(14,15,20,.85)] px-2.5 py-1.5 text-xs font-semibold text-soft sm:inline">Tap a token, then a square to move it</span>
            </div>
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {floating.map((f) => (
                <span key={f.id} className="float-up absolute bottom-4 flex flex-col items-center" style={{ left: `${f.left}%` }}>
                  <span className="text-4xl">{f.emoji}</span>
                  <span className="rounded-md bg-[rgba(14,15,20,.8)] px-1.5 text-[11px] font-semibold text-soft">{f.who}</span>
                </span>
              ))}
            </div>
          </div>

          <section aria-label="Story" className="flex flex-col rounded-2xl border border-line bg-[#14151C]">
            <div className="flex flex-wrap gap-1 border-b border-line px-3 pt-3" role="tablist">
              {(["Story", "Journal", "Recaps", "Stats"] as StoryTab[]).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`min-h-10 rounded-t-lg px-4 text-sm font-semibold ${tab === t ? "border-b-2 border-gold text-parch-hi" : "text-muted"}`}>
                  {t}{t === "Journal" && openQuests ? ` · ${openQuests}` : ""}
                </button>
              ))}
            </div>
            {tab === "Story" && (
              <>
                <div ref={logRef} className="flex max-h-[460px] min-h-[220px] flex-col gap-3.5 overflow-y-auto px-5 py-5">
                  {latestRecap && state.log.length < 4 && (
                    <article className="rise flex flex-col gap-2 rounded-xl border border-arcane-line bg-arcane-panel p-4">
                      <span className="text-[11px] font-bold tracking-[1.8px] text-arcane-soft">PREVIOUSLY ON…</span>
                      <p className="m-0 font-story text-lg leading-relaxed text-parch">{latestRecap.text}</p>
                    </article>
                  )}
                  {state.log.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <span className="font-display text-xl font-bold text-parch-hi">The table is set.</span>
                      <span className="max-w-md text-sm text-muted">{aiMode ? "When the party's seated, start the adventure and the AI DM will set the scene." : "DM: describe the opening scene below. Players: type what your character does."}</span>
                      {aiMode && (
                        <button type="button" disabled={dmBusy} onClick={() => askDM(latestRecap ? "Open the new session: briefly recall where we left off, then continue the story." : "Begin the adventure: introduce the setting, bring the party together, and present a hook.")}
                          className="mt-2 min-h-12 rounded-xl bg-arcane px-6 font-display font-extrabold tracking-[1.5px] text-[#0B1322] disabled:opacity-50">{latestRecap ? "CONTINUE THE CAMPAIGN" : "BEGIN THE ADVENTURE"}</button>
                      )}
                    </div>
                  )}
                  {state.log.map((l) => <LogLine key={l.id} entry={l} rolls={state.rolls} myName={char?.name} onRoll={answerRequest} canRoll={!busy} />)}
                </div>
                <div className="flex flex-wrap gap-1.5 border-t border-line px-4 pt-3" aria-label="Reactions">
                  {REACTIONS.map((e) => (
                    <button key={e} type="button" aria-label={`React ${e}`} onClick={() => send({ type: "react", reaction: { id: newId(), emoji: e, who: myName, color: myColor } })}
                      className="h-10 w-10 rounded-lg bg-panel-2 text-xl transition hover:scale-110">{e}</button>
                  ))}
                </div>
                <form onSubmit={submitAction} className="flex flex-wrap items-end gap-2.5 p-4">
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
              </>
            )}
            {tab === "Journal" && <JournalPanel journal={state.journal} send={send} me={myName} />}
            {tab === "Recaps" && <RecapsPanel recaps={state.recaps} busy={recapBusy} onRecap={writeRecap} aiNote={aiNote} />}
            {tab === "Stats" && <StatsPanel stats={state.stats} />}
          </section>
        </main>

        {/* ---------- dice + initiative ---------- */}
        <aside className="order-2 flex flex-[1_1_280px] flex-col gap-3.5 lg:order-none lg:max-w-[330px]">
          <section aria-label="Dice tray" className="flex flex-col items-center gap-4 rounded-2xl border border-gold-line bg-gold-panel px-4 py-5">
            <span className="self-start"><Label>DICE TRAY</Label></span>
            <D20 value={shown ? shown.total : 20} rolling={busy} spin={state.rolls.length} sides={die} size={120} crit={crit} fumble={fumble} />
            <div className="flex min-h-[48px] flex-col items-center">
              <span className={`font-display text-2xl font-extrabold ${crit ? "text-gold" : fumble ? "text-[#F28B7E]" : "text-parch-hi"}`}>
                {busy ? "Rolling…" : crit ? "CRITICAL!" : fumble ? "FUMBLE" : shown ? `${shown.total}` : "Ready"}
              </span>
              <span className="text-center text-sm text-soft">{busy ? "The table is watching" : shown ? `${shown.label} · ${shown.expr}` : `Dice skin: ${skin.name}`}</span>
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
            <div className="grid w-full grid-cols-4 gap-1.5" role="radiogroup" aria-label="Advantage">
              {([["auto", "Auto"], ["adv", "Adv"], ["normal", "Normal"], ["dis", "Dis"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={trayMode === k} onClick={() => setTrayMode(k)}
                  className={`min-h-9 rounded-lg text-xs font-bold ${trayMode === k ? "bg-[#33291A] text-gold ring-1 ring-gold" : "border border-gold-line text-[#D9CFB5]"}`}>{l}</button>
              ))}
            </div>
            {trayMode === "auto" && char && char.conditions.length > 0 && (
              <span className="self-start text-xs text-[#F0956B]">Conditions apply: {char.conditions.join(", ")}</span>
            )}
            {isDM && (
              <label className="flex items-center gap-2 self-start text-sm text-soft">
                <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} className="h-5 w-5 accent-[#E8B84A]" /> Secret roll (only you see it)
              </label>
            )}
            <button type="button" onClick={trayRoll} disabled={busy}
              className="min-h-14 w-full rounded-xl bg-gold font-display text-lg font-extrabold tracking-[2px] text-gold-ink disabled:opacity-60">
              ROLL {count > 1 ? count : ""}D{die}
            </button>
          </section>

          <section aria-label="Initiative" className="flex flex-col gap-2.5 rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <Label>INITIATIVE</Label>
              <div className="flex gap-2">
                {char && <button type="button" onClick={rollInitiative} disabled={busy} className="min-h-9 rounded-lg border border-gold px-2.5 text-xs font-semibold text-gold">Roll mine</button>}
                <button type="button" onClick={nextTurn} disabled={!state.init.length} className="min-h-9 rounded-lg bg-panel-2 px-2.5 text-xs font-semibold text-parch disabled:opacity-40">Next turn</button>
              </div>
            </div>
            {state.init.length === 0 && <p className="text-sm text-muted">No fight yet. Roll initiative when combat starts.</p>}
            {state.init.map((i) => (
              <div key={i.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${i.id === activeId ? "bg-[#2A2312]" : ""}`}>
                <span className="w-7 text-center font-display font-extrabold text-gold">{i.init}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color ?? "#C9CDD9" }} />
                <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${i.kind === "foe" && i.hp === 0 ? "text-muted line-through" : "text-parch-hi"}`}>{i.name}</span>
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
  const loot = entry.kind === "ai" && !entry.streaming ? lootLines(entry.text) : [];
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
        {loot.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {loot.map((l) => <span key={l} className="rounded-lg border border-gold-line bg-gold-panel px-3 py-1.5 text-xs font-semibold text-gold">{l}</span>)}
          </div>
        )}
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
