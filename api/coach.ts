/* The coach's voice: a GPT-Live session over WebRTC. The browser sends
   its offer; this trades it with OpenAI for an answer so the key stays
   on the server. Audio then flows straight between the browser and
   OpenAI. Sessions bill by the second, so the game closes its session
   when it ends. Nothing the browser sends reaches the instructions, so
   the endpoint can't be borrowed as a general voice assistant. */

const LIVE_MODEL = process.env.OPENAI_COACH_MODEL || "gpt-live-1";
const BACKEND_MODEL = process.env.OPENAI_COACH_BACKEND_MODEL || "gpt-5-mini";
const VOICE = process.env.OPENAI_COACH_VOICE || "marin";
/* an SDP offer is a few kilobytes; anything far bigger isn't one */
const MAX_SDP = 20_000;

const INSTRUCTIONS = [
  `You are the voice coach for a short movement test in Telekinesis. The participant may be older, or living with a condition that affects how they move, and may be standing across the room from the screen.`,
  `The game will send you lines to say as the test goes on: instructions, and problems with the camera view. Say each line exactly as written, clearly and warmly, then stop.`,
  `Never add encouragement, commentary, questions, counts or advice of your own, never answer anyone in the room, and never speak unless you've been given a line.`,
].join("\n");

/* a browser on another site can't start sessions on this key */
const crossSite = (request: Request) => {
  const origin = request.headers.get("Origin");
  return origin !== null && new URL(origin).host !== new URL(request.url).host;
};

export async function POST(request: Request): Promise<Response> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "OPENAI_API_KEY is not set" }, { status: 503 });

  if (crossSite(request)) return Response.json({ error: "Not allowed" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { sdp?: unknown } | null;
  if (typeof body?.sdp !== "string" || body.sdp.length > MAX_SDP) return Response.json({ error: "Expected { sdp }" }, { status: 400 });

  const res = await fetch("https://api.openai.com/v1/live/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      session: {
        model: LIVE_MODEL,
        instructions: INSTRUCTIONS,
        audio: { output: { voice: VOICE } },
        /* the coach has nothing to look up; a backend is still required */
        delegation: { type: "responses", responses: { model: BACKEND_MODEL } },
      },
      transport: { type: "webrtc", sdp: body.sdp },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`[coach] live session failed ${res.status} ${res.headers.get("x-request-id") ?? ""}: ${detail}`);
    return Response.json({ error: `Couldn't start the coach (${res.status})` }, { status: 502 });
  }

  const data = (await res.json()) as { session: { id: string }; transport: { sdp: string } };
  return Response.json({ sdp: data.transport.sdp, sessionId: data.session.id });
}
