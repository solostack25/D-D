import Anthropic from "@anthropic-ai/sdk";
import { guardAI, readJson } from "@/lib/aiGuard";

interface Body {
  room?: string;
  scene?: string;
  previous?: string;
  log?: { who?: string; kind: string; text: string }[];
}

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

export async function POST(req: Request) {
  const body = await readJson<Body>(req, 200_000);
  if (!body) return new Response("Bad request", { status: 400 });
  const denied = await guardAI(req, body.room);
  if (denied) return denied;

  const log = (body.log ?? []).slice(-150).map((l) => `${l.kind === "ai" || l.kind === "dm" ? "DM" : clip(l.who, 40) || l.kind}: ${clip(l.text, 800)}`).join("\n");
  if (!log.trim()) return new Response("Nothing happened this session yet.", { status: 400 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create({
      model: process.env.DM_MODEL || "claude-sonnet-5-5",
      max_tokens: 500,
      system:
        "You write the 'Previously on…' recap that a Dungeon Master reads aloud to open the next session of a fantasy tabletop game. Write 90–150 words of dramatic second-person-plural narration covering the key events, choices, NPCs, loot and cliffhanger. Name the player characters. Plain prose, no headings, no lists, no markdown.",
      messages: [
        {
          role: "user",
          content: `${body.previous ? `Recap of the session before: ${clip(body.previous, 1500)}\n\n` : ""}Location at the end: ${clip(body.scene, 80)}\n\nThis session's log:\n${log}\n\nWrite the recap.`,
        },
      ],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return Response.json({ text });
  } catch {
    return new Response("Couldn't write the recap right now — try again.", { status: 502 });
  }
}
