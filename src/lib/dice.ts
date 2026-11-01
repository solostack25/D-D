export const rollDie = (sides: number) => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return 1 + (buf[0] % sides);
  }
  return 1 + Math.floor(Math.random() * sides);
};

export interface RollResult {
  expr: string;
  rolls: number[];
  kept: number[];
  modifier: number;
  total: number;
  sides: number;
  nat: number | null; // natural d20 result when a single d20 was rolled
}

/** Parses "2d6+3", "d20-1", "4d6kh3". */
export function roll(expr: string): RollResult {
  const m = expr.replace(/\s+/g, "").toLowerCase().match(/^(\d*)d(\d+)(kh(\d+))?([+-]\d+)?$/);
  if (!m) return { expr, rolls: [], kept: [], modifier: 0, total: 0, sides: 0, nat: null };
  const count = Math.min(50, Math.max(1, Number(m[1] || 1)));
  const sides = Math.min(1000, Math.max(2, Number(m[2])));
  const keep = m[4] ? Number(m[4]) : count;
  const modifier = m[5] ? Number(m[5]) : 0;
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  const kept = [...rolls].sort((a, b) => b - a).slice(0, keep);
  const total = kept.reduce((a, b) => a + b, 0) + modifier;
  return { expr, rolls, kept, modifier, total, sides, nat: sides === 20 && count === 1 ? rolls[0] : null };
}
