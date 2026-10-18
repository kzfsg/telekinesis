import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame, PoseSource } from "./pose";

/* The real participant: the webcam, read by MediaPipe running in the
   browser: Pose for the games that watch the body, Hand for the one
   that watches the fingers. The video goes into the model and onto the screen,
   and nowhere else; only the landmarks it returns reach the games.

   The runtime and the model come from public CDNs on first use and
   are cached by the browser after that. The runtime's version is
   pinned to the package's, so the two never disagree. */

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODELS = {
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

export type Tracking = keyof typeof MODELS;

export type CameraError = "denied" | "missing" | "model" | "unsupported";

export class CameraFailure extends Error {
  kind: CameraError;
  constructor(kind: CameraError, message: string) {
    super(message);
    this.kind = kind;
  }
}

/* loads the tracker on its own, without a camera; exported so it can
   be checked in a browser where no camera may be turned on */
type Tracker = {
  /* the landmarks found in one video frame, as the games want them */
  read(video: HTMLVideoElement, now: number): Pick<PoseFrame, "landmarks" | "hand">;
  close(): void;
};

export async function loadTracker(tracking: Tracking = "pose"): Promise<Tracker> {
  const files = await FilesetResolver.forVisionTasks(WASM);
  const base = (delegate: "GPU" | "CPU") => ({ baseOptions: { modelAssetPath: MODELS[tracking], delegate }, runningMode: "VIDEO" as const });
  /* the GPU where there is one; some machines refuse it, so the CPU after */
  const either = async <T>(make: (delegate: "GPU" | "CPU") => Promise<T>) => {
    try {
      return await make("GPU");
    } catch {
      return await make("CPU");
    }
  };
  if (tracking === "hand") {
    const model = await either((d) => HandLandmarker.createFromOptions(files, { ...base(d), numHands: 1 }));
    return {
      read: (video, now) => ({ landmarks: null, hand: model.detectForVideo(video, now).landmarks[0] ?? null }),
      close: () => model.close(),
    };
  }
  const model = await either((d) => PoseLandmarker.createFromOptions(files, { ...base(d), numPoses: 1 }));
  return {
    read: (video, now) => ({ landmarks: model.detectForVideo(video, now).landmarks[0] ?? null }),
    close: () => model.close(),
  };
}

export type Stage = "asking" | "tracker";

export async function openCamera(tracking: Tracking, onStage: (stage: Stage) => void = () => {}): Promise<PoseSource> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraFailure("unsupported", "This browser can't use a camera. Try Chrome, Edge or Safari.");
  }
  /* the tracker is large and the first download slow, so it starts
     loading now, while the participant is still answering the
     browser's camera prompt, rather than after */
  const tracker = loadTracker(tracking);
  tracker.catch(() => {});
  onStage("asking");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraFailure("denied", "Camera access was turned down. Allow it in the address bar, then try again.");
    }
    throw new CameraFailure("missing", "No camera was found. Plug one in, or try the demo instead.");
  }

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  await video.play();

  onStage("tracker");
  let model: Tracker;
  try {
    model = await tracker;
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new CameraFailure("model", `The ${tracking === "hand" ? "hand" : "body"} tracker couldn't load. Check the connection and try again.`);
  }

  let lastVideoTime = -1;
  let last: PoseFrame | null = null;
  return {
    video,
    read(now: number) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return last;
      lastVideoTime = video.currentTime;
      last = {
        t: now,
        ...model.read(video, now),
        aspect: video.videoWidth / video.videoHeight || 16 / 9,
      };
      return last;
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      model.close();
    },
  };
}
