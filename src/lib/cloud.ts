"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CHARACTERS_CHANGED, loadCharacters, loadTombstones, mergeCharacters, type Character } from "./character";
import { supabase, supabaseEnabled } from "./supabase";

// A "hero code" is a secret phrase that holds a player's characters in the cloud.
// Enter it on any device to get your characters back. Treat it like a password.

const CODE_KEY = "tavernlight.herocode";
const WORDS = [
  "ASH", "BANE", "BARD", "BEAR", "BELL", "BLADE", "BOLT", "BONE", "BRAND", "BRIAR", "CAIRN", "CANDLE", "CINDER", "CLAW", "CLOAK", "COIN",
  "COPPER", "CROW", "CROWN", "DAGGER", "DAWN", "DEEP", "DRAKE", "DUNE", "DUSK", "EAGLE", "EMBER", "FANG", "FEN", "FERN", "FLAME", "FLINT",
  "FORGE", "FOX", "FROST", "GALE", "GATE", "GEM", "GHOST", "GLADE", "GLOOM", "GOLD", "GRIM", "GROVE", "HALL", "HAWK", "HEARTH", "HELM",
  "HOLLOW", "HORN", "IRON", "IVY", "JADE", "KEEP", "KNOT", "LANCE", "LARK", "LOCH", "LOTUS", "LYNX", "MAPLE", "MARSH", "MASK", "MEAD",
  "MIST", "MOON", "MOSS", "MOTH", "OAK", "OATH", "ONYX", "ORB", "OWL", "PEAK", "PINE", "QUILL", "RAVEN", "REED", "RIDGE", "RIVER",
  "ROGUE", "ROOK", "ROSE", "RUNE", "SABLE", "SAGE", "SALT", "SCROLL", "SHADE", "SHARD", "SHIELD", "SILVER", "SKULL", "SMOKE", "SPARK", "SPEAR",
  "SPIRE", "STAG", "STAR", "STONE", "STORM", "SWORD", "TALON", "THISTLE", "THORN", "TIDE", "TOME", "TORCH", "TOWER", "TRAIL", "VALE", "VEIL",
  "VINE", "VIPER", "WARD", "WAVE", "WHISPER", "WILD", "WILLOW", "WIND", "WING", "WISP", "WOLF", "WYRM", "YEW", "ZEPHYR", "ANVIL", "BRAMBLE",
];

export function makeHeroCode() {
  const r = new Uint32Array(5);
  crypto.getRandomValues(r);
  const w = Array.from(r.slice(0, 4), (n) => WORDS[n % WORDS.length]);
  return `${w.join("-")}-${1000 + (r[4] % 9000)}`;
}

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "-");

// ---- stored code as an external store so components update together ----
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === CODE_KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}
function readCode() {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}
export function useHeroCode() {
  return useSyncExternalStore(subscribe, readCode, () => null);
}

function setCode(code: string | null) {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {}
  emit();
}

// ---- sync ----
type Payload = (Character | { id: string; deleted: true; at: number })[];

async function fetchVault(code: string): Promise<{ chars: Character[]; tombs: Record<string, number> } | null> {
  const sb = supabase();
  if (!sb) throw new Error("Cloud saving isn't configured.");
  const { data, error } = await sb.rpc("vault_get", { p_code: code });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const chars: Character[] = [];
  const tombs: Record<string, number> = {};
  for (const item of data as Payload) {
    if ("deleted" in item) tombs[item.id] = item.at;
    else chars.push(item);
  }
  return { chars, tombs };
}

async function pushVault(code: string) {
  const sb = supabase();
  if (!sb) return;
  const payload: Payload = [...loadCharacters(), ...Object.entries(loadTombstones()).map(([id, at]) => ({ id, deleted: true as const, at }))];
  const { error } = await sb.rpc("vault_put", { p_code: code, p_characters: payload });
  if (error) throw new Error(error.message);
}

/** Create a new hero code and upload this device's characters to it. */
export async function createVault() {
  const code = makeHeroCode();
  await pushVault(code);
  setCode(code);
  return code;
}

/** Use an existing hero code on this device: pull, merge, push back. */
export async function connectVault(raw: string) {
  const code = normalizeCode(raw);
  const remote = await fetchVault(code);
  if (!remote) throw new Error("No characters found for that hero code. Check the spelling.");
  mergeCharacters(remote.chars, remote.tombs);
  setCode(code);
  await pushVault(code);
  window.dispatchEvent(new Event(CHARACTERS_CHANGED));
}

export function forgetVault() {
  setCode(null);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/**
 * Keeps this device's characters synced with the hero code: pulls once on load,
 * then pushes a moment after every local change. Returns a status label.
 */
export function useCloudSync() {
  const code = useHeroCode();
  const [status, setStatus] = useState<"off" | "syncing" | "saved" | "error">(supabaseEnabled && code ? "syncing" : "off");

  useEffect(() => {
    if (!code || !supabaseEnabled) return;
    let alive = true;
    const run = async (pull: boolean) => {
      setStatus("syncing");
      try {
        if (pull) {
          const remote = await fetchVault(code);
          if (remote) {
            mergeCharacters(remote.chars, remote.tombs);
            window.dispatchEvent(new Event(CHARACTERS_CHANGED));
          }
        }
        await pushVault(code);
        if (alive) setStatus("saved");
      } catch {
        if (alive) setStatus("error");
      }
    };
    if (!started) {
      started = true;
      run(true);
    } else {
      queueMicrotask(() => alive && setStatus("saved"));
    }
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => run(false), 800);
    };
    window.addEventListener(CHARACTERS_CHANGED, onChange);
    return () => {
      alive = false;
      window.removeEventListener(CHARACTERS_CHANGED, onChange);
    };
  }, [code]);

  return { code, status: code && supabaseEnabled ? status : "off", enabled: supabaseEnabled };
}

/** Re-render when characters change (from this tab, a sync, or another tab). */
export function useCharacters(enabled: boolean) {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener(CHARACTERS_CHANGED, l);
      const onStorage = (e: StorageEvent) => e.key?.startsWith("tavernlight.characters") && l();
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(CHARACTERS_CHANGED, l);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => (enabled ? localStorage.getItem("tavernlight.characters.v1") ?? "[]" : "[]"),
    () => "[]",
  );
}
