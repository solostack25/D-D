import { createClient } from "@supabase/supabase-js";

/**
 * Gatekeeper for the AI routes. A request is only allowed when:
 *  - it comes from this site (same-origin browser request),
 *  - it names a real room that has been active in the last 12 hours,
 *  - that room is under its daily cap (300 AI calls) and the whole app is under 2,000/day.
 * Returns null when allowed, or a Response to send back.
 */
export async function guardAI(req: Request, roomCode: unknown): Promise<Response | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("The AI Dungeon Master isn't set up yet — add ANTHROPIC_API_KEY to the app's environment variables.", { status: 503 });
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {}
  const extra = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!originHost || (originHost !== host && !extra.includes(originHost))) {
    return new Response("Forbidden", { status: 403 });
  }

  const code = typeof roomCode === "string" ? roomCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{4,12}$/.test(code)) return new Response("Missing room", { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("The AI DM needs the database to be configured.", { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("ai_quota", { p_code: code });
  if (error) return new Response("Couldn't check the AI allowance — try again in a moment.", { status: 503 });
  if (data === "no_room") return new Response("This room isn't active yet — make a move or roll a die first, then try again.", { status: 403 });
  if (data === "room_limit") return new Response("This room has hit today's AI DM limit (300 turns). It resets at midnight UTC.", { status: 429 });
  if (data === "global_limit") return new Response("The AI DM has hit today's limit for the whole app. It resets at midnight UTC.", { status: 429 });
  return null;
}

export async function readJson<T>(req: Request, maxBytes = 120_000): Promise<T | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
