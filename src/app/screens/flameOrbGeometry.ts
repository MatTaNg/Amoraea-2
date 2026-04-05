/** Shared with web (`FlameOrb.tsx`) and native (`FlameOrbNative.tsx`). */

export const FLAME_VIEWBOX_W = 280;
export const FLAME_VIEWBOX_H = 300;

export const FLAME_PATH = `
  M 140 12
  C 175 50,  240 90,  248 140
  C 255 180, 245 220, 220 248
  C 200 268, 175 280, 140 282
  C 105 280,  80 268,  60 248
  C  35 220,  25 180,  32 140
  C  40  90, 105  50, 140  12
  Z
`;

export const INNER_FLAME_PATH = `
  M 140 55
  C 165 80,  200 112, 205 152
  C 210 186, 198 216, 180 236
  C 165 252, 152 260, 140 262
  C 128 260, 115 252, 100 236
  C  82 216,  70 186,  75 152
  C  80 112, 115  80, 140  55
  Z
`;

/** Matches `CONFIG` scale in `FlameOrb.tsx` (CSS transform on SVG). */
export const FLAME_STATE_SCALE = {
  idle: 1,
  speaking: 1.35,
  listening: 0.88,
  processing: 1.05,
} as const;
