import Anthropic from "@anthropic-ai/sdk";

interface PartyMember {
  name: string;
  summary: string;
  hp: number;
  maxHp: number;
  ac: number;
  backstory?: string;
}

interface Body {
  tone?: string;
  scene?: string;
  party?: PartyMember[];
  log?: { who?: string; kind: string; text: string }[];
  action?: string;
}

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

const SYSTEM = (tone: string, scene: string, party: PartyMember[]) => `You are the Dungeon Master for a small group of friends playing a fantasy tabletop RPG over the internet, using the 5th edition SRD rules (SRD 5.2). Keep the game moving and fun.

Tone: ${tone}. Current location: ${scene}.

The party:
${party.map((p) => `- ${p.name}: ${p.summary}, HP ${p.hp}/${p.maxHp}, AC ${p.ac}${p.backstory ? `. Backstory: ${p.backstory}` : ""}`).join("\n") || "- (no characters have joined yet)"}

How to run the table:
- Write vivid but tight narration: 60–140 words. Second person plural or address characters by name. No headings, no bullet lists, no markdown.
- Voice NPCs with short lines of dialogue in quotes.
- End with a clear prompt for what happens next, usually a question to a specific character.
- Only use monsters, spells and items from the SRD or your own original inventions. Do not use trademarked monsters or settings.
- Never decide what player characters do or say. Players choose; you describe the outcome.
- When the outcome is uncertain, ask for a roll with a tag on its own line, exactly like:
  [ROLL Kaelen Vos: Athletics DC 13]
  [ROLL Sable Thorne: Attack AC 15]
  [ROLL Brannoc: Wisdom save DC 12]
  Use the character's exact name. Checks can be any skill, an ability, "<Ability> save", "Attack" or "Initiative". Ask for at most one roll per character per message, then stop and wait.
- When rolls come back, apply them fairly (meet or beat the DC/AC succeeds; a natural 20 attack is a critical hit; a natural 1 attack misses) and roll damage or monster attacks yourself, stating the numbers briefly.
- When a fight starts, add each enemy group with a tag like: [FOE Goblin Boss | HP 21 | AC 17 | INIT 14]  (one tag per enemy) and ask everyone to roll Initiative.
- When the party moves somewhere new, add: [SCENE The Drowned Chapel]
- Track enemy HP yourself and tell the party when foes are bloodied or defeated.`;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response("The AI Dungeon Master isn't set up yet — add ANTHROPIC_API_KEY to the app's environment variables.", { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const party = (body.party ?? []).slice(0, 8).map((p) => ({
    name: clip(p.name, 40),
    summary: clip(p.summary, 80),
    hp: Number(p.hp) || 0,
    maxHp: Number(p.maxHp) || 0,
    ac: Number(p.ac) || 10,
    backstory: clip(p.backstory, 400),
  }));
  const history = (body.log ?? []).slice(-40).map((l) => `${l.kind === "ai" ? "DM" : clip(l.who, 40) || l.kind}: ${clip(l.text, 1500)}`).join("\n\n");
  const action = clip(body.action, 1500) || "Begin the adventure: set the opening scene and give the party a hook.";

  const client = new Anthropic({ apiKey: key });
  const stream = client.messages.stream({
    model: process.env.DM_MODEL || "claude-sonnet-5-5",
    max_tokens: 900,
    system: SYSTEM(clip(body.tone, 20) || "Heroic", clip(body.scene, 80) || "a roadside inn", party),
    messages: [
      {
        role: "user",
        content: `${history ? `The story so far:\n\n${history}\n\n---\n\n` : ""}Now: ${action}\n\nRespond as the DM.`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") controller.enqueue(encoder.encode(ev.delta.text));
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n(The DM lost their train of thought — try again.)"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
