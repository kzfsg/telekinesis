/* The coach's voice: a Grok Voice session over a WebSocket. This mints
   a short-lived token with the xAI key, so the key stays on the server,
   and hands back the instructions and voice with it, so they're fixed
   here rather than chosen by the page. The browser then talks straight
   to xAI. If this fails, the game falls back to GPT-Live (/api/coach). */

const MODEL = process.env.XAI_COACH_MODEL || "grok-voice-latest";
const VOICE = process.env.XAI_COACH_VOICE || "eve";
/* only long enough to open the socket */
const TOKEN_SECONDS = 60;

const INSTRUCTIONS = [
  `You are the voice coach for a short movement test in Telekinesis. The participant may be older, or living with a condition that affects how they move, and may be standing across the room from the screen.`,
  `The game will send you lines to say as the test goes on: instructions, and problems with the camera view. Say each line exactly as written, clearly and warmly, then stop.`,
  `Never add encouragement, commentary, questions, counts or advice of your own, never answer anyone in the room, and never speak unless you've been given a line.`,
].join("\n");

/* a browser on another site can't mint tokens on this key */
const crossSite = (request: Request) => {
  const origin = request.headers.get("Origin");
  return origin !== null && new URL(origin).host !== new URL(request.url).host;
};

export async function POST(request: Request): Promise<Response> {
  const key = process.env.XAI_API_KEY;
  if (!key) return Response.json({ error: "XAI_API_KEY is not set" }, { status: 503 });
  if (crossSite(request)) return Response.json({ error: "Not allowed" }, { status: 403 });

  const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expires_after: { seconds: TOKEN_SECONDS } }),
  });
  if (!res.ok) {
    console.error(`[grok] client secret failed ${res.status}: ${await res.text()}`);
    return Response.json({ error: `Couldn't start the coach (${res.status})` }, { status: 502 });
  }

  const data = (await res.json()) as { value?: string; client_secret?: { value?: string } };
  const token = data.value ?? data.client_secret?.value;
  if (!token) return Response.json({ error: "No token in xAI's reply" }, { status: 502 });
  return Response.json({ token, model: MODEL, voice: VOICE, instructions: INSTRUCTIONS });
}
