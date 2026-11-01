// Spells, class resources, weapons, conditions and dice skins.
// Mechanics summarized from the SRD 5.2 (CC-BY-4.0); descriptions written for this app.

import type { Ability } from "./srd";

// ---------------------------------------------------------------- spells
export type SpellKind = "attack" | "save" | "heal" | "damage" | "utility";

export interface Spell {
  id: string;
  name: string;
  level: number; // 0 = cantrip
  classes: string[];
  kind: SpellKind;
  dice?: string; // base effect at its own level, e.g. "8d6"
  upcast?: string; // added per slot level above the spell's level
  addMod?: boolean; // add spellcasting modifier to the roll
  save?: Ability;
  rays?: number; // separate attack rolls (e.g. Scorching Ray)
  desc: string;
}

const S = (s: Spell) => s;
export const SPELLS: Spell[] = [
  // cantrips
  S({ id: "fire-bolt", name: "Fire Bolt", level: 0, classes: ["sorcerer", "wizard"], kind: "attack", dice: "1d10", desc: "Hurl a mote of fire at a creature or object within 120 ft." }),
  S({ id: "ray-of-frost", name: "Ray of Frost", level: 0, classes: ["sorcerer", "wizard"], kind: "attack", dice: "1d8", desc: "A frigid beam; the target's speed drops by 10 ft." }),
  S({ id: "shocking-grasp", name: "Shocking Grasp", level: 0, classes: ["sorcerer", "wizard"], kind: "attack", dice: "1d8", desc: "Lightning touch; the target can't take opportunity attacks." }),
  S({ id: "chill-touch", name: "Chill Touch", level: 0, classes: ["sorcerer", "warlock", "wizard"], kind: "attack", dice: "1d10", desc: "A ghostly hand of necrotic cold; the target can't regain HP." }),
  S({ id: "eldritch-blast", name: "Eldritch Blast", level: 0, classes: ["warlock"], kind: "attack", dice: "1d10", desc: "A crackling beam of force within 120 ft." }),
  S({ id: "poison-spray", name: "Poison Spray", level: 0, classes: ["druid", "sorcerer", "warlock", "wizard"], kind: "attack", dice: "1d12", desc: "Project a puff of toxic spray." }),
  S({ id: "produce-flame", name: "Produce Flame", level: 0, classes: ["druid"], kind: "attack", dice: "1d8", desc: "A flame in your hand that lights the way or can be hurled." }),
  S({ id: "thorn-whip", name: "Thorn Whip", level: 0, classes: ["druid"], kind: "attack", dice: "1d6", desc: "A vine whip that pulls the target 10 ft closer." }),
  S({ id: "sacred-flame", name: "Sacred Flame", level: 0, classes: ["cleric"], kind: "save", save: "DEX", dice: "1d8", desc: "Radiant flame descends on a creature you can see." }),
  S({ id: "acid-splash", name: "Acid Splash", level: 0, classes: ["sorcerer", "wizard"], kind: "save", save: "DEX", dice: "1d6", desc: "A bubble of acid bursts in a 5-ft radius." }),
  S({ id: "vicious-mockery", name: "Vicious Mockery", level: 0, classes: ["bard"], kind: "save", save: "WIS", dice: "1d6", desc: "Insults laced with magic; the target has disadvantage on its next attack." }),
  S({ id: "guidance", name: "Guidance", level: 0, classes: ["cleric", "druid"], kind: "utility", dice: "1d4", desc: "An ally adds 1d4 to one ability check." }),
  S({ id: "light", name: "Light", level: 0, classes: ["bard", "cleric", "sorcerer", "wizard"], kind: "utility", desc: "An object sheds bright light in a 20-ft radius." }),
  S({ id: "mage-hand", name: "Mage Hand", level: 0, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "A spectral hand manipulates objects up to 30 ft away." }),
  S({ id: "prestidigitation", name: "Prestidigitation", level: 0, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "Minor magical tricks: clean, light, chill, flavor, mark." }),
  S({ id: "minor-illusion", name: "Minor Illusion", level: 0, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "Create a sound or an image of an object." }),
  S({ id: "thaumaturgy", name: "Thaumaturgy", level: 0, classes: ["cleric"], kind: "utility", desc: "Booming voice, flickering flames, tremors — divine theatrics." }),
  S({ id: "druidcraft", name: "Druidcraft", level: 0, classes: ["druid"], kind: "utility", desc: "Small nature effects: predict weather, bloom a flower." }),
  S({ id: "spare-the-dying", name: "Spare the Dying", level: 0, classes: ["cleric", "druid"], kind: "utility", desc: "Stabilize a creature at 0 HP." }),
  // 1st
  S({ id: "magic-missile", name: "Magic Missile", level: 1, classes: ["sorcerer", "wizard"], kind: "damage", dice: "3d4+3", upcast: "1d4+1", desc: "Three darts of force that never miss." }),
  S({ id: "burning-hands", name: "Burning Hands", level: 1, classes: ["sorcerer", "wizard"], kind: "save", save: "DEX", dice: "3d6", upcast: "1d6", desc: "A 15-ft cone of flame." }),
  S({ id: "chromatic-orb", name: "Chromatic Orb", level: 1, classes: ["sorcerer", "wizard"], kind: "attack", dice: "3d8", upcast: "1d8", desc: "An orb of acid, cold, fire, lightning, poison or thunder." }),
  S({ id: "thunderwave", name: "Thunderwave", level: 1, classes: ["bard", "druid", "sorcerer", "wizard"], kind: "save", save: "CON", dice: "2d8", upcast: "1d8", desc: "A wave of thunder pushes creatures 10 ft away." }),
  S({ id: "hellish-rebuke", name: "Hellish Rebuke", level: 1, classes: ["warlock"], kind: "save", save: "DEX", dice: "2d10", upcast: "1d10", desc: "Flames engulf a creature that damaged you." }),
  S({ id: "guiding-bolt", name: "Guiding Bolt", level: 1, classes: ["cleric"], kind: "attack", dice: "4d6", upcast: "1d6", desc: "A flash of light; the next attack on the target has advantage." }),
  S({ id: "inflict-wounds", name: "Inflict Wounds", level: 1, classes: ["cleric"], kind: "save", save: "CON", dice: "2d10", upcast: "1d10", desc: "Necrotic energy floods a creature you touch." }),
  S({ id: "cure-wounds", name: "Cure Wounds", level: 1, classes: ["bard", "cleric", "druid", "paladin", "ranger"], kind: "heal", dice: "2d8", upcast: "2d8", addMod: true, desc: "A touch that restores hit points." }),
  S({ id: "healing-word", name: "Healing Word", level: 1, classes: ["bard", "cleric", "druid"], kind: "heal", dice: "2d4", upcast: "2d4", addMod: true, desc: "A word of power heals a creature within 60 ft (bonus action)." }),
  S({ id: "divine-smite", name: "Divine Smite", level: 1, classes: ["paladin"], kind: "damage", dice: "2d8", upcast: "1d8", desc: "On a hit, your weapon blazes with radiant damage." }),
  S({ id: "searing-smite", name: "Searing Smite", level: 1, classes: ["paladin"], kind: "damage", dice: "1d6", upcast: "1d6", desc: "On a hit, the target bursts into flames." }),
  S({ id: "hunters-mark", name: "Hunter's Mark", level: 1, classes: ["ranger"], kind: "damage", dice: "1d6", desc: "Mark a quarry; your hits deal an extra 1d6." }),
  S({ id: "bless", name: "Bless", level: 1, classes: ["cleric", "paladin"], kind: "utility", dice: "1d4", desc: "Up to three allies add 1d4 to attacks and saves." }),
  S({ id: "shield-of-faith", name: "Shield of Faith", level: 1, classes: ["cleric", "paladin"], kind: "utility", desc: "+2 AC to a creature for up to 10 minutes." }),
  S({ id: "shield", name: "Shield", level: 1, classes: ["sorcerer", "wizard"], kind: "utility", desc: "Reaction: +5 AC until your next turn." }),
  S({ id: "mage-armor", name: "Mage Armor", level: 1, classes: ["sorcerer", "wizard"], kind: "utility", desc: "Unarmored AC becomes 13 + DEX for 8 hours." }),
  S({ id: "sleep", name: "Sleep", level: 1, classes: ["bard", "sorcerer", "wizard"], kind: "utility", desc: "Creatures in a 5-ft sphere may fall unconscious." }),
  S({ id: "charm-person", name: "Charm Person", level: 1, classes: ["bard", "druid", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "A humanoid regards you as a friend." }),
  S({ id: "detect-magic", name: "Detect Magic", level: 1, classes: ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "wizard"], kind: "utility", desc: "Sense magic within 30 ft." }),
  S({ id: "faerie-fire", name: "Faerie Fire", level: 1, classes: ["bard", "druid"], kind: "utility", desc: "Outline creatures in light; attacks against them have advantage." }),
  S({ id: "entangle", name: "Entangle", level: 1, classes: ["druid", "ranger"], kind: "utility", desc: "Grasping plants restrain creatures in a 20-ft square." }),
  // 2nd
  S({ id: "scorching-ray", name: "Scorching Ray", level: 2, classes: ["sorcerer", "wizard"], kind: "attack", dice: "2d6", rays: 3, desc: "Three rays of fire; roll an attack for each (one more ray per slot above 2nd)." }),
  S({ id: "shatter", name: "Shatter", level: 2, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "save", save: "CON", dice: "3d8", upcast: "1d8", desc: "A painful ringing noise in a 10-ft sphere." }),
  S({ id: "spiritual-weapon", name: "Spiritual Weapon", level: 2, classes: ["cleric"], kind: "attack", dice: "1d8", upcast: "1d8", addMod: true, desc: "A floating spectral weapon strikes as a bonus action." }),
  S({ id: "moonbeam", name: "Moonbeam", level: 2, classes: ["druid"], kind: "save", save: "CON", dice: "2d10", upcast: "1d10", desc: "A cylinder of pale radiant light." }),
  S({ id: "spike-growth", name: "Spike Growth", level: 2, classes: ["druid", "ranger"], kind: "damage", dice: "2d4", desc: "Ground sprouts spikes; 2d4 per 5 ft moved." }),
  S({ id: "prayer-of-healing", name: "Prayer of Healing", level: 2, classes: ["cleric"], kind: "heal", dice: "2d8", upcast: "1d8", addMod: true, desc: "Up to five creatures regain HP over a short rest." }),
  S({ id: "misty-step", name: "Misty Step", level: 2, classes: ["sorcerer", "warlock", "wizard"], kind: "utility", desc: "Teleport up to 30 ft (bonus action)." }),
  S({ id: "hold-person", name: "Hold Person", level: 2, classes: ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "A humanoid is paralyzed (WIS save each turn)." }),
  S({ id: "lesser-restoration", name: "Lesser Restoration", level: 2, classes: ["bard", "cleric", "druid", "paladin", "ranger"], kind: "utility", desc: "End one condition: blinded, deafened, paralyzed or poisoned." }),
  // 3rd
  S({ id: "fireball", name: "Fireball", level: 3, classes: ["sorcerer", "wizard"], kind: "save", save: "DEX", dice: "8d6", upcast: "1d6", desc: "A bead of fire explodes in a 20-ft sphere." }),
  S({ id: "lightning-bolt", name: "Lightning Bolt", level: 3, classes: ["sorcerer", "wizard"], kind: "save", save: "DEX", dice: "8d6", upcast: "1d6", desc: "A 100-ft line of lightning." }),
  S({ id: "spirit-guardians", name: "Spirit Guardians", level: 3, classes: ["cleric"], kind: "save", save: "WIS", dice: "3d8", upcast: "1d8", desc: "Protective spirits swirl around you in a 15-ft emanation." }),
  S({ id: "call-lightning", name: "Call Lightning", level: 3, classes: ["druid"], kind: "save", save: "DEX", dice: "3d10", upcast: "1d10", desc: "Call down a bolt from a storm cloud each turn." }),
  S({ id: "counterspell", name: "Counterspell", level: 3, classes: ["sorcerer", "warlock", "wizard"], kind: "utility", desc: "Reaction: interrupt a creature casting a spell." }),
  S({ id: "revivify", name: "Revivify", level: 3, classes: ["cleric", "druid", "paladin", "ranger"], kind: "utility", desc: "Return a creature that died within the last minute to life." }),
  S({ id: "hypnotic-pattern", name: "Hypnotic Pattern", level: 3, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "Creatures in a 30-ft cube may be charmed and incapacitated." }),
  S({ id: "haste", name: "Haste", level: 3, classes: ["sorcerer", "wizard"], kind: "utility", desc: "Double speed, +2 AC and an extra action." }),
  // 4th
  S({ id: "blight", name: "Blight", level: 4, classes: ["druid", "sorcerer", "warlock", "wizard"], kind: "save", save: "CON", dice: "8d8", upcast: "1d8", desc: "Necrotic energy drains a creature." }),
  S({ id: "ice-storm", name: "Ice Storm", level: 4, classes: ["druid", "sorcerer", "wizard"], kind: "save", save: "DEX", dice: "2d10+4d6", upcast: "1d10", desc: "Hail pounds a 20-ft-radius cylinder." }),
  S({ id: "polymorph", name: "Polymorph", level: 4, classes: ["bard", "druid", "sorcerer", "wizard"], kind: "utility", desc: "Transform a creature into a beast." }),
  S({ id: "dimension-door", name: "Dimension Door", level: 4, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "Teleport up to 500 ft, bringing one willing creature." }),
  // 5th
  S({ id: "cone-of-cold", name: "Cone of Cold", level: 5, classes: ["sorcerer", "wizard"], kind: "save", save: "CON", dice: "8d8", upcast: "1d8", desc: "A 60-ft cone of freezing air." }),
  S({ id: "flame-strike", name: "Flame Strike", level: 5, classes: ["cleric"], kind: "save", save: "DEX", dice: "10d6", upcast: "2d6", desc: "A column of divine fire and radiance." }),
  S({ id: "mass-cure-wounds", name: "Mass Cure Wounds", level: 5, classes: ["bard", "cleric", "druid"], kind: "heal", dice: "5d8", upcast: "1d8", addMod: true, desc: "Up to six creatures regain HP." }),
  S({ id: "hold-monster", name: "Hold Monster", level: 5, classes: ["bard", "sorcerer", "warlock", "wizard"], kind: "utility", desc: "Any creature is paralyzed (WIS save each turn)." }),
];

export const SPELL_LEVEL_NAME = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

export const CAST_ABILITY: Record<string, Ability | undefined> = {
  bard: "CHA", cleric: "WIS", druid: "WIS", paladin: "CHA", ranger: "WIS", sorcerer: "CHA", warlock: "CHA", wizard: "INT",
};

const FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const HALF: number[][] = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

/** Spell slots by spell level (index 0 = 1st-level slots). Warlocks get Pact Magic slots of one level. */
export function spellSlots(classId: string, level: number): number[] {
  const L = Math.max(1, Math.min(20, level));
  if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(classId)) return FULL[L - 1];
  if (["paladin", "ranger"].includes(classId)) return HALF[L - 1];
  if (classId === "warlock") {
    const count = L === 1 ? 1 : L <= 10 ? 2 : L <= 16 ? 3 : 4;
    const slotLevel = Math.min(5, Math.ceil(L / 2));
    const out = Array(slotLevel).fill(0);
    out[slotLevel - 1] = count;
    return out;
  }
  return [];
}

export const cantripDiceMult = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);

/** Dice expression for a spell cast at a given slot level by a character of a given level. */
export function spellDice(sp: Spell, slot: number, charLevel: number, mod: number): string | null {
  if (!sp.dice) return null;
  let expr = sp.dice;
  if (sp.level === 0 && sp.kind !== "utility") {
    const m = cantripDiceMult(charLevel);
    expr = expr.replace(/^(\d+)d(\d+)/, (_, n, d) => `${Number(n) * m}d${d}`);
  }
  const extra = Math.max(0, slot - sp.level);
  if (sp.upcast && extra > 0) for (let i = 0; i < extra; i++) expr += `+${sp.upcast}`;
  if (sp.addMod && mod) expr += mod > 0 ? `+${mod}` : `${mod}`;
  return expr;
}

// ---------------------------------------------------------------- class resources
export interface Feature {
  id: string;
  name: string;
  max: number; // uses (or pool size)
  recharge: "short" | "long";
  pool?: boolean; // spend any amount (Lay on Hands, Focus, Sorcery Points)
  dice?: string; // what it rolls when used
  desc: string;
}

export function classFeatures(classId: string, level: number, mods: Record<Ability, number>): Feature[] {
  const L = level;
  const f: Feature[] = [];
  switch (classId) {
    case "barbarian":
      f.push({ id: "rage", name: "Rage", max: L >= 17 ? 6 : L >= 12 ? 5 : L >= 6 ? 4 : L >= 3 ? 3 : 2, recharge: "long", desc: `Bonus damage +${L >= 16 ? 4 : L >= 9 ? 3 : 2}, resistance to bludgeoning, piercing and slashing.` });
      break;
    case "bard": {
      const die = L >= 15 ? 12 : L >= 10 ? 10 : L >= 5 ? 8 : 6;
      f.push({ id: "inspiration", name: "Bardic Inspiration", max: Math.max(1, mods.CHA), recharge: L >= 5 ? "short" : "long", dice: `1d${die}`, desc: `Give an ally a d${die} to add to a roll.` });
      break;
    }
    case "cleric":
      if (L >= 2) f.push({ id: "channel", name: "Channel Divinity", max: L >= 18 ? 4 : L >= 6 ? 3 : 2, recharge: "short", desc: "Divine Spark or Turn Undead." });
      break;
    case "druid":
      if (L >= 2) f.push({ id: "wildshape", name: "Wild Shape", max: L >= 17 ? 4 : L >= 6 ? 3 : 2, recharge: "short", desc: "Transform into a beast." });
      break;
    case "fighter":
      f.push({ id: "secondwind", name: "Second Wind", max: L >= 10 ? 4 : L >= 4 ? 3 : 2, recharge: "short", dice: `1d10+${L}`, desc: "Bonus action: regain hit points." });
      if (L >= 2) f.push({ id: "surge", name: "Action Surge", max: L >= 17 ? 2 : 1, recharge: "short", desc: "Take one additional action." });
      break;
    case "monk":
      if (L >= 2) f.push({ id: "focus", name: "Focus Points", max: L, recharge: "short", pool: true, desc: "Flurry of Blows, Patient Defense, Step of the Wind." });
      break;
    case "paladin":
      f.push({ id: "layonhands", name: "Lay On Hands", max: 5 * L, recharge: "long", pool: true, desc: "Touch to restore HP from a pool." });
      if (L >= 3) f.push({ id: "channel", name: "Channel Divinity", max: L >= 11 ? 3 : 2, recharge: "short", desc: "Divine Sense and your oath's power." });
      break;
    case "sorcerer":
      if (L >= 2) f.push({ id: "sorcery", name: "Sorcery Points", max: L, recharge: "long", pool: true, desc: "Fuel Metamagic or create spell slots." });
      break;
    case "wizard":
      f.push({ id: "arcanerecovery", name: "Arcane Recovery", max: 1, recharge: "long", desc: `Short rest: recover spell slots totaling up to ${Math.ceil(L / 2)} levels.` });
      break;
  }
  return f;
}

// ---------------------------------------------------------------- weapons
export interface Weapon {
  name: string;
  dice: string;
  ability: Ability | "FINESSE";
  note?: string;
}

export function classWeapons(classId: string, level: number): Weapon[] {
  const martial = level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6;
  switch (classId) {
    case "barbarian": return [{ name: "Greataxe", dice: "1d12", ability: "STR" }, { name: "Handaxe (thrown)", dice: "1d6", ability: "STR" }];
    case "bard": return [{ name: "Rapier", dice: "1d8", ability: "FINESSE" }, { name: "Dagger", dice: "1d4", ability: "FINESSE" }];
    case "cleric": return [{ name: "Mace", dice: "1d6", ability: "STR" }];
    case "druid": return [{ name: "Quarterstaff", dice: "1d6", ability: "STR" }, { name: "Sickle", dice: "1d4", ability: "STR" }];
    case "fighter": return [{ name: "Longsword", dice: "1d8", ability: "STR" }, { name: "Longbow", dice: "1d8", ability: "DEX" }];
    case "monk": return [{ name: "Unarmed Strike", dice: `1d${martial}`, ability: "FINESSE" }, { name: "Spear", dice: "1d6", ability: "FINESSE" }];
    case "paladin": return [{ name: "Longsword", dice: "1d8", ability: "STR" }, { name: "Javelin", dice: "1d6", ability: "STR" }];
    case "ranger": return [{ name: "Longbow", dice: "1d8", ability: "DEX" }, { name: "Shortsword", dice: "1d6", ability: "FINESSE" }];
    case "rogue": return [{ name: "Rapier", dice: "1d8", ability: "FINESSE", note: "Sneak Attack" }, { name: "Shortbow", dice: "1d6", ability: "DEX", note: "Sneak Attack" }];
    default: return [{ name: "Dagger", dice: "1d4", ability: "FINESSE" }, { name: "Quarterstaff", dice: "1d6", ability: "STR" }];
  }
}

export const attacksPerTurn = (classId: string, level: number) =>
  classId === "fighter" ? (level >= 20 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1) : ["barbarian", "monk", "paladin", "ranger"].includes(classId) && level >= 5 ? 2 : 1;

export const sneakAttackDice = (level: number) => `${Math.ceil(level / 2)}d6`;

// ---------------------------------------------------------------- conditions
export interface ConditionDef {
  name: string;
  attack?: "adv" | "dis";
  checks?: "dis";
  dexSave?: "dis" | "fail";
  strSave?: "fail";
  note: string;
}

export const CONDITIONS: ConditionDef[] = [
  { name: "Blinded", attack: "dis", note: "Can't see. Attacks against you have advantage." },
  { name: "Charmed", note: "Can't attack the charmer." },
  { name: "Frightened", attack: "dis", checks: "dis", note: "Can't move closer to the source of fear." },
  { name: "Grappled", note: "Speed 0." },
  { name: "Incapacitated", note: "No actions, bonus actions or reactions." },
  { name: "Invisible", attack: "adv", note: "Attacks against you have disadvantage." },
  { name: "Paralyzed", strSave: "fail", dexSave: "fail", note: "Incapacitated; hits within 5 ft are critical." },
  { name: "Poisoned", attack: "dis", checks: "dis", note: "Disadvantage on attacks and ability checks." },
  { name: "Prone", attack: "dis", note: "Crawl or stand up; melee attacks against you have advantage." },
  { name: "Restrained", attack: "dis", dexSave: "dis", note: "Speed 0; attacks against you have advantage." },
  { name: "Stunned", strSave: "fail", dexSave: "fail", note: "Incapacitated; attacks against you have advantage." },
  { name: "Unconscious", strSave: "fail", dexSave: "fail", note: "Prone and incapacitated; hits within 5 ft are critical." },
];

export type RollMode = "normal" | "adv" | "dis";

/** Works out advantage/disadvantage for a roll from the character's conditions. */
export function modeFromConditions(conditions: string[], kind: "attack" | "check" | "save", ability?: Ability): { mode: RollMode; reason: string; autoFail?: boolean } {
  let adv: string[] = [];
  let dis: string[] = [];
  let fail: string | null = null;
  for (const name of conditions) {
    const c = CONDITIONS.find((x) => x.name === name);
    if (!c) continue;
    if (kind === "attack" && c.attack === "adv") adv.push(c.name);
    if (kind === "attack" && c.attack === "dis") dis.push(c.name);
    if (kind === "check" && c.checks === "dis") dis.push(c.name);
    if (kind === "save" && ability === "DEX" && c.dexSave === "dis") dis.push(c.name);
    if (kind === "save" && ((ability === "DEX" && c.dexSave === "fail") || (ability === "STR" && c.strSave === "fail"))) fail = c.name;
  }
  if (adv.length && dis.length) {
    adv = [];
    dis = [];
  }
  if (fail) return { mode: "normal", reason: `${fail}: automatically fails`, autoFail: true };
  if (adv.length) return { mode: "adv", reason: `Advantage (${adv.join(", ")})` };
  if (dis.length) return { mode: "dis", reason: `Disadvantage (${dis.join(", ")})` };
  return { mode: "normal", reason: "" };
}

// ---------------------------------------------------------------- dice skins
export interface DiceSkin {
  id: string;
  name: string;
  unlock: number; // character level
  body: string;
  edge: string;
  text: string;
  metal: number;
}

export const DICE_SKINS: DiceSkin[] = [
  { id: "gilded", name: "Gilded", unlock: 1, body: "#2A2112", edge: "#E8B84A", text: "#F7E2A8", metal: 0.6 },
  { id: "bone", name: "Bone", unlock: 1, body: "#E9E1CF", edge: "#9C8F73", text: "#2B2418", metal: 0.05 },
  { id: "obsidian", name: "Obsidian", unlock: 3, body: "#121218", edge: "#7A7F94", text: "#E8ECF5", metal: 0.3 },
  { id: "arcane", name: "Arcane", unlock: 5, body: "#16244A", edge: "#6FA8FF", text: "#CFE1FF", metal: 0.4 },
  { id: "ember", name: "Ember", unlock: 7, body: "#3A140A", edge: "#FF7A3D", text: "#FFD2B0", metal: 0.35 },
  { id: "frost", name: "Frost", unlock: 9, body: "#CFE8F5", edge: "#5FA9D6", text: "#0E3550", metal: 0.15 },
  { id: "verdant", name: "Verdant", unlock: 11, body: "#123321", edge: "#6EE7A0", text: "#D8FBE6", metal: 0.3 },
  { id: "bloodmoon", name: "Blood Moon", unlock: 13, body: "#3A0A12", edge: "#F06A5A", text: "#FFD9D3", metal: 0.45 },
  { id: "starlight", name: "Starlight", unlock: 15, body: "#1A1033", edge: "#C8B6FF", text: "#FFFFFF", metal: 0.55 },
  { id: "void", name: "Void", unlock: 17, body: "#050507", edge: "#B79BFF", text: "#B79BFF", metal: 0.8 },
  { id: "dragonbone", name: "Dragonbone", unlock: 20, body: "#F3E7C9", edge: "#C9302C", text: "#7A0F0B", metal: 0.25 },
];

export const skinById = (id?: string) => DICE_SKINS.find((s) => s.id === id) ?? DICE_SKINS[0];

// ---------------------------------------------------------------- items
export interface Item {
  id: string;
  name: string;
  qty: number;
  note?: string;
}

/** Items with a built-in use. */
export const ITEM_EFFECTS: { match: RegExp; dice: string; label: string }[] = [
  { match: /^potion of supreme healing/i, dice: "10d4+20", label: "heals" },
  { match: /^potion of superior healing/i, dice: "8d4+8", label: "heals" },
  { match: /^potion of greater healing/i, dice: "4d4+4", label: "heals" },
  { match: /^potion of healing/i, dice: "2d4+2", label: "heals" },
];

export const ASI_LEVELS = [4, 8, 12, 16, 19];
