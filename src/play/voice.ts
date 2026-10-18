/* A voice coach, spoken by Grok: it says each new instruction, any
   recording problem the moment it appears, and, in games where it
   helps, the count. Only one line plays at a time, and only the
   newest line waits: an instruction that's already out of date is
   worse than silence. Lines are cached, so a repeated "Now sit back
   down" plays at once. */

export type Coach = {
  say(text: string, opts?: { urgent?: boolean }): void;
  /* warm the cache for lines that are coming */
  prefetch(text: string): void;
  /* stop for good; a finishing game lets its last line play out */
  stop(letFinish?: boolean): void;
  readonly failed: boolean;
};

const MUTE_KEY = "telekinesis.voice.muted";
export const loadMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
};
export const saveMuted = (muted: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private browsing; the toggle still works for this game */
  }
};

const clips = new Map<string, Promise<string | null>>();

function clip(text: string): Promise<string | null> {
  let c = clips.get(text);
  if (!c) {
    c = fetch(`/api/voice?text=${encodeURIComponent(text)}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null);
    clips.set(text, c);
    /* a failure isn't kept, so the next try asks again */
    void c.then((u) => u === null && clips.delete(text));
  }
  return c;
}

export function createCoach(): Coach {
  const audio = new Audio();
  let playing: string | null = null;
  let waiting: string | null = null;
  let failures = 0;
  let stopped = false;

  const next = async () => {
    if (stopped || playing !== null || waiting === null) return;
    const text = waiting;
    waiting = null;
    playing = text;
    const url = await clip(text);
    /* a newer urgent line may have cut in while this one loaded */
    if (stopped || playing !== text) return;
    if (!url) {
      failures += 1;
      playing = null;
      return void next();
    }
    failures = 0;
    audio.src = url;
    audio.onended = audio.onerror = () => {
      playing = null;
      void next();
    };
    await audio.play().catch(() => {
      playing = null;
    });
  };

  return {
    get failed() {
      return failures >= 2;
    },
    say(text, opts) {
      if (stopped || !text || failures >= 2) return;
      if (text === playing && !opts?.urgent) return;
      waiting = text;
      if (opts?.urgent && playing !== null) {
        audio.pause();
        playing = null;
      }
      void next();
    },
    prefetch(text) {
      if (text && failures < 2) void clip(text);
    },
    stop(letFinish) {
      stopped = true;
      if (!letFinish) audio.pause();
    },
  };
}
