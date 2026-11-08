// Mirrored by the tokens in src/app/globals.css; motion.test.ts fails when the two drift.
export const EASING = {
  drawer: [0.32, 0.72, 0, 1],
  expoOut: [0.16, 1, 0.3, 1],
  inOut: [0.77, 0, 0.175, 1],
  out: [0.23, 1, 0.32, 1],
} as const;

export const DURATION = {
  chart: 0,
  dropdown: 180,
  hoverDim: 120,
  modalClose: 200,
  modalOpen: 300,
  press: 120,
  tooltip: 150,
  ui: 150,
} as const;

export const SCALE = {
  enter: 0.95,
  press: 0.97,
} as const;
