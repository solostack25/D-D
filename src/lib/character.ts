import { CAST_ABILITY, classFeatures, classWeapons, spellSlots, type Item } from "./rules";
import { ABILITIES, BACKGROUNDS, CLASSES, SKILLS, SPECIES, type Ability, type Skill } from "./srd";

export type Scores = Record<Ability, number>;

export interface Character {
  id: string;
  name: string;
  speciesId: string;
  classId: string;
  backgroundId: string;
  level: number;
  base: Scores; // before background bonuses
  bonus: Partial<Record<Ability, number>>; // background +2/+1 or +1/+1/+1
  classSkills: Skill[];
  color: string;
  sigil: string;
  hp: number; // current HP
  notes: string;
  createdAt: number;
  updatedAt?: number;
  // added with the sheet upgrade — older characters get defaults from normalize()
  asi?: Partial<Record<Ability, number>>; // ability score improvements from leveling
  hpRolls?: number[]; // HP gained at each level after 1st (rolled or average)
  spells?: string[]; // prepared spell ids
  slotsUsed?: number[]; // index 0 = 1st-level slots used
  featureUsed?: Record<string, number>;
  inventory?: Item[];
  gold?: number;
  conditions?: string[];
  diceSkin?: string;
  lootSeen?: string[]; // AI loot tags already applied
}

export function normalize(c: Character): Required<Pick<Character, "asi" | "hpRolls" | "spells" | "slotsUsed" | "featureUsed" | "inventory" | "gold" | "conditions" | "diceSkin" | "lootSeen">> & Character {
  return {
    ...c,
    asi: c.asi ?? {},
    hpRolls: c.hpRolls ?? [],
    spells: c.spells ?? [],
    slotsUsed: c.slotsUsed ?? [],
    featureUsed: c.featureUsed ?? {},
    inventory: c.inventory ?? [],
    gold: c.gold ?? 0,
    conditions: c.conditions ?? [],
    diceSkin: c.diceSkin ?? "gilded",
    lootSeen: c.lootSeen ?? [],
  };
}

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level: number) => 2 + Math.floor((level - 1) / 4);

export function finalScores(c: Pick<Character, "base" | "bonus" | "asi">): Scores {
  const out = { ...c.base };
  for (const a of ABILITIES) out[a] = Math.min(20, out[a] + (c.bonus[a] ?? 0) + (c.asi?.[a] ?? 0));
  return out;
}

export function derive(c: Character) {
  const cls = CLASSES.find((x) => x.id === c.classId) ?? CLASSES[0];
  const species = SPECIES.find((x) => x.id === c.speciesId) ?? SPECIES[0];
  const bg = BACKGROUNDS.find((x) => x.id === c.backgroundId) ?? BACKGROUNDS[0];
  const s = finalScores(c);
  const m = (a: Ability) => mod(s[a]);
  const prof = profBonus(c.level);
  const avg = cls.hitDie / 2 + 1;
  let maxHp = cls.hitDie + m("CON");
  for (let lv = 2; lv <= c.level; lv++) maxHp += (c.hpRolls?.[lv - 2] ?? avg) + m("CON");
  if (species.id === "dwarf") maxHp += c.level; // Dwarven Toughness
  maxHp = Math.max(1, maxHp);
  const dex = cls.ac.dexCap === null ? m("DEX") : Math.min(m("DEX"), cls.ac.dexCap);
  const ac = cls.ac.base + dex + (cls.ac.plus ? m(cls.ac.plus) : 0) + (cls.ac.shield ? 2 : 0);
  const skills = new Set<Skill>([...bg.skills, ...c.classSkills]);
  const skillMod = (sk: Skill) => m(SKILLS[sk]) + (skills.has(sk) ? prof : 0);
  const saveMod = (a: Ability) => m(a) + (cls.saves.includes(a) ? prof : 0);
  const attackMod = m(cls.attack) + prof;
  const castAbility = CAST_ABILITY[cls.id];
  const castMod = castAbility ? m(castAbility) : 0;
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, m(a)])) as Record<Ability, number>;
  return {
    cls, species, bg, scores: s, m, prof, maxHp, ac, initiative: m("DEX"), skills, skillMod, saveMod, attackMod, speed: species.speed,
    castAbility, castMod, spellAttack: castMod + prof, spellDC: 8 + prof + castMod,
    slots: spellSlots(cls.id, c.level), features: classFeatures(cls.id, c.level, mods), weapons: classWeapons(cls.id, c.level),
  };
}

/** Modifier for a named check: an ability, a skill, "<ability> save", "Attack", "Initiative". */
export function checkMod(c: Character, check: string): number {
  const d = derive(c);
  const t = check.trim().toLowerCase();
  if (t.startsWith("attack") || t.includes("spell attack")) return d.attackMod;
  if (t.startsWith("init")) return d.initiative;
  for (const sk of Object.keys(SKILLS) as Skill[]) if (t.startsWith(sk.toLowerCase())) return d.skillMod(sk);
  for (const a of ABILITIES) {
    const full = { STR: "strength", DEX: "dexterity", CON: "constitution", INT: "intelligence", WIS: "wisdom", CHA: "charisma" }[a];
    if (t.startsWith(a.toLowerCase()) || t.startsWith(full)) return t.includes("save") ? d.saveMod(a) : d.m(a);
  }
  return 0;
}

const KEY = "tavernlight.characters.v1";
const TOMBSTONES = "tavernlight.deleted.v1";
export const CHARACTERS_CHANGED = "tavernlight:characters";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(all: Character[], tombs: Record<string, number>, notify = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    localStorage.setItem(TOMBSTONES, JSON.stringify(tombs));
  } catch {}
  if (notify && typeof window !== "undefined") window.dispatchEvent(new Event(CHARACTERS_CHANGED));
}

export function loadCharacters(): Character[] {
  return readJSON<Character[]>(KEY, []);
}

export function loadTombstones(): Record<string, number> {
  return readJSON<Record<string, number>>(TOMBSTONES, {});
}

export function saveCharacter(c: Character) {
  const all = loadCharacters().filter((x) => x.id !== c.id);
  all.unshift({ ...c, updatedAt: Date.now() });
  write(all, loadTombstones());
}

export function deleteCharacter(id: string) {
  write(loadCharacters().filter((x) => x.id !== id), { ...loadTombstones(), [id]: Date.now() });
}

/** Merge characters from the cloud into this device. Newest edit wins; deletions stick. */
export function mergeCharacters(remote: Character[], remoteTombs: Record<string, number>) {
  const tombs = { ...remoteTombs };
  for (const [id, t] of Object.entries(loadTombstones())) tombs[id] = Math.max(t, tombs[id] ?? 0);
  const byId = new Map<string, Character>();
  for (const c of [...loadCharacters(), ...remote]) {
    const cur = byId.get(c.id);
    if (!cur || (c.updatedAt ?? c.createdAt) > (cur.updatedAt ?? cur.createdAt)) byId.set(c.id, c);
  }
  const all = [...byId.values()]
    .filter((c) => !tombs[c.id] || (c.updatedAt ?? c.createdAt) > tombs[c.id])
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  write(all, tombs, false);
  return all;
}

export function getCharacter(id: string) {
  return loadCharacters().find((c) => c.id === id) ?? null;
}

export const now = () => Date.now();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Compact summary shared with the rest of the table. */
export interface PublicCharacter {
  id: string;
  name: string;
  color: string;
  sigil: string;
  summary: string;
  ac: number;
  hp: number;
  maxHp: number;
  initMod: number;
  scores: Scores;
  level: number;
  conditions: string[];
  diceSkin: string;
}

export function toPublic(c: Character): PublicCharacter {
  const d = derive(c);
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    sigil: c.sigil,
    summary: `${d.species.name} ${d.cls.name} · Lv ${c.level}`,
    ac: d.ac,
    hp: Math.min(c.hp, d.maxHp),
    maxHp: d.maxHp,
    initMod: d.initiative,
    scores: d.scores,
    level: c.level,
    conditions: c.conditions ?? [],
    diceSkin: c.diceSkin ?? "gilded",
  };
}
