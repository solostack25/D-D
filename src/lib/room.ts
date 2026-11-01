"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "./supabase";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { PublicCharacter } from "./character";

export type Role = "player" | "dm";

export interface Member {
  clientId: string;
  role: Role;
  character: PublicCharacter | null;
  joinedAt: number;
}

export interface LogEntry {
  id: string;
  kind: "ai" | "dm" | "player" | "roll" | "system";
  who?: string;
  color?: string;
  text: string;
  at: number;
  streaming?: boolean;
}

export interface RollEntry {
  id: string;
  who: string;
  color?: string;
  label: string;
  expr: string;
  dice: number[];
  modifier: number;
  total: number;
  nat: number | null;
  hidden?: boolean; // DM secret roll
  req?: string; // roll request this answers ("<logId>:<index>")
  parts?: { sides: number; value: number; dropped?: boolean }[];
  mode?: "normal" | "adv" | "dis";
  skin?: string;
  kind?: "check" | "attack" | "damage" | "heal" | "save" | "free";
  byClient: string;
  at: number;
}

export interface InitEntry {
  id: string;
  name: string;
  init: number;
  kind: "pc" | "foe";
  color?: string;
  hp?: number;
  maxHp?: number;
  ac?: number;
}

export interface Token {
  x: number;
  y: number;
  label: string;
  color: string;
  kind: "pc" | "foe";
  name: string;
}

export interface JournalEntry {
  id: string;
  kind: "npc" | "place" | "quest" | "loot" | "note";
  title: string;
  text?: string;
  done?: boolean;
  by?: string;
  at: number;
}

export interface Recap {
  id: string;
  text: string;
  at: number;
}

export interface DiceStats {
  rolls: number;
  d20s: number;
  d20sum: number;
  nat20: number;
  nat1: number;
  best: number;
  color?: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  who: string;
  color?: string;
}

export interface RoomState {
  mode: "ai" | "human";
  tone: string;
  scene: string;
  log: LogEntry[];
  rolls: RollEntry[];
  init: InitEntry[];
  turn: number;
  round: number;
  turnTaken?: boolean; // becomes true once someone presses "Next turn"
  tokens: Record<string, Token>;
  journal: JournalEntry[];
  recaps: Recap[];
  stats: Record<string, DiceStats>;
  updatedAt: number;
}

export const initialRoom = (): RoomState => ({
  mode: "ai",
  tone: "Heroic",
  scene: "The Crossroads Inn",
  log: [],
  rolls: [],
  init: [],
  turn: 0,
  round: 1,
  tokens: {},
  journal: [],
  recaps: [],
  stats: {},
  updatedAt: 0,
});

/** Fill in fields added after a room was first saved. */
export const normalizeRoom = (s: Partial<RoomState>): RoomState => ({ ...initialRoom(), ...s });

export type Msg =
  | { type: "log"; entry: LogEntry }
  | { type: "log-patch"; id: string; text: string; streaming?: boolean }
  | { type: "roll"; entry: RollEntry }
  | { type: "settings"; mode?: RoomState["mode"]; tone?: string; scene?: string }
  | { type: "init"; init: InitEntry[]; turn: number; round: number }
  | { type: "init-upsert"; entries: InitEntry[] }
  | { type: "init-patch"; id: string; hp: number }
  | { type: "init-remove"; id: string }
  | { type: "turn"; turn: number; round: number }
  | { type: "token"; id: string; token: Token | null }
  | { type: "hello"; from: string }
  | { type: "snapshot"; to: string; state: RoomState }
  | { type: "journal-add"; entry: JournalEntry }
  | { type: "journal-update"; id: string; patch: Partial<JournalEntry> }
  | { type: "journal-remove"; id: string }
  | { type: "recap"; recap: Recap }
  | { type: "react"; reaction: Reaction }
  | { type: "give"; toId: string; fromName: string; item?: { name: string; qty: number }; gold?: number; id: string }
  | { type: "heal"; toId: string; fromName: string; amount: number; id: string }
  | { type: "reset" };

function reduce(s: RoomState, m: Msg): RoomState {
  const now = Date.now();
  switch (m.type) {
    case "log":
      if (s.log.some((l) => l.id === m.entry.id)) return s;
      return { ...s, log: [...s.log, m.entry].slice(-200), updatedAt: now };
    case "log-patch": {
      const exists = s.log.some((l) => l.id === m.id);
      if (!exists) return { ...s, log: [...s.log, { id: m.id, kind: "ai" as const, who: "AI DM", text: m.text, at: now, streaming: m.streaming }].slice(-200), updatedAt: now };
      return { ...s, log: s.log.map((l) => (l.id === m.id ? { ...l, text: m.text, streaming: m.streaming } : l)), updatedAt: now };
    }
    case "roll": {
      if (s.rolls.some((r) => r.id === m.entry.id)) return s;
      const e = m.entry;
      const st = { ...(s.stats[e.who] ?? { rolls: 0, d20s: 0, d20sum: 0, nat20: 0, nat1: 0, best: 0 }) };
      st.rolls += 1;
      st.color = e.color;
      if (e.nat != null && !e.hidden) {
        st.d20s += 1;
        st.d20sum += e.nat;
        if (e.nat === 20) st.nat20 += 1;
        if (e.nat === 1) st.nat1 += 1;
      }
      if (!e.hidden) st.best = Math.max(st.best, e.total);
      return { ...s, rolls: [e, ...s.rolls].slice(0, 60), stats: { ...s.stats, [e.who]: st }, updatedAt: now };
    }
    case "journal-add":
      if (s.journal.some((j) => j.id === m.entry.id || (j.kind === m.entry.kind && j.title.toLowerCase() === m.entry.title.toLowerCase()))) return s;
      return { ...s, journal: [...s.journal, m.entry].slice(-300), updatedAt: now };
    case "journal-update":
      return { ...s, journal: s.journal.map((j) => (j.id === m.id ? { ...j, ...m.patch } : j)), updatedAt: now };
    case "journal-remove":
      return { ...s, journal: s.journal.filter((j) => j.id !== m.id), updatedAt: now };
    case "recap":
      if (s.recaps.some((r) => r.id === m.recap.id)) return s;
      return { ...s, recaps: [...s.recaps, m.recap].slice(-30), updatedAt: now };
    case "settings":
      return { ...s, mode: m.mode ?? s.mode, tone: m.tone ?? s.tone, scene: m.scene ?? s.scene, updatedAt: now };
    case "init":
      return { ...s, init: m.init, turn: m.turn, round: m.round, updatedAt: now };
    case "init-upsert": {
      const activeId = s.init[s.turn]?.id;
      const ids = new Set(m.entries.map((e) => e.id));
      const init = [...s.init.filter((x) => !ids.has(x.id)), ...m.entries].sort((a, b) => b.init - a.init);
      const turn = s.turnTaken && activeId ? Math.max(0, init.findIndex((x) => x.id === activeId)) : 0;
      return { ...s, init, turn, updatedAt: now };
    }
    case "init-patch":
      return { ...s, init: s.init.map((x) => (x.id === m.id ? { ...x, hp: m.hp } : x)), updatedAt: now };
    case "init-remove": {
      const init = s.init.filter((x) => x.id !== m.id);
      return { ...s, init, turn: Math.min(s.turn, Math.max(0, init.length - 1)), turnTaken: init.length ? s.turnTaken : false, round: init.length ? s.round : 1, updatedAt: now };
    }
    case "turn":
      return { ...s, turn: m.turn, round: m.round, turnTaken: true, updatedAt: now };
    case "token": {
      const tokens = { ...s.tokens };
      if (m.token) tokens[m.id] = m.token;
      else delete tokens[m.id];
      return { ...s, tokens, updatedAt: now };
    }
    case "reset":
      // new session: clear the table but keep the campaign (journal, recaps, stats, scene)
      return { ...initialRoom(), mode: s.mode, tone: s.tone, scene: s.scene, journal: s.journal, recaps: s.recaps, stats: s.stats, updatedAt: now };
    default:
      return s;
  }
}

type Action = { msg: Msg } | { replace: RoomState };
function reducer(s: RoomState, a: Action) {
  return "replace" in a ? normalizeRoom(a.replace) : reduce(s, a.msg);
}

interface Transport {
  send(msg: Msg): void;
  track(meta: Member): void;
  close(): void;
  live: boolean; // true = Supabase (cross-device), false = this browser only
}

export const realtimeEnabled = supabaseEnabled;

function supabaseTransport(code: string, clientId: string, onMsg: (m: Msg) => void, onMembers: (m: Member[]) => void): Transport {
  const sb = supabase()!;
  let meta: Member | null = null;
  let ready = false;
  const ch: RealtimeChannel = sb.channel(`tavernlight:${code}`, { config: { broadcast: { self: false }, presence: { key: clientId } } });
  ch.on("broadcast", { event: "msg" }, ({ payload }) => onMsg(payload as Msg));
  ch.on("presence", { event: "sync" }, () => {
    const st = ch.presenceState<Member>();
    onMembers(Object.values(st).map((arr) => arr[arr.length - 1] as unknown as Member));
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      ready = true;
      if (meta) ch.track(meta);
      ch.send({ type: "broadcast", event: "msg", payload: { type: "hello", from: clientId } satisfies Msg });
    }
  });
  return {
    live: true,
    send: (msg) => {
      onMsg(msg); // apply locally right away; others get it over the socket
      ch.send({ type: "broadcast", event: "msg", payload: msg });
    },
    track: (m) => {
      meta = m;
      if (ready) ch.track(m);
    },
    close: () => {
      sb.removeChannel(ch);
    },
  };
}

/** Fallback when Supabase isn't configured: syncs between tabs of this browser. */
function localTransport(code: string, clientId: string, onMsg: (m: Msg) => void, onMembers: (m: Member[]) => void): Transport {
  const bc = new BroadcastChannel(`tavernlight:${code}`);
  const seen = new Map<string, { m: Member; at: number }>();
  let meta: Member | null = null;
  const emit = () => onMembers([...seen.values()].map((v) => v.m));
  bc.onmessage = (e) => {
    const d = e.data as { kind: "msg"; msg: Msg } | { kind: "presence"; member: Member } | { kind: "leave"; id: string };
    if (d.kind === "msg") onMsg(d.msg);
    else if (d.kind === "presence") {
      seen.set(d.member.clientId, { m: d.member, at: Date.now() });
      emit();
    } else if (d.kind === "leave") {
      seen.delete(d.id);
      emit();
    }
  };
  const beat = () => {
    if (!meta) return;
    seen.set(clientId, { m: meta, at: Date.now() });
    bc.postMessage({ kind: "presence", member: meta });
    for (const [k, v] of seen) if (Date.now() - v.at > 7000) seen.delete(k);
    emit();
  };
  const iv = setInterval(beat, 2500);
  setTimeout(() => bc.postMessage({ kind: "msg", msg: { type: "hello", from: clientId } }), 50);
  return {
    live: false,
    send: (msg) => {
      bc.postMessage({ kind: "msg", msg });
      onMsg(msg);
    },
    track: (m) => {
      meta = m;
      beat();
    },
    close: () => {
      clearInterval(iv);
      bc.postMessage({ kind: "leave", id: clientId });
      bc.close();
    },
  };
}

export function getClientId() {
  try {
    let id = sessionStorage.getItem("tavernlight.client");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("tavernlight.client", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

const stateKey = (code: string) => `tavernlight.room.${code}`;

export function useRoom(code: string, me: Member | null) {
  const [state, dispatch] = useReducer(reducer, undefined, initialRoom);
  const [members, setMembers] = useState<Member[]>([]);
  const [live, setLive] = useState(false);
  const t = useRef<Transport | null>(null);
  const listeners = useRef(new Set<(m: Msg) => void>());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const clientId = me?.clientId;

  // restore saved state for this room
  useEffect(() => {
    try {
      const saved = localStorage.getItem(stateKey(code));
      if (saved) dispatch({ replace: JSON.parse(saved) as RoomState });
    } catch {}
  }, [code]);

  useEffect(() => {
    try {
      localStorage.setItem(stateKey(code), JSON.stringify(state));
    } catch {}
  }, [code, state]);

  // Load the saved campaign from the cloud, so a room picks up where it left off next session.
  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    let alive = true;
    sb.rpc("room_get", { p_code: code }).then(({ data }) => {
      const saved = data as RoomState | null;
      if (alive && saved && saved.updatedAt > stateRef.current.updatedAt) dispatch({ replace: saved });
    });
    return () => {
      alive = false;
    };
  }, [code]);

  // Save the room to the cloud a few seconds after it changes.
  useEffect(() => {
    const sb = supabase();
    if (!sb || state.updatedAt === 0 || state.log.some((l) => l.streaming)) return;
    const t = setTimeout(() => {
      sb.rpc("room_put", { p_code: code, p_state: { ...state, rolls: state.rolls.slice(0, 30), log: state.log.slice(-150) } }).then(() => {});
    }, 2500 + Math.random() * 1500);
    return () => clearTimeout(t);
  }, [code, state]);

  useEffect(() => {
    if (!clientId) return;
    const onMsg = (m: Msg) => {
      if (m.type === "hello") {
        if (m.from !== clientId && stateRef.current.updatedAt > 0) {
          t.current?.send({ type: "snapshot", to: m.from, state: stateRef.current });
        }
        return;
      }
      if (m.type === "snapshot") {
        if (m.to === clientId && m.state.updatedAt > stateRef.current.updatedAt) dispatch({ replace: m.state });
        return;
      }
      if (m.type === "react" || m.type === "give" || m.type === "heal") {
        listeners.current.forEach((fn) => fn(m));
        return;
      }
      dispatch({ msg: m });
    };
    const transport = realtimeEnabled ? supabaseTransport(code, clientId, onMsg, setMembers) : localTransport(code, clientId, onMsg, setMembers);
    t.current = transport;
    setLive(transport.live);
    return () => {
      transport.close();
      t.current = null;
    };
  }, [code, clientId]);

  const meKey = me ? JSON.stringify(me) : "";
  useEffect(() => {
    if (me && t.current) t.current.track(me);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meKey, live]);

  const send = useCallback((m: Msg) => t.current?.send(m), []);
  /** Listen for one-off events (reactions, gifts) that aren't stored in the room. */
  const onEvent = useCallback((fn: (m: Msg) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  /** Write the room to the cloud right away (the AI DM only answers for saved rooms). */
  const saveNow = useCallback(async () => {
    const sb = supabase();
    if (!sb) return;
    const st = stateRef.current;
    await sb.rpc("room_put", { p_code: code, p_state: { ...st, updatedAt: st.updatedAt || Date.now(), rolls: st.rolls.slice(0, 30), log: st.log.filter((l) => !l.streaming).slice(-150) } });
  }, [code]);

  return { state, members, send, live, onEvent, saveNow };
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export function makeRoomCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const D = "23456789";
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return pick(A, 4) + "-" + pick(D + A, 2);
}
