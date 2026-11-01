// Game data based on the System Reference Document 5.2 (CC-BY-4.0).
// Descriptions are written fresh for this app; mechanics follow the SRD.

export type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export const ABILITIES: Ability[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
export const ABILITY_NAMES: Record<Ability, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

export type Skill =
  | "Acrobatics" | "Animal Handling" | "Arcana" | "Athletics" | "Deception" | "History"
  | "Insight" | "Intimidation" | "Investigation" | "Medicine" | "Nature" | "Perception"
  | "Performance" | "Persuasion" | "Religion" | "Sleight of Hand" | "Stealth" | "Survival";

export const SKILLS: Record<Skill, Ability> = {
  Acrobatics: "DEX",
  "Animal Handling": "WIS",
  Arcana: "INT",
  Athletics: "STR",
  Deception: "CHA",
  History: "INT",
  Insight: "WIS",
  Intimidation: "CHA",
  Investigation: "INT",
  Medicine: "WIS",
  Nature: "INT",
  Perception: "WIS",
  Performance: "CHA",
  Persuasion: "CHA",
  Religion: "INT",
  "Sleight of Hand": "DEX",
  Stealth: "DEX",
  Survival: "WIS",
};

export interface Species {
  id: string;
  name: string;
  speed: number;
  size: string;
  blurb: string;
  traits: string[];
}

export const SPECIES: Species[] = [
  { id: "dragonborn", name: "Dragonborn", speed: 30, size: "Medium", blurb: "Proud draconic folk who exhale elemental breath.", traits: ["Breath Weapon", "Damage Resistance", "Darkvision 60 ft"] },
  { id: "dwarf", name: "Dwarf", speed: 30, size: "Medium", blurb: "Stone-tough and stubborn, at home deep underground.", traits: ["Darkvision 120 ft", "Dwarven Resilience", "Dwarven Toughness", "Stonecunning"] },
  { id: "elf", name: "Elf", speed: 30, size: "Medium", blurb: "Graceful, long-lived and touched by the magic of the wild.", traits: ["Darkvision 60 ft", "Elven Lineage", "Fey Ancestry", "Keen Senses", "Trance"] },
  { id: "gnome", name: "Gnome", speed: 30, size: "Small", blurb: "Small, clever tinkerers with a knack for illusion.", traits: ["Darkvision 60 ft", "Gnomish Cunning", "Gnomish Lineage"] },
  { id: "goliath", name: "Goliath", speed: 35, size: "Medium", blurb: "Towering mountain folk with the blood of giants.", traits: ["Giant Ancestry", "Large Form", "Powerful Build"] },
  { id: "halfling", name: "Halfling", speed: 30, size: "Small", blurb: "Cheerful and lucky — small folk who slip out of trouble.", traits: ["Brave", "Halfling Nimbleness", "Luck", "Naturally Stealthy"] },
  { id: "human", name: "Human", speed: 30, size: "Medium", blurb: "Ambitious and adaptable, found in every corner of the world.", traits: ["Resourceful", "Skillful", "Versatile"] },
  { id: "orc", name: "Orc", speed: 30, size: "Medium", blurb: "Fierce, enduring warriors who refuse to fall.", traits: ["Adrenaline Rush", "Darkvision 120 ft", "Relentless Endurance"] },
  { id: "tiefling", name: "Tiefling", speed: 30, size: "Medium", blurb: "Bearers of a fiendish legacy and innate spellcraft.", traits: ["Darkvision 60 ft", "Fiendish Legacy", "Otherworldly Presence"] },
];

export interface ClassDef {
  id: string;
  name: string;
  hitDie: number;
  primary: Ability[];
  saves: Ability[];
  attack: Ability; // ability used for its main attack or spell attack
  caster: boolean;
  blurb: string;
  features: string[];
  // AC with starting gear: base + DEX (capped) + extra ability + shield
  ac: { base: number; dexCap: number | null; plus?: Ability; shield?: boolean; label: string };
  skillChoices: number;
  skills: Skill[];
  color: string;
}

export const CLASSES: ClassDef[] = [
  { id: "barbarian", name: "Barbarian", hitDie: 12, primary: ["STR"], saves: ["STR", "CON"], attack: "STR", caster: false, color: "#E0683A",
    blurb: "A primal warrior fuelled by rage.", features: ["Rage", "Unarmored Defense", "Weapon Mastery"],
    ac: { base: 10, dexCap: null, plus: "CON", label: "Unarmored Defense" }, skillChoices: 2,
    skills: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
  { id: "bard", name: "Bard", hitDie: 8, primary: ["CHA"], saves: ["DEX", "CHA"], attack: "CHA", caster: true, color: "#E77FB0",
    blurb: "A performer whose music weaves real magic.", features: ["Bardic Inspiration", "Spellcasting"],
    ac: { base: 11, dexCap: null, label: "Leather Armor" }, skillChoices: 3,
    skills: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"] },
  { id: "cleric", name: "Cleric", hitDie: 8, primary: ["WIS"], saves: ["WIS", "CHA"], attack: "WIS", caster: true, color: "#F3ECDD",
    blurb: "A priestly champion who channels divine power.", features: ["Spellcasting", "Divine Order"],
    ac: { base: 13, dexCap: 2, shield: true, label: "Chain Shirt + Shield" }, skillChoices: 2,
    skills: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
  { id: "druid", name: "Druid", hitDie: 8, primary: ["WIS"], saves: ["INT", "WIS"], attack: "WIS", caster: true, color: "#7FD1AE",
    blurb: "A keeper of the old ways who commands nature.", features: ["Spellcasting", "Druidic", "Primal Order"],
    ac: { base: 11, dexCap: null, shield: true, label: "Leather Armor + Shield" }, skillChoices: 2,
    skills: ["Animal Handling", "Arcana", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"] },
  { id: "fighter", name: "Fighter", hitDie: 10, primary: ["STR", "DEX"], saves: ["STR", "CON"], attack: "STR", caster: false, color: "#C9CDD9",
    blurb: "A master of weapons, armor and battlefield tactics.", features: ["Fighting Style", "Second Wind", "Weapon Mastery"],
    ac: { base: 16, dexCap: 0, label: "Chain Mail" }, skillChoices: 2,
    skills: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Persuasion", "Perception", "Survival"] },
  { id: "monk", name: "Monk", hitDie: 8, primary: ["DEX", "WIS"], saves: ["STR", "DEX"], attack: "DEX", caster: false, color: "#7FB8E0",
    blurb: "A martial artist who channels inner focus.", features: ["Martial Arts", "Unarmored Defense"],
    ac: { base: 10, dexCap: null, plus: "WIS", label: "Unarmored Defense" }, skillChoices: 2,
    skills: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"] },
  { id: "paladin", name: "Paladin", hitDie: 10, primary: ["STR", "CHA"], saves: ["WIS", "CHA"], attack: "STR", caster: true, color: "#E8B84A",
    blurb: "A holy knight bound by a sacred oath.", features: ["Lay On Hands", "Spellcasting", "Weapon Mastery"],
    ac: { base: 16, dexCap: 0, shield: true, label: "Chain Mail + Shield" }, skillChoices: 2,
    skills: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"] },
  { id: "ranger", name: "Ranger", hitDie: 10, primary: ["DEX", "WIS"], saves: ["STR", "DEX"], attack: "DEX", caster: true, color: "#9BC46B",
    blurb: "A wilderness hunter and tracker.", features: ["Favored Enemy", "Spellcasting", "Weapon Mastery"],
    ac: { base: 12, dexCap: null, label: "Studded Leather" }, skillChoices: 3,
    skills: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] },
  { id: "rogue", name: "Rogue", hitDie: 8, primary: ["DEX"], saves: ["DEX", "INT"], attack: "DEX", caster: false, color: "#B0B6C6",
    blurb: "A sly expert in stealth, locks and well-placed strikes.", features: ["Expertise", "Sneak Attack", "Thieves' Cant"],
    ac: { base: 11, dexCap: null, label: "Leather Armor" }, skillChoices: 4,
    skills: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Persuasion", "Sleight of Hand", "Stealth"] },
  { id: "sorcerer", name: "Sorcerer", hitDie: 6, primary: ["CHA"], saves: ["CON", "CHA"], attack: "CHA", caster: true, color: "#F0956B",
    blurb: "A born spellcaster with magic in the blood.", features: ["Innate Sorcery", "Spellcasting"],
    ac: { base: 10, dexCap: null, label: "No armor" }, skillChoices: 2,
    skills: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"] },
  { id: "warlock", name: "Warlock", hitDie: 8, primary: ["CHA"], saves: ["WIS", "CHA"], attack: "CHA", caster: true, color: "#B79BFF",
    blurb: "A seeker of power through a pact with an otherworldly patron.", features: ["Eldritch Invocations", "Pact Magic"],
    ac: { base: 11, dexCap: null, label: "Leather Armor" }, skillChoices: 2,
    skills: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"] },
  { id: "wizard", name: "Wizard", hitDie: 6, primary: ["INT"], saves: ["INT", "WIS"], attack: "INT", caster: true, color: "#6FA8FF",
    blurb: "A scholar who masters magic through study.", features: ["Arcane Recovery", "Ritual Adept", "Spellcasting"],
    ac: { base: 10, dexCap: null, label: "No armor" }, skillChoices: 2,
    skills: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Nature", "Religion"] },
];

export interface Background {
  id: string;
  name: string;
  abilities: [Ability, Ability, Ability];
  feat: string;
  skills: [Skill, Skill];
  blurb: string;
}

export const BACKGROUNDS: Background[] = [
  { id: "acolyte", name: "Acolyte", abilities: ["INT", "WIS", "CHA"], feat: "Magic Initiate (Cleric)", skills: ["Insight", "Religion"], blurb: "Raised in service to a temple." },
  { id: "criminal", name: "Criminal", abilities: ["DEX", "CON", "INT"], feat: "Alert", skills: ["Sleight of Hand", "Stealth"], blurb: "Made a living in back alleys and shadows." },
  { id: "sage", name: "Sage", abilities: ["CON", "INT", "WIS"], feat: "Magic Initiate (Wizard)", skills: ["Arcana", "History"], blurb: "Spent years among books and scholars." },
  { id: "soldier", name: "Soldier", abilities: ["STR", "DEX", "CON"], feat: "Savage Attacker", skills: ["Athletics", "Intimidation"], blurb: "Trained for war and marched under a banner." },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;

export const SRD_ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Changes: rules summarized and reorganized for this app.";
