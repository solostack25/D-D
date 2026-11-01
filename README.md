# Tavernlight

An online table for a fantasy RPG group that plays from different cities. Everyone joins a room from a link, sees the same dice land, moves tokens on a shared battle map, and tracks initiative and HP together. When nobody wants to run the game, an AI Dungeon Master narrates and calls for rolls.

## Features

- **Character creator**: class, species and background, ability scores (standard array, rolled 4d6-drop-lowest, or point buy), background boosts, class skills, level 1–20, color, sigil and backstory. HP, AC, proficiency, saves and skill modifiers are calculated for you. Characters are saved in the browser.
- **Rooms**: share a code like `EMBR-7Q`. Pick a character, or join as the DM.
- **Live dice**: an animated d20 tray with d4–d100, multiple dice, and checks calculated from your sheet. Every roll shows up for the whole table. The DM can make secret rolls.
- **Battle map**: tap a token, then tap a square to move it.
- **Initiative tracker**: roll your own initiative, add foes with HP, and step through turns.
- **AI Dungeon Master**: four tones (Heroic, Grim, Comedic, Spooky). It reads the party's sheets and backstories, puts roll buttons in front of the right player, adds monsters to initiative and the map, and keeps going once everyone has rolled.
- **Human DM mode**: the DM narrates in the story log and can make secret rolls.
- **Hero codes (cloud saves)**: tap "Save to cloud" to get a secret code like `TOWER-CLOAK-REED-TALON-5686`. Enter it on any phone or computer to load your characters. Edits and deletions sync automatically.
- **Saved rooms**: a room's story, rolls, initiative and map are saved to the cloud, so the same room code continues next session.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev
```

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live sync across devices (Supabase Realtime), hero-code character saves, and saved rooms. Run `supabase/migrations/*.sql` on the project first. Without these, everything stays on one device. |
| `ANTHROPIC_API_KEY` | Turns on the AI Dungeon Master (`/api/dm`). |
| `DM_MODEL` | Optional. Changes the model the AI DM uses (default `claude-sonnet-5-5`). |

Deploy on Vercel and add the same variables under Project → Settings → Environment Variables.

## Tech

Next.js 16 (App Router), React 19, Tailwind CSS 4, Supabase Realtime, and the Anthropic SDK.

## Legal

Tavernlight is an unofficial fan project and is not affiliated with Wizards of the Coast. It does not use the Dungeons & Dragons name, logos, or art.

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Changes: rules were summarized and reorganized for this app.
