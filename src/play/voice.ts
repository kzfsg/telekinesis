/* A voice coach: it says each new instruction and any recording
   problem the moment it appears. It speaks through Grok Voice, and if
   Grok can't be reached or drops out, through GPT-Live instead. Both
   sessions are started by a Vercel function so the keys stay on the
   server. Until a session is up only the newest line waits: an
   instruction that's already out of date is worse than silence. */

/* what /api/grok gives back */
type GrokResponse = { token: string; model: string; voice: string; instructions: string };
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

/* Grok first; on any failure, GPT-Live picks up with the newest line */
export function createCoach(): Coach {
  let latest: string | null = null;
  let fellBack = false;
  let current: Coach = createGrokCoach(() => {
    if (fellBack) return;
    fellBack = true;
    current = createLiveCoach();
    if (latest) current.say(latest);
  });
  return {
    get failed() {
      return current.failed;
    },
    say(text, opts) {
      latest = text;
      current.say(text, opts);
    },
    stop(letFinish) {
      current.stop(letFinish);
    },
  };
}

/* Grok Voice speaks 24 kHz mono PCM16, base64 in JSON events */
const GROK_RATE = 24000;
/* how long Grok gets to start before GPT-Live takes over */
const GROK_START_MS = 8000;

function createGrokCoach(onFail: () => void): Coach {
  const ctx = new AudioContext({ sampleRate: GROK_RATE });
  void ctx.resume().catch(() => {});
  const playing = new Set<AudioBufferSourceNode>();
  let ws: WebSocket | null = null;
  let live = false;
  let failed = false;
  let stopped = false;
  let waiting: string | null = null;
  let last = "";
  /* a reply in progress, and the one whose audio is wanted */
  let speaking = false;
  let current: string | null = null;
  let playhead = 0;

  const hush = () => {
    for (const s of playing) s.stop();
    playing.clear();
    playhead = 0;
  };
  const release = () => {
    clearTimeout(startTimer);
    ws?.close();
    hush();
    void ctx.close().catch(() => {});
  };
  const fail = (why: unknown) => {
    if (stopped || failed) return;
    console.warn("[coach] grok:", why);
    failed = true;
    release();
    onFail();
  };
  const startTimer = setTimeout(() => !live && fail("took too long to start"), GROK_START_MS);
  const send = (text: string) => {
    last = text;
    /* a newer line cuts off the one being said */
    if (speaking) {
      ws!.send(JSON.stringify({ type: "response.cancel" }));
      hush();
    }
    current = null;
    ws!.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: `Say exactly this, and nothing else: ${text}` }] },
      }),
    );
    ws!.send(JSON.stringify({ type: "response.create" }));
    speaking = true;
  };
  const play = (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    if (!pcm.length) return;
    const buf = ctx.createBuffer(1, pcm.length, GROK_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    playhead = Math.max(playhead, ctx.currentTime);
    src.start(playhead);
    playhead += buf.duration;
    playing.add(src);
    src.onended = () => playing.delete(src);
  };

  (async () => {
    const res = await fetch("/api/grok", { method: "POST" });
    if (!res.ok) throw new Error(`/api/grok: ${res.status} ${await res.text()}`);
    const session = (await res.json()) as GrokResponse;
    if (stopped) return release();
    const socket = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(session.model)}`, [
      `xai-client-secret.${session.token}`,
    ]);
    ws = socket;
    socket.addEventListener("open", () =>
      socket.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: session.voice,
            instructions: session.instructions,
            /* it only talks: no listening for turns */
            turn_detection: { type: null },
            audio: { output: { format: { type: "audio/pcm", rate: GROK_RATE } } },
          },
        }),
      ),
    );
    socket.addEventListener("message", (e) => {
      const event = JSON.parse(e.data) as {
        type: string;
        delta?: string;
        response_id?: string;
        response?: { id: string };
        error?: { message?: string };
      };
      if (event.type === "session.updated" && !live) {
        live = true;
        clearTimeout(startTimer);
        if (waiting) send(waiting);
        waiting = null;
      } else if (event.type === "response.created") current = event.response?.id ?? null;
      else if (event.type === "response.output_audio.delta" && event.delta) {
        /* a cancelled reply's last few chunks can still arrive */
        if (current !== null && (event.response_id ?? current) === current) play(event.delta);
      } else if (event.type === "response.done") speaking = false;
      else if (event.type === "error") {
        console.warn("[coach] grok:", event.error);
        if (!live) fail(event.error?.message);
      }
    });
    socket.addEventListener("close", (e) => fail(`socket closed: ${e.code} ${e.reason}`));
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
      if (!letFinish) hush();
      setTimeout(release, letFinish && live ? FINISH_MS : 0);
    },
  };
}

function createLiveCoach(): Coach {
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
