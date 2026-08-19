/**
 * Fixed project accents. A project gets the next colour in this list when it is created,
 * and keeps it for good — it marks the project on the board and any of its todos that get
 * sent to the Todo tab.
 */
export const PROJECT_COLORS = [
  "#4f8ff7", // blue
  "#d9822b", // amber
  "#3fa66a", // green
  "#9a6ad6", // violet
  "#d1495b", // red
  "#2fa8ae", // teal
  "#c2185b", // magenta
  "#7a8b3f", // olive
];

export function nthProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}
