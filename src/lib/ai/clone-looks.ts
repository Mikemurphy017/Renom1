/**
 * The AI photo set: the advisor in a range of expressions, outfits and
 * settings, made from their headshots, for covers. Each look is one image.
 */
export type CloneGroup = "Reactions" | "Gestures & props" | "Professional" | "Lifestyle";

export interface CloneLook {
  id: string;
  label: string;
  group: CloneGroup;
  brief: string;
}

export const CLONE_GROUPS: CloneGroup[] = ["Reactions", "Gestures & props", "Professional", "Lifestyle"];

export const CLONE_LOOKS: CloneLook[] = [
  // ── Reactions: big, readable faces for creator-style covers ──
  { id: "shocked", label: "Shocked", group: "Reactions", brief: "genuinely shocked, eyes wide and mouth open, one hand raised to the cheek, a big readable reaction for a YouTube thumbnail; navy suit and white shirt, no tie; a bright modern office, softly blurred" },
  { id: "excited", label: "Excited", group: "Reactions", brief: "excited and delighted, a huge open smile, eyebrows up, leaning slightly toward the camera; light blue button-down shirt; a home office with bookshelves, softly blurred" },
  { id: "worried", label: "Worried", group: "Reactions", brief: "worried and concerned, brows pulled together, grimacing slightly, as if warning the viewer about a costly mistake; charcoal suit and tie; a calm conference room, softly blurred" },
  { id: "skeptical", label: "Skeptical", group: "Reactions", brief: "skeptical, one eyebrow raised high, lips pressed, a 'really?' look straight into the camera; dark suit and open-collar shirt; a plain dark charcoal backdrop with a soft rim light" },
  { id: "facepalm", label: "Facepalm", group: "Reactions", brief: "a playful facepalm, one hand on the forehead, eyes still visible and looking at the camera, an 'oh no' expression; a navy quarter-zip sweater over a collared shirt; outdoors with golden-hour light and blurred greenery" },
  { id: "mind-blown", label: "Mind blown", group: "Reactions", brief: "a 'mind blown' reaction, both hands near the temples spreading outward, mouth open in amazement, eyes on the camera; a charcoal crewneck sweater; a plain, softly lit studio backdrop in deep blue" },

  // ── Gestures & props: point at the words, hold up the idea ──
  { id: "pointing", label: "Pointing", group: "Gestures & props", brief: "confident and energetic, pointing to the side of the frame with one arm extended (towards empty space where words will go), an engaged smile; crisp white shirt, sleeves rolled; a plain, softly lit studio backdrop" },
  { id: "pointing-up", label: "Pointing up", group: "Gestures & props", brief: "pointing straight up above their head with one finger, an 'look at this' expression with raised eyebrows, mouth slightly open; navy blazer over a white T-shirt; a plain light gray studio backdrop" },
  { id: "thumbs-up", label: "Thumbs up", group: "Gestures & props", brief: "a big genuine smile and a thumbs up toward the camera; light gray suit, open collar; a bright modern office with plants, softly blurred" },
  { id: "stop-hand", label: "Stop sign", group: "Gestures & props", brief: "holding one palm out toward the camera like a 'stop, don't do this' sign, a serious warning expression; navy suit and tie; a plain dark backdrop with soft rim light" },
  { id: "tablet-chart", label: "With a chart", group: "Gestures & props", brief: "holding up a tablet facing the camera that shows a simple clean rising line chart (no readable numbers or words), looking at the camera with an impressed smile; a light blue shirt and navy vest; a home office, softly blurred" },
  { id: "calculator", label: "With a calculator", group: "Gestures & props", brief: "holding a calculator up beside their face, a concentrated, slightly surprised look as if they just ran the numbers; rolled-up sleeves on a white shirt; a desk with papers in a warm study, softly blurred" },

  // ── Professional: credible and calm, for more formal topics ──
  { id: "confident", label: "Confident", group: "Professional", brief: "confident and warm, arms crossed, a knowing half-smile straight into the camera; a casual sweater; a light, clean kitchen at home with morning light, softly blurred" },
  { id: "thinking", label: "Thinking", group: "Professional", brief: "thinking hard, hand at the chin, eyes looking up and to the side, slightly squinting; a textured blazer with an open-collar shirt; a cozy study with a brass desk lamp, softly blurred" },
  { id: "boardroom", label: "Boardroom", group: "Professional", brief: "composed and trustworthy, a calm closed-mouth smile, hands resting together on a conference table; charcoal suit and tie; a modern boardroom with large windows, softly blurred" },
  { id: "skyline", label: "City skyline", group: "Professional", brief: "standing with a relaxed, assured smile, hands in pockets; a tailored navy suit, no tie; floor-to-ceiling windows behind them with a city skyline at dusk, softly blurred" },
  { id: "whiteboard", label: "Whiteboard", group: "Professional", brief: "turned toward the camera beside a whiteboard with a simple hand-drawn upward arrow and a few boxes (no readable words), holding a marker, explaining with a friendly expression; white shirt, sleeves rolled; a bright office" },
  { id: "podium", label: "On stage", group: "Professional", brief: "speaking on a stage at a small conference, one hand gesturing, an engaged confident expression; dark suit; stage lights and a blurred audience behind" },

  // ── Lifestyle: approachable and human ──
  { id: "coffee", label: "Coffee shop", group: "Lifestyle", brief: "relaxed and friendly, laughing lightly, holding a coffee cup; a casual button-down shirt; a bright coffee shop with warm light, softly blurred" },
  { id: "laughing", label: "Laughing", group: "Lifestyle", brief: "laughing genuinely, head tilted back slightly, eyes still toward the camera; a casual quarter-zip; a sunny living room with a sofa, softly blurred" },
  { id: "golf", label: "Golf course", group: "Lifestyle", brief: "smiling in golf attire (polo shirt), holding a golf club over the shoulder; a green golf course on a sunny day, softly blurred" },
  { id: "marina", label: "Marina", group: "Lifestyle", brief: "relaxed and happy, sunglasses pushed up on the head, a linen shirt; a marina with sailboats at golden hour, softly blurred" },
  { id: "walking", label: "City walk", group: "Lifestyle", brief: "walking toward the camera on a city sidewalk with a warm smile, a light overcoat over a sweater; a downtown street, softly blurred with bokeh" },
  { id: "family-kitchen", label: "At home", group: "Lifestyle", brief: "leaning on a kitchen island at home with a warm, approachable smile, a mug nearby; a casual sweater; a bright modern kitchen with morning light, softly blurred" },
];
