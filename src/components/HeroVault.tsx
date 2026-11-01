"use client";

import { useState } from "react";
import { connectVault, createVault, forgetVault, useCloudSync } from "@/lib/cloud";

/** Save characters to the cloud with a hero code, or load them on a new device. */
export default function HeroVault({ hasCharacters, compact = false }: { hasCharacters: boolean; compact?: boolean }) {
  const { code, status, enabled } = useCloudSync();
  const [entering, setEntering] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);

  if (!enabled) return null;

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      await createVault();
      setShow(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await connectVault(input);
      setEntering(false);
      setInput("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load that code.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = { off: "", syncing: "Saving…", saved: "Saved to the cloud", error: "Couldn't reach the cloud — saved on this device" }[status];

  if (code) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1F4A30] bg-[#101C15] ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#6EE7A0]">
            <span className={`h-2 w-2 rounded-full ${status === "error" ? "bg-bad" : "bg-good"}`} aria-hidden="true" />
            {statusLabel}
          </span>
          <span className="text-xs text-muted">
            Hero code:{" "}
            <b className="font-mono tracking-wide text-parch-hi">{show ? code : code.replace(/[A-Z0-9]/g, "•")}</b>{" "}
            <button type="button" onClick={() => setShow(!show)} className="ml-1 text-xs font-semibold text-gold">{show ? "Hide" : "Show"}</button>
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
            className="min-h-10 rounded-lg border border-gold px-3 text-sm font-semibold text-gold">{copied ? "Copied" : "Copy code"}</button>
          <button type="button" onClick={() => { if (confirm("Stop syncing on this device? Your characters stay here and in the cloud. You'll need the hero code to reconnect.")) forgetVault(); }}
            className="min-h-10 rounded-lg border border-line-2 px-3 text-sm text-soft">Unlink</button>
        </div>
        {show && !compact && (
          <p className="w-full text-xs text-muted">Write this down or save it in your notes. Enter it on any phone or computer to get your characters back. Anyone with the code can edit your characters, so keep it private.</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-gold-line bg-gold-panel ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-parch-hi">Keep your heroes on every device</span>
          <span className="text-sm text-muted">Characters save in this browser. A hero code also saves them in the cloud, so you can load them on any phone or computer.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasCharacters && (
            <button type="button" onClick={create} disabled={busy} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-bold text-gold-ink disabled:opacity-60">Save to cloud</button>
          )}
          <button type="button" onClick={() => setEntering(!entering)} className="min-h-11 rounded-xl border border-gold px-4 text-sm font-semibold text-gold">I have a hero code</button>
        </div>
      </div>
      {entering && (
        <form onSubmit={connect} className="flex flex-wrap gap-2">
          <label htmlFor="herocode" className="sr-only">Hero code</label>
          <input id="herocode" value={input} onChange={(e) => setInput(e.target.value)} placeholder="EMBER-WOLF-OAK-RUNE-1234" autoCapitalize="characters" autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-2 bg-ink px-4 font-mono text-parch placeholder:text-[#5A5440]" />
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-bold text-gold-ink disabled:opacity-60">{busy ? "Loading…" : "Load my characters"}</button>
        </form>
      )}
      {err && <p className="text-sm text-[#F28B7E]" role="alert">{err}</p>}
    </div>
  );
}
