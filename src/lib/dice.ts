export const rollDie = (sides: number) => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return 1 + (buf[0] % sides);
  }
  return 1 + Math.floor(Math.random() * sides);
};

export interface DiePart {
  sides: number;
  value: number;
  dropped?: boolean;
  sign?: 1 | -1;
}

export interface RollResult {
  expr: string;
  parts: DiePart[];
  modifier: number;
  total: number;
  nat: number | null; // the kept d20 when the roll is a single d20 (or adv/dis pair)
  mode: "normal" | "adv" | "dis";
  /** legacy fields */
  rolls: number[];
  sides: number;
}

/**
 * Rolls "2d6+1d8+3", "d20-1", "4d6kh3", "8d6".
 * mode adv/dis turns a single d20 into two d20s and keeps the higher/lower.
 */
export function roll(expr: string, mode: "normal" | "adv" | "dis" = "normal", crit = false): RollResult {
  const clean = expr.replace(/\s+/g, "").toLowerCase();
  const terms = clean.match(/[+-]?[^+-]+/g) ?? [];
  const parts: DiePart[] = [];
  let modifier = 0;
  let total = 0;
  let nat: number | null = null;
  const onlyD20 = /^1?d20([+-]\d+)*$/.test(clean);

  for (const raw of terms) {
    const sign: 1 | -1 = raw.startsWith("-") ? -1 : 1;
    const t = raw.replace(/^[+-]/, "");
    const m = t.match(/^(\d*)d(\d+)(k([hl])(\d+))?$/);
    if (!m) {
      const n = Number(t);
      if (Number.isFinite(n)) modifier += sign * n;
      continue;
    }
    let count = Math.min(60, Math.max(1, Number(m[1] || 1)));
    const sides = Math.min(1000, Math.max(2, Number(m[2])));
    if (crit) count *= 2;
    let keep = m[5] ? Number(m[5]) : count;
    let keepHigh = m[4] !== "l";
    if (onlyD20 && sides === 20 && count === 1 && mode !== "normal") {
      count = 2;
      keep = 1;
      keepHigh = mode === "adv";
    }
    const vals = Array.from({ length: count }, () => rollDie(sides));
    const order = vals.map((v, i) => ({ v, i })).sort((a, b) => (keepHigh ? b.v - a.v : a.v - b.v));
    const kept = new Set(order.slice(0, keep).map((x) => x.i));
    vals.forEach((v, i) => {
      parts.push({ sides, value: v, dropped: !kept.has(i), sign });
      if (kept.has(i)) total += sign * v;
    });
    if (onlyD20 && sides === 20) nat = order[0].v;
  }
  total += modifier;
  return { expr, parts, modifier, total, nat, mode, rolls: parts.map((p) => p.value), sides: parts[0]?.sides ?? 0 };
}

export const formatParts = (parts: DiePart[]) =>
  parts.map((p) => (p.dropped ? `(${p.value})` : `${p.sign === -1 ? "-" : ""}${p.value}`)).join(", ");
