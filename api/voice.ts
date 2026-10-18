/* The coach's voice: a line of text in, Grok's speech out, as MP3.
   A GET, so the same line is cached by the browser and the CDN and a
   game says "Now sit back down" without asking Grok every time. The
   key stays on the server; the length cap keeps this from being a
   general-purpose speech endpoint for anyone who finds it. */

const MAX = 240;
const VOICE = "carina";

export async function GET(request: Request): Promise<Response> {
  const text = new URL(request.url).searchParams.get("text")?.trim() ?? "";
  if (!text || text.length > MAX) return new Response("text is required, up to 240 characters", { status: 400 });
  const key = process.env.XAI_API_KEY;
  if (!key) return new Response("XAI_API_KEY is not set", { status: 503 });

  const res = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: VOICE, language: "en", text_normalization: true }),
  });
  if (!res.ok) return new Response(`Grok TTS failed: ${res.status} ${await res.text()}`, { status: 502 });

  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    },
  });
}
