"use client";

import { useEffect, useState } from "react";

export const SIGILS: Record<string, string> = {
  sword: "M14.5 3H21v6.5L9 21.5 2.5 15zM5 13l6 6M3 21l3-3",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3-1-3-.5-5.5 0-8z",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  leaf: "M5 19c0-9 6-14 15-15-1 9-6 15-15 15zM5 19l8-8",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  crown: "M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11",
};

export function Sigil({ name, size = 20, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={SIGILS[name] ?? SIGILS.sword} />
    </svg>
  );
}

export function Avatar({ color, sigil, size = 44, initial }: { color: string; sigil?: string; size?: number; initial?: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold text-ink"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {sigil ? <Sigil name={sigil} size={size * 0.55} color="#0e0f14" /> : initial}
    </div>
  );
}

export function Logo({ size = 30, text = true }: { size?: number; text?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg className="flicker" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E8B84A" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 21 7v10l-9 5-9-5V7z" />
        <path d="M12 2 7.5 14h9z" />
        <path d="M3 7l4.5 7M21 7l-4.5 7M12 22l-4.5-8M12 22l4.5-8" />
      </svg>
      {text && <span className="font-display text-lg font-extrabold tracking-[3px] text-gold">TAVERNLIGHT</span>}
    </span>
  );
}

/** Animated d20 that tumbles while `rolling` and lands on `value`. Change `spin` each roll to alternate direction. */
export function D20({ value, rolling, sides = 20, size = 150, crit, fumble, spin = 0 }: { value: number | string; rolling: boolean; sides?: number; size?: number; crit?: boolean; fumble?: boolean; spin?: number }) {
  const [face, setFace] = useState<number>(1);

  useEffect(() => {
    if (!rolling) return;
    const iv = setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), 70);
    return () => clearInterval(iv);
  }, [rolling, sides]);

  const shown = rolling ? face : value;
  const numSize = String(shown).length > 1 ? size * 0.25 : size * 0.29;
  return (
    <div className={crit ? "crit-glow" : ""} style={{ width: size + 20, height: size + 20 }}>
      <div className={`relative ${rolling ? (spin % 2 ? "tumble-b" : "tumble-a") : ""}`} style={{ width: size, height: size, margin: 10 }}>
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0">
          <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="#221C10" stroke="#E8B84A" strokeWidth={2.2} strokeLinejoin="round" />
          <polygon points="50,4 24,62 76,62" fill="#2C2414" stroke="#E8B84A" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M9 27 24 62 9 73M91 27 76 62 91 73M24 62 50 96 76 62" fill="none" stroke="#8C6E2C" strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center pt-1 font-display font-extrabold"
          style={{ fontSize: numSize, color: crit ? "#FFE08A" : fumble ? "#F28B7E" : "#F3ECDD" }}
          aria-live="polite"
        >
          {shown}
        </span>
      </div>
    </div>
  );
}

export function HpBar({ hp, max, h = 8 }: { hp: number; max: number; h?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, max)) * 100)));
  const col = pct > 60 ? "#4ADE80" : pct > 30 ? "#E8B84A" : "#F06A5A";
  return (
    <div className="overflow-hidden rounded-full bg-line" style={{ height: h }} role="progressbar" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={max} aria-label="Hit points">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col }} />
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-bold tracking-[1.8px] text-muted">{children}</span>;
}
