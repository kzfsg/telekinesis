/* The coach's voice: a GPT-Live session over WebRTC. The browser sends
   its offer and which game it's running; this trades it with OpenAI for
   an answer so the key stays on the server. Audio then flows straight
   between the browser and OpenAI. Sessions bill by the second, so the
   game closes its session when it ends. */

const LIVE_MODEL = process.env.OPENAI_COACH_MODEL || "gpt-live-1";
const BACKEND_MODEL = process.env.OPENAI_COACH_BACKEND_MODEL || "gpt-5-mini";
const VOICE = process.env.OPENAI_COACH_VOICE || "marin";
const MAX = 600;

export type CoachGame = { name: string; setup: string };
export type CoachRequest = { sdp: string; game: CoachGame };
export type CoachResponse = { sdp: string; sessionId: string };

const isGame = (g: unknown): g is CoachGame => {
  const x = g as CoachGame;
  return Boolean(x) && typeof x.name === "string" && typeof x.setup === "string" && x.name.length <= MAX && x.setup.length <= MAX;
};

const instructions = (game: CoachGame) =>
  [
    `You are the voice coach for "${game.name}", a short movement test in Telekinesis. The participant may be older, or living with a condition that affects how they move, and may be standing across the room from the screen.`,
    `Setting up: ${game.setup}`,
    `The game will send you lines to say as the test goes on: instructions, and problems with the camera view. Say each line exactly as written, clearly and warmly, then stop.`,
    `Never add encouragement, commentary, questions, counts or advice of your own, and never speak unless you've been given a line.`,
  ].join("\n");

export async function POST(request: Request): Promise<Response> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "OPENAI_API_KEY is not set" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as CoachRequest | null;
  if (!body || typeof body.sdp !== "string" || !isGame(body.game)) return Response.json({ error: "Expected { sdp, game }" }, { status: 400 });

  const res = await fetch("https://api.openai.com/v1/live/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      session: {
        model: LIVE_MODEL,
        instructions: instructions(body.game),
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
  return Response.json({ sdp: data.transport.sdp, sessionId: data.session.id } satisfies CoachResponse);
}
