/**
 * The AI photo set: the advisor in a range of expressions, outfits and
 * settings, made from their headshots, for covers. Each look is one image.
 */
export interface CloneLook {
  id: string;
  label: string;
  brief: string;
}

export const CLONE_LOOKS: CloneLook[] = [
  { id: "shocked", label: "Shocked", brief: "genuinely shocked, eyes wide and mouth open, one hand raised to the cheek, a big readable reaction for a YouTube thumbnail; navy suit and white shirt, no tie; a bright modern office, softly blurred" },
  { id: "excited", label: "Excited", brief: "excited and delighted, a huge open smile, eyebrows up, leaning slightly toward the camera; light blue button-down shirt; a home office with bookshelves, softly blurred" },
  { id: "worried", label: "Worried", brief: "worried and concerned, brows pulled together, grimacing slightly, as if warning the viewer about a costly mistake; charcoal suit and tie; a calm conference room, softly blurred" },
  { id: "pointing", label: "Pointing", brief: "confident and energetic, pointing to the side of the frame with one arm extended (towards empty space where words will go), an engaged smile; crisp white shirt, sleeves rolled; a plain, softly lit studio backdrop" },
  { id: "skeptical", label: "Skeptical", brief: "skeptical, one eyebrow raised high, lips pressed, a 'really?' look straight into the camera; dark suit and open-collar shirt; a plain dark charcoal backdrop with a soft rim light" },
  { id: "facepalm", label: "Facepalm", brief: "a playful facepalm, one hand on the forehead, eyes still visible and looking at the camera, an 'oh no' expression; a navy quarter-zip sweater over a collared shirt; outdoors with golden-hour light and blurred greenery" },
  { id: "thinking", label: "Thinking", brief: "thinking hard, hand at the chin, eyes looking up and to the side, slightly squinting; a textured blazer with an open-collar shirt; a cozy study with a brass desk lamp, softly blurred" },
  { id: "confident", label: "Confident", brief: "confident and warm, arms crossed, a knowing half-smile straight into the camera; a casual sweater; a light, clean kitchen at home with morning light, softly blurred" },
];

