import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame, PoseSource } from "./pose";

/* The real participant: the webcam, read by MediaPipe Pose running in
   the browser. The video goes into the model and onto the screen,
   and nowhere else; only the landmarks it returns reach the games.

   The runtime and the model come from public CDNs on first use and
   are cached by the browser after that. The runtime's version is
   pinned to the package's, so the two never disagree. */

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

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
export async function loadTracker() {
  const files = await FilesetResolver.forVisionTasks(WASM);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO" as const,
    numPoses: 1,
  });
  /* the GPU where there is one; some machines refuse it, so the CPU after */
  try {
    return await PoseLandmarker.createFromOptions(files, options("GPU"));
  } catch {
    return await PoseLandmarker.createFromOptions(files, options("CPU"));
  }
}

export type Stage = "asking" | "tracker";

export async function openCamera(onStage: (stage: Stage) => void = () => {}): Promise<PoseSource> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraFailure("unsupported", "This browser can't use a camera. Try Chrome, Edge or Safari.");
  }
  /* the tracker is large and the first download slow, so it starts
     loading now, while the participant is still answering the
     browser's camera prompt, rather than after */
  const tracker = loadTracker();
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
  let model: PoseLandmarker;
  try {
    model = await tracker;
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new CameraFailure("model", "The body tracker couldn't load. Check the connection and try again.");
  }

  let lastVideoTime = -1;
  let last: PoseFrame | null = null;
  return {
    video,
    read(now: number) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return last;
      lastVideoTime = video.currentTime;
      const result = model.detectForVideo(video, now);
      last = {
        t: now,
        landmarks: result.landmarks[0] ?? null,
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
