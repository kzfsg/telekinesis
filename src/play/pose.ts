/* What every game reads: one camera frame's worth of body, as
   MediaPipe Pose reports it. Coordinates are normalised to the
   video, 0..1 across and down, in the camera's own (unmirrored) view,
   so the participant's left side appears on the image's right. */

export type Point = { x: number; y: number; z?: number; visibility?: number };

export type PoseFrame = {
  /* milliseconds, from performance.now() */
  t: number;
  /* the 33 MediaPipe Pose landmarks, or null when nobody is found */
  landmarks: Point[] | null;
  /* the 21 MediaPipe Hand landmarks, for the games that watch a hand
     instead of a body; absent or null when no hand is found */
  hand?: Point[] | null;
  /* the video's width over its height, to measure distances in
     square units rather than stretched ones */
  aspect: number;
};

/* the landmarks the games use, by MediaPipe Pose index */
export const J = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/* the bones drawn in the thermal view */
export const BONES: [number, number][] = [
  [J.leftShoulder, J.rightShoulder],
  [J.leftShoulder, J.leftElbow],
  [J.leftElbow, J.leftWrist],
  [J.rightShoulder, J.rightElbow],
  [J.rightElbow, J.rightWrist],
  [J.leftShoulder, J.leftHip],
  [J.rightShoulder, J.rightHip],
  [J.leftHip, J.rightHip],
  [J.leftHip, J.leftKnee],
  [J.leftKnee, J.leftAnkle],
  [J.rightHip, J.rightKnee],
  [J.rightKnee, J.rightAnkle],
];

/* the joints that glow in the thermal view */
export const GLOW_JOINTS = [
  J.nose,
  J.leftShoulder,
  J.rightShoulder,
  J.leftElbow,
  J.rightElbow,
  J.leftWrist,
  J.rightWrist,
  J.leftHip,
  J.rightHip,
  J.leftKnee,
  J.rightKnee,
  J.leftAnkle,
  J.rightAnkle,
];

/* the hand landmarks the games use, by MediaPipe Hand index */
export const H = {
  wrist: 0,
  thumbTip: 4,
  indexMcp: 5,
  indexTip: 8,
  middleMcp: 9,
  pinkyMcp: 17,
} as const;

/* the hand's bones, knuckle to knuckle, as MediaPipe connects them */
export const HAND_BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/* the fingertips and wrist, which glow in the thermal view */
export const HAND_GLOW = [0, 4, 8, 12, 16, 20];

/* anything that hands the games frames: the camera, or the
   simulated participant used for demos and tests */
export interface PoseSource {
  /* the next frame, or null if none is ready yet */
  read(now: number): PoseFrame | null;
  /* the video to draw behind the heat, if there is one */
  readonly video: HTMLVideoElement | null;
  stop(): void;
}
