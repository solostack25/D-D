"use client";

import { useState } from "react";
import { HpBar, Label } from "@/components/ui";
import { derive, fmt, normalize, type Character, type PublicCharacter } from "@/lib/character";
import { newId, type RollEntry } from "@/lib/room";
import {
  ASI_LEVELS, CONDITIONS, DICE_SKINS, ITEM_EFFECTS, SPELLS, SPELL_LEVEL_NAME, attacksPerTurn, sneakAttackDice, spellDice, spellSlots,
  type Spell,
} from "@/lib/rules";
import { ABILITIES, ABILITY_NAMES, type Ability } from "@/lib/srd";

export type RollKind = "check" | "attack" | "damage" | "heal" | "save" | "free";
export interface RollOpts {
  expr: string;
  label: string;
  kind: RollKind;
  ability?: Ability;
  crit?: boolean;
  req?: string;
  hidden?: boolean;
}
export interface Engine {
  roll: (o: RollOpts) => Promise<RollEntry | null>;
  busy: boolean;
}

type Full = ReturnType<typeof normalize>;
const TABS = ["Actions", "Spells", "Bag", "Status", "Level"] as const;

const btn = "min-h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-40";
const gold = `${btn} bg-gold text-gold-ink`;
const ghost = `${btn} border border-line-2 text-soft`;
const goldGhost = `${btn} border border-gold text-gold`;

export default function SheetPanel({ char, party, engine, update, log, heal, give }: {
  char: Full;
  party: PublicCharacter[];
  engine: Engine;
  update: (fn: (c: Full) => Character) => void;
  log: (text: string) => void;
  heal: (toId: string, amount: number) => void;
  give: (toId: string, item: { name: string; qty: number } | null, gold?: number) => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Actions");
  const d = derive(char);
  const hasSpells = d.slots.length > 0 || SPELLS.some((s) => s.level === 0 && s.classes.includes(char.classId));
  const tabs = TABS.filter((t) => t !== "Spells" || hasSpells);

  return (
    <section aria-label="Character sheet" className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-3.5">
      <div className="flex items-center justify-between">
        <Label>YOUR SHEET · PROF {fmt(d.prof)}</Label>
        <span className="text-xs text-muted">AC {d.ac} · Speed {d.speed}</span>
      </div>
      <div className="flex gap-1" role="tablist">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`min-h-9 flex-1 rounded-md px-1 text-[12px] font-bold ${tab === t ? "bg-gold text-gold-ink" : "bg-panel-2 text-soft"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Actions" && <Actions char={char} engine={engine} update={update} log={log} heal={heal} party={party} />}
      {tab === "Spells" && <Spells char={char} engine={engine} update={update} log={log} heal={heal} party={party} />}
      {tab === "Bag" && <Bag char={char} engine={engine} update={update} log={log} give={give} party={party} />}
      {tab === "Status" && <Status char={char} update={update} log={log} />}
      {tab === "Level" && <LevelUp char={char} engine={engine} update={update} log={log} />}
    </section>
  );
}

// ---------------------------------------------------------------- shared bits
function TargetSelect({ party, value, onChange, selfId }: { party: PublicCharacter[]; value: string; onChange: (v: string) => void; selfId: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Target" className="min-h-10 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch">
      {party.map((p) => <option key={p.id} value={p.id}>{p.id === selfId ? "Yourself" : p.name}</option>)}
    </select>
  );
}

function Pips({ max, used, onToggle, label }: { max: number; used: number; onToggle?: (i: number) => void; label: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1" aria-label={`${label}: ${max - used} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => {
        const spent = i >= max - used;
        return (
          <button key={i} type="button" onClick={() => onToggle?.(i)} disabled={!onToggle} aria-label={spent ? "Restore one" : "Spend one"}
            className={`h-4 w-4 rounded-full ${spent ? "border-2 border-line-2" : "bg-gold"}`} />
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------- actions
function Actions({ char, engine, update, log, heal, party }: { char: Full; engine: Engine; update: (fn: (c: Full) => Character) => void; log: (t: string) => void; heal: (to: string, n: number) => void; party: PublicCharacter[] }) {
  const d = derive(char);
  const [pending, setPending] = useState<{ weapon: string; crit: boolean } | null>(null);
  const [pool, setPool] = useState<Record<string, string>>({});
  const [target, setTarget] = useState(char.id);
  const per = attacksPerTurn(char.classId, char.level);

  async function attack(w: (typeof d.weapons)[number]) {
    const ab: Ability = w.ability === "FINESSE" ? (d.m("STR") >= d.m("DEX") ? "STR" : "DEX") : w.ability;
    const hit = d.m(ab) + d.prof;
    const r = await engine.roll({ expr: `1d20${fmt(hit)}`, label: `${w.name} attack`, kind: "attack", ability: ab });
    if (r) setPending({ weapon: w.name, crit: r.nat === 20 });
  }
  async function damage(w: (typeof d.weapons)[number], crit: boolean) {
    const ab: Ability = w.ability === "FINESSE" ? (d.m("STR") >= d.m("DEX") ? "STR" : "DEX") : w.ability;
    await engine.roll({ expr: `${w.dice}${fmt(d.m(ab))}`, label: `${w.name} damage${crit ? " (critical)" : ""}`, kind: "damage", crit });
    setPending(null);
  }
  function spend(id: string, amount = 1) {
    update((c) => ({ ...c, featureUsed: { ...c.featureUsed, [id]: (c.featureUsed[id] ?? 0) + amount } }));
  }
  async function hitDie() {
    const used = char.featureUsed.hitdice ?? 0;
    if (used >= char.level) return;
    const r = await engine.roll({ expr: `1d${d.cls.hitDie}${fmt(d.m("CON"))}`, label: "Hit Die (short rest)", kind: "heal" });
    if (r) update((c) => ({ ...c, hp: Math.min(d.maxHp, c.hp + Math.max(0, r.total)), featureUsed: { ...c.featureUsed, hitdice: used + 1 } }));
  }
  function rest(kind: "short" | "long") {
    update((c) => {
      const fu: Record<string, number> = { ...c.featureUsed };
      for (const f of d.features) if (kind === "long" || f.recharge === "short") delete fu[f.id];
      if (kind === "long") delete fu.hitdice;
      const slotsUsed = kind === "long" || c.classId === "warlock" ? [] : c.slotsUsed;
      return { ...c, featureUsed: fu, slotsUsed, hp: kind === "long" ? d.maxHp : c.hp };
    });
    log(`${char.name} takes a ${kind} rest.${kind === "long" ? " HP, spell slots and abilities restored." : ""}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted">Weapons{per > 1 ? ` · ${per} attacks per turn` : ""}</span>
        {d.weapons.map((w) => {
          const ab: Ability = w.ability === "FINESSE" ? (d.m("STR") >= d.m("DEX") ? "STR" : "DEX") : w.ability;
          const isPending = pending?.weapon === w.name;
          return (
            <div key={w.name} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${isPending ? "border-gold bg-[#1C1810]" : "border-line"}`}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-bold text-parch-hi">{w.name}</span>
                <span className="text-xs text-muted">{fmt(d.m(ab) + d.prof)} to hit · {w.dice}{fmt(d.m(ab))}</span>
              </div>
              <button type="button" disabled={engine.busy} onClick={() => attack(w)} className={goldGhost}>Attack</button>
              <button type="button" disabled={engine.busy} onClick={() => damage(w, isPending ? pending!.crit : false)} className={isPending ? gold : ghost}>
                {isPending && pending!.crit ? "Crit damage" : "Damage"}
              </button>
            </div>
          );
        })}
        {char.classId === "rogue" && (
          <button type="button" disabled={engine.busy} onClick={() => engine.roll({ expr: sneakAttackDice(char.level), label: "Sneak Attack", kind: "damage", crit: !!pending?.crit })} className={goldGhost}>
            Sneak Attack ({sneakAttackDice(char.level)})
          </button>
        )}
      </div>

      {d.features.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted">Abilities</span>
          {d.features.map((f) => {
            const used = Math.min(f.max, char.featureUsed[f.id] ?? 0);
            const left = f.max - used;
            return (
              <div key={f.id} className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-parch-hi">{f.name}</span>
                  <span className="text-xs text-muted">{f.pool ? `${left}/${f.max}` : ""} · {f.recharge} rest</span>
                </div>
                <span className="text-xs text-muted">{f.desc}</span>
                {f.pool ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={pool[f.id] ?? ""} onChange={(e) => setPool({ ...pool, [f.id]: e.target.value })} inputMode="numeric" placeholder="Amount" aria-label={`${f.name} amount`}
                      className="min-h-10 w-20 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch" />
                    {f.id === "layonhands" && <TargetSelect party={party} value={target} onChange={setTarget} selfId={char.id} />}
                    <button type="button" disabled={left <= 0} className={goldGhost} onClick={() => {
                      const n = Math.max(1, Math.min(left, Number(pool[f.id]) || 1));
                      spend(f.id, n);
                      if (f.id === "layonhands") { heal(target, n); log(`${char.name} uses Lay On Hands: heals ${n} HP.`); }
                      else log(`${char.name} spends ${n} ${f.name.toLowerCase()}.`);
                      setPool({ ...pool, [f.id]: "" });
                    }}>Spend</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Pips max={f.max} used={used} label={f.name} />
                    <button type="button" disabled={left <= 0 || engine.busy} className={`${goldGhost} ml-auto`} onClick={async () => {
                      spend(f.id);
                      if (f.dice) {
                        const r = await engine.roll({ expr: f.dice, label: f.name, kind: f.id === "secondwind" ? "heal" : "free" });
                        if (r && f.id === "secondwind") update((c) => ({ ...c, hp: Math.min(d.maxHp, c.hp + r.total) }));
                      } else log(`${char.name} uses ${f.name}.`);
                    }}>Use</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button type="button" disabled={engine.busy || (char.featureUsed.hitdice ?? 0) >= char.level} onClick={hitDie} className={ghost}>
          Spend Hit Die ({char.level - (char.featureUsed.hitdice ?? 0)} left)
        </button>
        <button type="button" onClick={() => rest("short")} className={ghost}>Short rest</button>
        <button type="button" onClick={() => rest("long")} className={goldGhost}>Long rest</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- spells
function Spells({ char, engine, update, log, heal, party }: { char: Full; engine: Engine; update: (fn: (c: Full) => Character) => void; log: (t: string) => void; heal: (to: string, n: number) => void; party: PublicCharacter[] }) {
  const d = derive(char);
  const [manage, setManage] = useState(char.spells.length === 0);
  const [target, setTarget] = useState(char.id);
  const [slotPick, setSlotPick] = useState<Record<string, number>>({});
  const maxLevel = d.slots.length;
  const available = SPELLS.filter((s) => s.classes.includes(char.classId) && s.level <= maxLevel);
  const prepared = available.filter((s) => char.spells.includes(s.id));
  const left = (lv: number) => (d.slots[lv - 1] ?? 0) - (char.slotsUsed[lv - 1] ?? 0);

  function toggleSlot(lv: number) {
    update((c) => {
      const used = [...c.slotsUsed];
      const max = d.slots[lv - 1] ?? 0;
      used[lv - 1] = ((used[lv - 1] ?? 0) + 1) % (max + 1);
      return { ...c, slotsUsed: used };
    });
  }

  async function cast(sp: Spell) {
    let slot = 0;
    if (sp.level > 0) {
      slot = slotPick[sp.id] ?? Array.from({ length: maxLevel }, (_, i) => i + 1).find((lv) => lv >= sp.level && left(lv) > 0) ?? 0;
      if (!slot || left(slot) <= 0) return;
      update((c) => {
        const used = [...c.slotsUsed];
        used[slot - 1] = (used[slot - 1] ?? 0) + 1;
        return { ...c, slotsUsed: used };
      });
    }
    const slotTxt = sp.level > 0 ? ` (${SPELL_LEVEL_NAME[slot]}-level slot)` : "";
    const dice = spellDice(sp, slot || sp.level, char.level, d.castMod);
    if (sp.kind === "attack") {
      const rays = sp.rays ? sp.rays + Math.max(0, slot - sp.level) : 1;
      for (let i = 0; i < rays; i++) {
        const label = rays > 1 ? `${sp.name} ray ${i + 1}` : sp.name;
        const r = await engine.roll({ expr: `1d20${fmt(d.spellAttack)}`, label: `${label} attack${i === 0 ? slotTxt : ""}`, kind: "attack" });
        if (!r) return;
        if (dice) await engine.roll({ expr: dice, label: `${label} damage${r.nat === 20 ? " (critical)" : ""}`, kind: "damage", crit: r.nat === 20 });
      }
    } else if (sp.kind === "save") {
      log(`${char.name} casts ${sp.name}${slotTxt} — DC ${d.spellDC} ${sp.save ? ABILITY_NAMES[sp.save] : ""} save.`);
      if (dice) await engine.roll({ expr: dice, label: `${sp.name} damage (half on a save)`, kind: "damage" });
    } else if (sp.kind === "heal") {
      const r = dice ? await engine.roll({ expr: dice, label: `${sp.name}${slotTxt}`, kind: "heal" }) : null;
      if (r) heal(target, Math.max(0, r.total));
    } else if (sp.kind === "damage") {
      if (dice) await engine.roll({ expr: dice, label: `${sp.name}${slotTxt}`, kind: "damage" });
    } else {
      log(`${char.name} casts ${sp.name}${slotTxt}. ${sp.desc}`);
      if (dice) await engine.roll({ expr: dice, label: sp.name, kind: "free" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>Spell attack <b className="text-parch-hi">{fmt(d.spellAttack)}</b></span>
        <span>Save DC <b className="text-parch-hi">{d.spellDC}</b></span>
        {d.castAbility && <span>({ABILITY_NAMES[d.castAbility]})</span>}
      </div>
      {d.slots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Spell slots{char.classId === "warlock" ? " (Pact Magic · short rest)" : ""}</span>
          {d.slots.map((n, i) => n > 0 && (
            <div key={i} className="flex items-center gap-2">
              <span className="w-9 text-xs font-bold text-soft">{SPELL_LEVEL_NAME[i + 1]}</span>
              <Pips max={n} used={Math.min(n, char.slotsUsed[i] ?? 0)} onToggle={() => toggleSlot(i + 1)} label={`${SPELL_LEVEL_NAME[i + 1]}-level slots`} />
            </div>
          ))}
        </div>
      )}
      {prepared.some((s) => s.kind === "heal") && (
        <label className="flex items-center gap-2 text-xs text-muted">Healing target <TargetSelect party={party} value={target} onChange={setTarget} selfId={char.id} /></label>
      )}
      {!manage && (
        <div className="flex flex-col gap-1.5">
          {prepared.length === 0 && <p className="text-sm text-muted">No spells prepared yet.</p>}
          {prepared.map((sp) => {
            const options = sp.level > 0 ? d.slots.map((n, i) => i + 1).filter((lv) => lv >= sp.level && (d.slots[lv - 1] ?? 0) > 0) : [];
            const canCast = sp.level === 0 || options.some((lv) => left(lv) > 0);
            return (
              <div key={sp.id} className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-bold text-parch-hi">{sp.name} <span className="text-xs font-normal text-muted">{SPELL_LEVEL_NAME[sp.level]}</span></span>
                  {options.length > 1 && (
                    <select aria-label={`Slot for ${sp.name}`} value={slotPick[sp.id] ?? ""} onChange={(e) => setSlotPick({ ...slotPick, [sp.id]: Number(e.target.value) })}
                      className="min-h-9 rounded-md border border-line-2 bg-ink px-1 text-xs text-parch">
                      <option value="">Auto</option>
                      {options.map((lv) => <option key={lv} value={lv} disabled={left(lv) <= 0}>{SPELL_LEVEL_NAME[lv]} ({left(lv)})</option>)}
                    </select>
                  )}
                  <button type="button" disabled={!canCast || engine.busy} onClick={() => cast(sp)} className={goldGhost}>Cast</button>
                </div>
                <span className="text-xs text-muted">{sp.desc}{sp.dice ? ` · ${spellDice(sp, sp.level, char.level, d.castMod)}` : ""}{sp.save ? ` · ${sp.save} save` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
      {manage && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Tap to prepare or unprepare. Ask your DM how many you can have ready.</span>
          {Array.from(new Set(available.map((s) => s.level))).map((lv) => (
            <div key={lv} className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-[1.2px] text-soft">{SPELL_LEVEL_NAME[lv].toUpperCase()}</span>
              <div className="flex flex-wrap gap-1.5">
                {available.filter((s) => s.level === lv).map((s) => {
                  const on = char.spells.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} title={s.desc}
                      onClick={() => update((c) => ({ ...c, spells: on ? c.spells.filter((x) => x !== s.id) : [...c.spells, s.id] }))}
                      className={`min-h-9 rounded-full px-3 text-xs font-semibold ${on ? "bg-gold text-gold-ink" : "border border-line-2 text-soft"}`}>{s.name}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setManage(!manage)} className={ghost}>{manage ? "Done" : "Manage spells"}</button>
    </div>
  );
}

// ---------------------------------------------------------------- bag
function Bag({ char, engine, update, log, give, party }: { char: Full; engine: Engine; update: (fn: (c: Full) => Character) => void; log: (t: string) => void; give: (to: string, item: { name: string; qty: number } | null, gold?: number) => void; party: PublicCharacter[] }) {
  const d = derive(char);
  const [name, setName] = useState("");
  const [goldDelta, setGoldDelta] = useState("");
  const [giveTo, setGiveTo] = useState<Record<string, string>>({});
  const others = party.filter((p) => p.id !== char.id);

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    update((c) => {
      const ex = c.inventory.find((i) => i.name.toLowerCase() === n.toLowerCase());
      return { ...c, inventory: ex ? c.inventory.map((i) => (i === ex ? { ...i, qty: i.qty + 1 } : i)) : [...c.inventory, { id: newId(), name: n, qty: 1 }] };
    });
    setName("");
  }
  function changeQty(id: string, delta: number) {
    update((c) => ({ ...c, inventory: c.inventory.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0) }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold-line bg-gold-panel px-3 py-2">
        <span className="font-display text-xl font-extrabold text-gold">{char.gold} gp</span>
        <input value={goldDelta} onChange={(e) => setGoldDelta(e.target.value)} inputMode="numeric" placeholder="Amount" aria-label="Gold amount" className="ml-auto min-h-10 w-20 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch" />
        <button type="button" className={ghost} onClick={() => { const n = Math.abs(Number(goldDelta) || 0); if (n) update((c) => ({ ...c, gold: Math.max(0, c.gold - n) })); setGoldDelta(""); }}>Spend</button>
        <button type="button" className={goldGhost} onClick={() => { const n = Math.abs(Number(goldDelta) || 0); if (n) update((c) => ({ ...c, gold: c.gold + n })); setGoldDelta(""); }}>Add</button>
      </div>
      {char.inventory.length === 0 && <p className="text-sm text-muted">Your bag is empty. Loot the AI DM hands out lands here automatically.</p>}
      {char.inventory.map((it) => {
        const effect = ITEM_EFFECTS.find((e) => e.match.test(it.name));
        return (
          <div key={it.id} className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-parch-hi">{it.name}</span>
              <button type="button" aria-label={`One less ${it.name}`} onClick={() => changeQty(it.id, -1)} className="h-8 w-8 rounded-md border border-line-2 text-soft">−</button>
              <span className="w-6 text-center text-sm font-bold text-parch-hi">{it.qty}</span>
              <button type="button" aria-label={`One more ${it.name}`} onClick={() => changeQty(it.id, 1)} className="h-8 w-8 rounded-md border border-line-2 text-soft">+</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {effect && (
                <button type="button" disabled={engine.busy} className={goldGhost} onClick={async () => {
                  const r = await engine.roll({ expr: effect.dice, label: `Drinks ${it.name}`, kind: "heal" });
                  if (r) { update((c) => ({ ...c, hp: Math.min(d.maxHp, c.hp + r.total), inventory: c.inventory.map((i) => (i.id === it.id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0) })); }
                }}>Use</button>
              )}
              {others.length > 0 && (
                <>
                  <select aria-label={`Give ${it.name} to`} value={giveTo[it.id] ?? ""} onChange={(e) => setGiveTo({ ...giveTo, [it.id]: e.target.value })} className="min-h-10 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch">
                    <option value="">Give to…</option>
                    {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" disabled={!giveTo[it.id]} className={ghost} onClick={() => {
                    const to = party.find((p) => p.id === giveTo[it.id]);
                    if (!to) return;
                    give(to.id, { name: it.name, qty: 1 });
                    changeQty(it.id, -1);
                    log(`${char.name} gives ${it.name} to ${to.name}.`);
                  }}>Give</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <form onSubmit={addItem} className="flex gap-2 border-t border-line pt-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item" aria-label="New item" className="min-h-10 min-w-0 flex-1 rounded-lg border border-line-2 bg-ink px-2.5 text-sm text-parch" />
        <button className={goldGhost}>Add</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- status
function Status({ char, update, log }: { char: Full; update: (fn: (c: Full) => Character) => void; log: (t: string) => void }) {
  const [notes, setNotes] = useState(char.notes);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Conditions (they change your rolls automatically)</span>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => {
            const on = char.conditions.includes(c.name);
            return (
              <button key={c.name} type="button" aria-pressed={on} title={c.note}
                onClick={() => {
                  update((x) => ({ ...x, conditions: on ? x.conditions.filter((n) => n !== c.name) : [...x.conditions, c.name] }));
                  log(`${char.name} is ${on ? "no longer " : ""}${c.name.toLowerCase()}.`);
                }}
                className={`min-h-9 rounded-full px-3 text-xs font-semibold ${on ? "bg-[#F0956B] text-ink" : "border border-line-2 text-soft"}`}>{c.name}</button>
            );
          })}
        </div>
        {char.conditions.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted">
            {char.conditions.map((n) => <li key={n}><b className="text-soft">{n}:</b> {CONDITIONS.find((c) => c.name === n)?.note}</li>)}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Dice skin (more unlock as you level)</span>
        <div className="grid grid-cols-4 gap-1.5">
          {DICE_SKINS.map((s) => {
            const locked = char.level < s.unlock;
            const on = char.diceSkin === s.id;
            return (
              <button key={s.id} type="button" disabled={locked} aria-pressed={on} onClick={() => update((c) => ({ ...c, diceSkin: s.id }))}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${on ? "border-gold" : "border-line"} disabled:opacity-40`}>
                <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill={s.body} stroke={s.edge} strokeWidth="6" /><polygon points="50,4 24,62 76,62" fill="none" stroke={s.edge} strokeWidth="4" /></svg>
                <span className="text-[10px] font-semibold text-soft">{locked ? `Lv ${s.unlock}` : s.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Backstory (the AI DM reads this)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== char.notes && update((c) => ({ ...c, notes }))} rows={3} maxLength={600}
          className="resize-none rounded-lg border border-line-2 bg-ink p-2.5 text-sm text-parch" />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------- level up
function LevelUp({ char, engine, update, log }: { char: Full; engine: Engine; update: (fn: (c: Full) => Character) => void; log: (t: string) => void }) {
  const d = derive(char);
  const next = char.level + 1;
  const avg = d.cls.hitDie / 2 + 1;
  const [hpGain, setHpGain] = useState<number | null>(null);
  const [asiMode, setAsiMode] = useState<"2" | "11">("2");
  const [a1, setA1] = useState<Ability>(d.cls.primary[0]);
  const [a2, setA2] = useState<Ability>("CON");
  if (char.level >= 20) return <p className="text-sm text-muted">{char.name} is level 20 — the peak of mortal power.</p>;
  const getsAsi = ASI_LEVELS.includes(next);
  const oldSlots = spellSlots(char.classId, char.level);
  const newSlots = spellSlots(char.classId, next);
  const slotChanges = newSlots.map((n, i) => n - (oldSlots[i] ?? 0)).map((n, i) => (n > 0 ? `+${n} ${SPELL_LEVEL_NAME[i + 1]}` : null)).filter(Boolean);
  const profUp = 2 + Math.floor((next - 1) / 4) > d.prof;
  const newSkin = DICE_SKINS.find((s) => s.unlock === next);

  function confirm() {
    if (hpGain == null) return;
    update((c) => {
      const asi = { ...c.asi };
      if (getsAsi) {
        if (asiMode === "2") asi[a1] = (asi[a1] ?? 0) + 2;
        else { asi[a1] = (asi[a1] ?? 0) + 1; asi[a2] = (asi[a2] ?? 0) + 1; }
      }
      const nc = { ...c, level: next, hpRolls: [...c.hpRolls.slice(0, next - 2), hpGain], asi };
      const newMax = derive(nc).maxHp;
      return { ...nc, hp: Math.min(newMax, c.hp + (newMax - d.maxHp)) };
    });
    log(`⭐ ${char.name} reached level ${next}!`);
    setHpGain(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-gold-line bg-gold-panel px-3 py-2.5">
        <span className="font-display text-3xl font-extrabold text-gold">{char.level} → {next}</span>
        <span className="text-xs text-muted">Level up when your DM says the party has earned it.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Hit points: d{d.cls.hitDie} {fmt(d.m("CON"))} CON</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setHpGain(avg)} aria-pressed={hpGain === avg} className={hpGain === avg ? gold : goldGhost}>Take average ({avg})</button>
          <button type="button" disabled={engine.busy} className={goldGhost} onClick={async () => {
            const r = await engine.roll({ expr: `1d${d.cls.hitDie}`, label: `Level ${next} hit points`, kind: "free" });
            if (r) setHpGain(r.total);
          }}>Roll d{d.cls.hitDie}</button>
        </div>
        {hpGain != null && <span className="text-sm text-parch-hi">+{hpGain + d.m("CON")} max HP</span>}
      </div>
      {getsAsi && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Ability Score Improvement</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={asiMode === "2"} onClick={() => setAsiMode("2")} className={asiMode === "2" ? gold : ghost}>+2 to one</button>
            <button type="button" aria-pressed={asiMode === "11"} onClick={() => setAsiMode("11")} className={asiMode === "11" ? gold : ghost}>+1 to two</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="First ability" value={a1} onChange={(e) => setA1(e.target.value as Ability)} className="min-h-10 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch">
              {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]} ({d.scores[a]})</option>)}
            </select>
            {asiMode === "11" && (
              <select aria-label="Second ability" value={a2} onChange={(e) => setA2(e.target.value as Ability)} className="min-h-10 rounded-lg border border-line-2 bg-ink px-2 text-sm text-parch">
                {ABILITIES.filter((a) => a !== a1).map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]} ({d.scores[a]})</option>)}
              </select>
            )}
          </div>
          <span className="text-xs text-muted">Scores can&apos;t go above 20. Or ask your DM about taking a feat instead.</span>
        </div>
      )}
      <ul className="flex flex-col gap-0.5 text-xs text-soft">
        {profUp && <li>Proficiency bonus becomes {fmt(d.prof + 1)}</li>}
        {slotChanges.length > 0 && <li>New spell slots: {slotChanges.join(", ")}</li>}
        {attacksPerTurn(char.classId, next) > attacksPerTurn(char.classId, char.level) && <li>Extra Attack: {attacksPerTurn(char.classId, next)} attacks per turn</li>}
        {char.classId === "rogue" && <li>Sneak Attack: {sneakAttackDice(next)}</li>}
        {newSkin && <li>Unlocks the {newSkin.name} dice skin</li>}
        <li>Check your class&apos;s level {next} features with your DM.</li>
      </ul>
      <button type="button" disabled={hpGain == null} onClick={confirm} className={`${gold} min-h-12 font-display tracking-[1.5px]`}>LEVEL UP TO {next}</button>
      <HpBar hp={char.hp} max={d.maxHp} />
    </div>
  );
}
