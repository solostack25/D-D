"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, D20, Label, Logo, SIGILS } from "@/components/ui";
import { derive, fmt, mod, now, saveCharacter, uid, type Character, type Scores } from "@/lib/character";
import { rollDie } from "@/lib/dice";
import {
  ABILITIES, ABILITY_NAMES, BACKGROUNDS, CLASSES, POINT_BUY_BUDGET, POINT_BUY_COST, SKILLS, SPECIES, STANDARD_ARRAY,
  type Ability, type Skill,
} from "@/lib/srd";

const STEPS = ["Class", "Species", "Background", "Abilities", "Skills", "Identity"] as const;
type Method = "array" | "roll" | "buy";
const COLORS = ["#E8B84A", "#E0683A", "#7FD1AE", "#B79BFF", "#6FA8FF", "#E77FB0", "#9BC46B", "#F3ECDD"];
const NAME_IDEAS = ["Kaelen Vos", "Sable Thorne", "Brannoc Ironhelm", "Zephyra Lune", "Ilsa Marrow", "Torvin Ash", "Mira Quickwater", "Dask Embermane", "Orrin Vale", "Nyx Harrowgate"];

function suggested(values: number[], primary: Ability[]): Scores {
  const order: Ability[] = [...primary];
  for (const a of ["CON", "DEX", "WIS", "CHA", "INT", "STR"] as Ability[]) if (!order.includes(a)) order.push(a);
  const sorted = [...values].sort((a, b) => b - a);
  const out = {} as Scores;
  order.forEach((a, i) => (out[a] = sorted[i]));
  return out;
}

export default function CharacterCreator() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [classId, setClassId] = useState("paladin");
  const [speciesId, setSpeciesId] = useState("human");
  const [backgroundId, setBackgroundId] = useState("soldier");
  const [method, setMethod] = useState<Method>("array");
  const [arrayScores, setArrayScores] = useState<Scores>(() => suggested(STANDARD_ARRAY, ["STR", "CHA"]));
  const [rolled, setRolled] = useState<{ dice: number[]; total: number }[] | null>(null);
  const [rollScores, setRollScores] = useState<Scores | null>(null);
  const [rolling, setRolling] = useState(false);
  const [buy, setBuy] = useState<Scores>({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 });
  const [swapFrom, setSwapFrom] = useState<Ability | null>(null);
  const [bonusMode, setBonusMode] = useState<"21" | "111">("21");
  const [plus2, setPlus2] = useState<Ability>("STR");
  const [plus1, setPlus1] = useState<Ability>("CON");
  const [classSkills, setClassSkills] = useState<Skill[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [color, setColor] = useState(COLORS[0]);
  const [sigil, setSigil] = useState("sword");
  const [notes, setNotes] = useState("");

  const cls = CLASSES.find((c) => c.id === classId)!;
  const bg = BACKGROUNDS.find((b) => b.id === backgroundId)!;

  const base: Scores = method === "array" ? arrayScores : method === "roll" ? rollScores ?? arrayScores : buy;
  const bonus = useMemo(() => {
    const out: Partial<Record<Ability, number>> = {};
    if (bonusMode === "111") bg.abilities.forEach((a) => (out[a] = 1));
    else {
      out[plus2] = 2;
      if (plus1 !== plus2) out[plus1] = 1;
    }
    return out;
  }, [bonusMode, bg, plus1, plus2]);

  const draft: Character = {
    id: "draft", name: name || "Unnamed hero", speciesId, classId, backgroundId, level, base, bonus,
    classSkills, color, sigil, hp: 999, notes, createdAt: 0,
  };
  const d = derive(draft);
  const pointsSpent = ABILITIES.reduce((s, a) => s + POINT_BUY_COST[buy[a]], 0);
  const skillsOk = classSkills.length === cls.skillChoices;
  const rollReady = method !== "roll" || !!rollScores;
  const canNext = [true, true, true, rollReady && (method !== "buy" || pointsSpent <= POINT_BUY_BUDGET), skillsOk, name.trim().length > 1][step];

  function go(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pickClass(id: string) {
    const c = CLASSES.find((x) => x.id === id)!;
    setClassId(id);
    setClassSkills([]);
    setColor(c.color);
    setArrayScores(suggested(STANDARD_ARRAY, c.primary));
    if (rolled) setRollScores(suggested(rolled.map((r) => r.total), c.primary));
  }

  function pickBackground(id: string) {
    const b = BACKGROUNDS.find((x) => x.id === id)!;
    setBackgroundId(id);
    // Put the +2 on the class's best ability if the background allows it.
    const best = cls.primary.find((a) => b.abilities.includes(a)) ?? b.abilities[0];
    setPlus2(best);
    setPlus1(b.abilities.find((a) => a !== best && a === "CON") ?? b.abilities.find((a) => a !== best)!);
  }

  function rollStats() {
    if (rolling) return;
    setRolling(true);
    setTimeout(() => {
      const sets = Array.from({ length: 6 }, () => {
        const dice = Array.from({ length: 4 }, () => rollDie(6));
        const total = [...dice].sort((a, b) => b - a).slice(0, 3).reduce((s, n) => s + n, 0);
        return { dice, total };
      });
      setRolled(sets);
      setRollScores(suggested(sets.map((s) => s.total), cls.primary));
      setRolling(false);
    }, 900);
  }

  function clickSwap(a: Ability) {
    if (method === "buy") return;
    if (!swapFrom) return setSwapFrom(a);
    if (swapFrom === a) return setSwapFrom(null);
    const src = method === "array" ? arrayScores : rollScores!;
    const next = { ...src, [a]: src[swapFrom], [swapFrom]: src[a] };
    if (method === "array") setArrayScores(next);
    else setRollScores(next);
    setSwapFrom(null);
  }

  function toggleSkill(s: Skill) {
    setClassSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length < cls.skillChoices ? [...cur, s] : cur));
  }

  function finish() {
    const c: Character = { ...draft, id: uid(), name: name.trim(), createdAt: now() };
    c.hp = derive(c).maxHp;
    saveCharacter(c);
    router.push(`/?created=${c.id}`);
  }

  const card = (on: boolean) =>
    `flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition ${on ? "border-gold bg-[#1C1810]" : "border-line bg-panel hover:border-line-2"}`;

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-10">
        <Link href="/" aria-label="Tavernlight home"><Logo /></Link>
        <Link href="/" className="text-sm font-semibold text-muted hover:text-parch">Cancel</Link>
      </header>

      <div className="mx-auto flex max-w-[1240px] flex-wrap gap-8 px-5 py-8 md:px-10">
        <main className="min-w-0 flex-[999_1_560px]">
          <span className="text-xs font-bold tracking-[2.5px] text-ember">CHARACTER CREATOR</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-parch-hi md:text-5xl">Forge your hero</h1>

          <nav aria-label="Steps" className="mt-6 flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => i <= step + 1 && (i <= step || canNext) && go(i)}
                aria-current={i === step ? "step" : undefined}
                className={`min-h-11 rounded-full px-4 text-sm font-semibold ${i === step ? "bg-gold text-gold-ink" : i < step ? "bg-panel-2 text-parch" : "border border-line text-muted"}`}
              >
                {i + 1}. {s}
              </button>
            ))}
          </nav>

          <section className="mt-8">
            {step === 0 && (
              <>
                <h2 className="font-display text-2xl font-bold text-parch-hi">Choose a class</h2>
                <p className="mt-1 text-muted">Your class is what you do in a fight — and how you solve problems.</p>
                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {CLASSES.map((c) => (
                    <button key={c.id} type="button" onClick={() => pickClass(c.id)} aria-pressed={classId === c.id} className={card(classId === c.id)}>
                      <div className="flex w-full items-center justify-between">
                        <span className="font-display text-xl font-bold text-parch-hi">{c.name}</span>
                        <span className="rounded-md bg-panel-2 px-2 py-1 text-xs font-bold text-soft">d{c.hitDie}</span>
                      </div>
                      <span className="text-sm text-muted">{c.blurb}</span>
                      <span className="text-xs font-semibold text-gold">Best stat: {c.primary.map((a) => ABILITY_NAMES[a]).join(" / ")}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="font-display text-2xl font-bold text-parch-hi">Choose a species</h2>
                <p className="mt-1 text-muted">Your people shape your senses, size and natural gifts.</p>
                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {SPECIES.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSpeciesId(s.id)} aria-pressed={speciesId === s.id} className={card(speciesId === s.id)}>
                      <span className="font-display text-xl font-bold text-parch-hi">{s.name}</span>
                      <span className="text-sm text-muted">{s.blurb}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {s.traits.map((t) => (
                          <span key={t} className="rounded-full bg-panel-2 px-2 py-1 text-[11px] font-semibold text-soft">{t}</span>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-gold">{s.size} · Speed {s.speed} ft</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-display text-2xl font-bold text-parch-hi">Choose a background</h2>
                <p className="mt-1 text-muted">Where you came from gives you skills, a feat, and boosts to your ability scores.</p>
                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                  {BACKGROUNDS.map((b) => (
                    <button key={b.id} type="button" onClick={() => pickBackground(b.id)} aria-pressed={backgroundId === b.id} className={card(backgroundId === b.id)}>
                      <span className="font-display text-xl font-bold text-parch-hi">{b.name}</span>
                      <span className="text-sm text-muted">{b.blurb}</span>
                      <span className="text-xs text-soft">Skills: {b.skills.join(", ")}</span>
                      <span className="text-xs text-soft">Feat: {b.feat}</span>
                      <span className="text-xs font-semibold text-gold">Boosts: {b.abilities.join(" · ")}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="font-display text-2xl font-bold text-parch-hi">Ability scores</h2>
                <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Score method">
                  {([["array", "Standard array"], ["roll", "Roll 4d6"], ["buy", "Point buy"]] as [Method, string][]).map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={method === k} onClick={() => { setMethod(k); setSwapFrom(null); }}
                      className={`min-h-11 rounded-full px-4 text-sm font-semibold ${method === k ? "bg-gold text-gold-ink" : "border border-line-2 text-soft"}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted">
                  {method === "array" && "15, 14, 13, 12, 10, 8 — already placed for your class. Tap two abilities to swap them."}
                  {method === "roll" && "Roll four d6 six times and keep the best three each time. Tap two abilities to swap."}
                  {method === "buy" && `Every score starts at 8. Spend up to ${POINT_BUY_BUDGET} points (max 15 before bonuses).`}
                </p>

                {method === "roll" && (
                  <div className="mt-4 flex flex-wrap items-center gap-6 rounded-2xl border border-gold-line bg-gold-panel p-5">
                    <D20 value={rolled ? "✓" : "?"} rolling={rolling} spin={rolled ? rolled.length + rolled[0].total : 0} sides={6} size={90} />
                    <div className="flex flex-col gap-3">
                      <button type="button" onClick={rollStats} disabled={rolling}
                        className="min-h-12 rounded-xl bg-gold px-6 font-display text-base font-extrabold tracking-[2px] text-gold-ink disabled:opacity-60">
                        {rolled ? "REROLL STATS" : "ROLL STATS"}
                      </button>
                      {rolled && (
                        <div className="flex flex-wrap gap-2">
                          {rolled.map((r, i) => {
                            const low = Math.min(...r.dice);
                            let dropped = false;
                            return (
                              <span key={i} className="rise rounded-lg bg-panel-2 px-2.5 py-1.5 text-xs text-soft" style={{ animationDelay: `${i * 70}ms` }}>
                                {r.dice.map((n, j) => {
                                  const drop = !dropped && n === low;
                                  if (drop) dropped = true;
                                  return <span key={j} className={drop ? "text-muted line-through" : ""}>{n}{j < 3 ? " " : ""}</span>;
                                })}
                                <b className="ml-1 text-gold">= {r.total}</b>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {method === "buy" && (
                  <p className={`mt-3 text-sm font-semibold ${pointsSpent > POINT_BUY_BUDGET ? "text-bad" : "text-gold"}`}>
                    {POINT_BUY_BUDGET - pointsSpent} points left
                  </p>
                )}

                <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                  {ABILITIES.map((a) => {
                    const fin = d.scores[a];
                    const b = bonus[a] ?? 0;
                    const selected = swapFrom === a;
                    const primary = cls.primary.includes(a);
                    const inner = (
                      <>
                        <span className="text-xs font-bold tracking-[1.2px] text-soft">{ABILITY_NAMES[a].toUpperCase()}</span>
                        <span className="font-display text-4xl font-extrabold text-parch-hi">{fin}</span>
                        <span className="text-sm font-bold text-gold">{fmt(mod(fin))}</span>
                        <span className="text-[11px] text-muted">{base[a]}{b ? ` + ${b} background` : ""}{primary ? " · class key" : ""}</span>
                      </>
                    );
                    return method === "buy" ? (
                      <div key={a} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-panel p-4">
                        {inner}
                        <div className="mt-2 flex gap-2">
                          <button type="button" aria-label={`Lower ${ABILITY_NAMES[a]}`} disabled={buy[a] <= 8}
                            onClick={() => setBuy({ ...buy, [a]: buy[a] - 1 })}
                            className="h-11 w-11 rounded-lg border border-line-2 text-lg font-bold text-soft disabled:opacity-30">−</button>
                          <button type="button" aria-label={`Raise ${ABILITY_NAMES[a]}`}
                            disabled={buy[a] >= 15 || pointsSpent + POINT_BUY_COST[buy[a] + 1] - POINT_BUY_COST[buy[a]] > POINT_BUY_BUDGET}
                            onClick={() => setBuy({ ...buy, [a]: buy[a] + 1 })}
                            className="h-11 w-11 rounded-lg border border-gold text-lg font-bold text-gold disabled:opacity-30">+</button>
                        </div>
                      </div>
                    ) : (
                      <button key={a} type="button" onClick={() => clickSwap(a)} disabled={method === "roll" && !rollScores} aria-pressed={selected}
                        className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition disabled:opacity-40 ${selected ? "border-gold bg-[#1C1810]" : primary ? "border-gold-line bg-gold-panel" : "border-line bg-panel"}`}>
                        {inner}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
                  <span className="font-semibold text-parch-hi">{bg.name} background boost</span>
                  <div className="flex flex-wrap gap-2">
                    {([["21", "+2 and +1"], ["111", "+1 to all three"]] as const).map(([k, l]) => (
                      <button key={k} type="button" aria-pressed={bonusMode === k} onClick={() => setBonusMode(k)}
                        className={`min-h-11 rounded-full px-4 text-sm font-semibold ${bonusMode === k ? "bg-gold text-gold-ink" : "border border-line-2 text-soft"}`}>{l}</button>
                    ))}
                  </div>
                  {bonusMode === "21" && (
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-soft">+2 to
                        <select value={plus2} onChange={(e) => setPlus2(e.target.value as Ability)} className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-parch">
                          {bg.abilities.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-soft">+1 to
                        <select value={plus1} onChange={(e) => setPlus1(e.target.value as Ability)} className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-parch">
                          {bg.abilities.filter((a) => a !== plus2).map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="font-display text-2xl font-bold text-parch-hi">Pick {cls.skillChoices} {cls.name} skills</h2>
                <p className="mt-1 text-muted">Your {bg.name} background already gives you {bg.skills.join(" and ")}.</p>
                <p className="mt-3 text-sm font-semibold text-gold">{classSkills.length} of {cls.skillChoices} chosen</p>
                <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                  {(Object.keys(SKILLS) as Skill[]).map((s) => {
                    const fromBg = bg.skills.includes(s);
                    const allowed = cls.skills.includes(s) && !fromBg;
                    const on = classSkills.includes(s) || fromBg;
                    return (
                      <button key={s} type="button" disabled={!allowed} onClick={() => toggleSkill(s)} aria-pressed={on}
                        className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition disabled:cursor-not-allowed ${on ? "border-gold bg-[#1C1810] text-parch-hi" : allowed ? "border-line-2 bg-panel text-soft" : "border-line bg-ink text-[#6B7080]"}`}>
                        <span>{s} <span className="text-xs font-normal text-muted">{SKILLS[s]}</span></span>
                        <span className={on ? "text-gold" : ""}>{fmt(d.skillMod(s) + (on && !d.skills.has(s) ? d.prof : 0))}{fromBg ? " · bg" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <h2 className="font-display text-2xl font-bold text-parch-hi">Who are they?</h2>
                <div className="mt-5 flex flex-col gap-5">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-soft">Character name</span>
                    <div className="flex flex-wrap gap-2">
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kaelen Vos" maxLength={40}
                        className="min-h-12 flex-1 rounded-xl border border-line-2 bg-ink px-4 text-lg text-parch placeholder:text-[#6B7080]" />
                      <button type="button" onClick={() => setName(NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)])}
                        className="min-h-12 rounded-xl border border-gold px-4 text-sm font-semibold text-gold">Random name</button>
                    </div>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-soft">Starting level: {level}</span>
                    <input type="range" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="accent-[#E8B84A]" />
                  </label>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-semibold text-soft">Color</legend>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((c) => (
                        <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
                          className="h-11 w-11 rounded-full" style={{ background: c, boxShadow: color === c ? "0 0 0 3px #0e0f14, 0 0 0 5px #E8B84A" : "none" }} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-semibold text-soft">Sigil</legend>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(SIGILS).map((s) => (
                        <button key={s} type="button" aria-label={`Sigil ${s}`} aria-pressed={sigil === s} onClick={() => setSigil(s)}
                          className={`rounded-xl p-1 ${sigil === s ? "ring-2 ring-gold" : ""}`}>
                          <Avatar color={color} sigil={s} size={44} />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-soft">Backstory (optional — the AI DM reads this)</span>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={600}
                      placeholder="A disgraced knight trying to win back a family name…"
                      className="resize-none rounded-xl border border-line-2 bg-ink p-4 text-parch placeholder:text-[#6B7080]" />
                  </label>
                </div>
              </>
            )}
          </section>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <button type="button" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}
              className="min-h-12 rounded-xl border border-line-2 px-5 font-semibold text-soft disabled:opacity-30">Back</button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => go(step + 1)} disabled={!canNext}
                className="min-h-12 rounded-xl bg-gold px-8 font-display text-base font-extrabold tracking-[2px] text-gold-ink disabled:opacity-40">NEXT</button>
            ) : (
              <button type="button" onClick={finish} disabled={!canNext}
                className="min-h-12 rounded-xl bg-gold px-8 font-display text-base font-extrabold tracking-[2px] text-gold-ink disabled:opacity-40">CREATE CHARACTER</button>
            )}
          </div>
        </main>

        <aside className="flex-[1_1_300px] lg:max-w-[340px]">
          <div className="sticky top-6 flex flex-col gap-4 rounded-2xl border border-gold-line bg-gold-panel p-5">
            <Label>PREVIEW</Label>
            <div className="flex items-center gap-3">
              <Avatar color={color} sigil={sigil} size={56} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-display text-xl font-extrabold text-parch-hi">{name || "Unnamed hero"}</span>
                <span className="text-sm text-muted">{d.species.name} {d.cls.name} · Lv {level}</span>
                <span className="text-xs text-muted">{d.bg.name}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[["HP", d.maxHp], ["AC", d.ac], ["SPEED", d.speed]].map(([k, v]) => (
                <div key={k} className="flex flex-col items-center rounded-xl border border-line bg-panel py-2">
                  <span className="text-[10px] font-bold tracking-[1.2px] text-muted">{k}</span>
                  <span className="font-display text-xl font-extrabold text-parch-hi">{v}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => (
                <div key={a} className="flex flex-col items-center rounded-xl bg-panel py-2">
                  <span className="text-[10px] font-bold tracking-[1.2px] text-soft">{a}</span>
                  <span className="font-display text-lg font-extrabold text-gold">{fmt(d.m(a))}</span>
                  <span className="text-[11px] text-muted">{d.scores[a]}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted">
              <span>Proficiency {fmt(d.prof)} · Attack {fmt(d.attackMod)} · Initiative {fmt(d.initiative)}</span>
              <span>Saves: {d.cls.saves.join(", ")} · Armor: {d.cls.ac.label}</span>
              <span>Skills: {[...d.skills].join(", ")}</span>
              <span>Features: {[...d.cls.features, ...d.species.traits.slice(0, 2), d.bg.feat].join(" · ")}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
