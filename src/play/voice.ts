/* A voice coach, spoken by GPT-Live: it says each new instruction and
   any recording problem the moment it appears. The session is created by /api/coach so the key
   stays on the server; audio comes back on a WebRTC track and lines go
   out on the "oai-events" data channel. Until the session is up only
   the newest line waits: an instruction that's already out of date is
   worse than silence. */

/* what /api/coach gives back */
type CoachResponse = { sdp: string; sessionId: string };

export type Coach = {
  say(text: string, opts?: { urgent?: boolean }): void;
  /* stop for good; a finishing game lets its last line play out */
  stop(letFinish?: boolean): void;
  readonly failed: boolean;
};

const MUTE_KEY = "telekinesis.voice.muted";
/* off until someone turns it on: a session costs by the second */
export const loadMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) !== "0";
  } catch {
    return true;
  }
};
export const saveMuted = (muted: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private browsing; the toggle still works for this game */
  }
};

const ICE_WAIT_MS = 3000;
/* how long a finishing game's last line gets before the session closes */
const FINISH_MS = 6000;

function iceGathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => pc.iceGatheringState === "complete" && resolve();
    pc.addEventListener("icegatheringstatechange", done);
    /* some networks never report "complete"; the candidates so far are enough */
    setTimeout(resolve, ICE_WAIT_MS);
  });
}

export function createCoach(): Coach {
  const audio = new Audio();
  audio.autoplay = true;
  /* GPT-Live's clock runs on input audio, and lines are spoken as it
     advances; the coach only talks, so it sends a steady stream of
     silence. A destination with nothing playing into it sends no frames
     at all, hence the muted tone. */
  const ctx = new AudioContext();
  const out = ctx.createMediaStreamDestination();
  const hush = ctx.createGain();
  hush.gain.value = 0;
  const tone = ctx.createOscillator();
  tone.connect(hush).connect(out);
  tone.start();
  void ctx.resume().catch(() => {});
  const silence = out.stream;
  const pc = new RTCPeerConnection();
  const events = pc.createDataChannel("oai-events");
  let live = false;
  let failed = false;
  let stopped = false;
  let waiting: string | null = null;
  let last = "";
  let n = 0;

  const release = () => {
    events.close();
    pc.close();
    silence.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
    audio.srcObject = null;
  };
  const fail = (why: unknown) => {
    if (stopped || failed) return;
    console.warn("[coach]", why);
    failed = true;
    release();
  };
  const send = (text: string) => {
    last = text;
    events.send(
      JSON.stringify({
        type: "session.instructions.append",
        event_id: `line_${++n}`,
        delegation_id: null,
        /* said at once: a line held back is dropped when the next arrives */
        content: `Immediately say exactly this, and nothing else: ${text}`,
      }),
    );
  };

  pc.addEventListener("track", (e) => {
    audio.srcObject = new MediaStream([e.track]);
    void audio.play().catch(() => {});
  });
  pc.addEventListener("connectionstatechange", () => pc.connectionState === "failed" && fail("connection failed"));
  for (const t of silence.getAudioTracks()) pc.addTrack(t, silence);
  events.addEventListener("message", (e) => {
    const event = JSON.parse(e.data) as { type: string; error?: { message?: string }; reason?: string };
    if (event.type === "session.started") {
      live = true;
      if (waiting) send(waiting);
      waiting = null;
    } else if (event.type === "session.closed" && !stopped) fail(`session closed: ${event.reason}`);
    else if (event.type === "error") {
      console.warn("[coach]", event.error);
      if (!live) fail(event.error?.message);
    }
  });

  (async () => {
    await pc.setLocalDescription(await pc.createOffer());
    await iceGathered(pc);
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp: pc.localDescription!.sdp }),
    });
    if (!res.ok) throw new Error(`/api/coach: ${res.status} ${await res.text()}`);
    const { sdp } = (await res.json()) as CoachResponse;
    if (stopped) return release();
    await pc.setRemoteDescription({ type: "answer", sdp });
  })().catch(fail);

  return {
    get failed() {
      return failed;
    },
    say(text, opts) {
      if (stopped || failed || !text) return;
      if (text === last && !opts?.urgent) return;
      if (live) send(text);
      else waiting = text;
    },
    stop(letFinish) {
      if (stopped) return;
      stopped = true;
      if (!letFinish) audio.pause();
      setTimeout(
        () => {
          if (events.readyState === "open") events.send(JSON.stringify({ type: "session.close" }));
          /* a moment for the close to go out before tearing down */
          setTimeout(release, 300);
        },
        letFinish && live ? FINISH_MS : 0,
      );
    },
  };
}
