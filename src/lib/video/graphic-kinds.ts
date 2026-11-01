/** The motion graphics the edit can add (see local/graphics.ts). Shared by the browser and the renderer. */

export const GRAPHIC_KINDS = ["stat", "chart", "list", "compare", "timeline", "title", "quote", "callout"] as const;
export type GraphicKind = (typeof GRAPHIC_KINDS)[number];

export const GRAPHIC_LABELS: Record<GraphicKind, { label: string; hint: string }> = {
  stat: { label: "Numbers", hint: "A figure counts up on a panel" },
  chart: { label: "Charts", hint: "Bars grow to compare figures" },
  list: { label: "Checklists", hint: "Steps tick in one by one" },
  compare: { label: "This vs that", hint: "Two options side by side" },
  timeline: { label: "Timelines", hint: "Ages and dates along a line" },
  title: { label: "Section cards", hint: "A full-screen color wipe with the next point" },
  quote: { label: "Quote cards", hint: "The key line, big, on color" },
  callout: { label: "Icons", hint: "An icon pops beside the point" },
};

/** Graphics that cover the whole frame (cutaways); the rest sit over the video. */
export const FULL_SCREEN: GraphicKind[] = ["chart", "list", "compare", "timeline", "title", "quote"];

