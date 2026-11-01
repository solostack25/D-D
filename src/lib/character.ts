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
}

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level: number) => 2 + Math.floor((level - 1) / 4);

export function finalScores(c: Pick<Character, "base" | "bonus">): Scores {
  const out = { ...c.base };
  for (const a of ABILITIES) out[a] = Math.min(20, out[a] + (c.bonus[a] ?? 0));
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
  let maxHp = cls.hitDie + m("CON") + (c.level - 1) * (avg + m("CON"));
  if (species.id === "dwarf") maxHp += c.level; // Dwarven Toughness
  maxHp = Math.max(1, maxHp);
  const dex = cls.ac.dexCap === null ? m("DEX") : Math.min(m("DEX"), cls.ac.dexCap);
  const ac = cls.ac.base + dex + (cls.ac.plus ? m(cls.ac.plus) : 0) + (cls.ac.shield ? 2 : 0);
  const skills = new Set<Skill>([...bg.skills, ...c.classSkills]);
  const skillMod = (sk: Skill) => m(SKILLS[sk]) + (skills.has(sk) ? prof : 0);
  const saveMod = (a: Ability) => m(a) + (cls.saves.includes(a) ? prof : 0);
  const attackMod = m(cls.attack) + prof;
  return { cls, species, bg, scores: s, m, prof, maxHp, ac, initiative: m("DEX"), skills, skillMod, saveMod, attackMod, speed: species.speed };
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

export function loadCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Character[];
  } catch {
    return [];
  }
}

export function saveCharacter(c: Character) {
  const all = loadCharacters().filter((x) => x.id !== c.id);
  all.unshift(c);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function deleteCharacter(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadCharacters().filter((x) => x.id !== id)));
  } catch {}
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
  };
}
