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
  { id: "smile-office", label: "Smiling · office", brief: "a warm, genuine smile; navy suit and white shirt, no tie; a bright modern office with softly blurred windows" },
  { id: "surprised-home", label: "Surprised · home office", brief: "a surprised expression (eyebrows raised, mouth slightly open, like they just saw an unexpected number); light blue button-down shirt, sleeves neat; a home office with bookshelves softly blurred" },
  { id: "concerned-boardroom", label: "Concerned · boardroom", brief: "a concerned, serious expression with a slight frown, as if delivering a warning; charcoal suit and tie; a calm conference room, softly blurred" },
  { id: "confident-outdoors", label: "Confident · outdoors", brief: "a confident, assured look with a small smile and arms crossed; a navy quarter-zip sweater over a collared shirt; outdoors on a terrace with golden-hour light and blurred greenery" },
  { id: "thoughtful-study", label: "Thoughtful · study", brief: "a thoughtful expression, hand lightly at the chin; a tweed or textured blazer with an open-collar shirt; a cozy study with a brass desk lamp, softly blurred" },
  { id: "pointing-studio", label: "Pointing · plain backdrop", brief: "an engaged, friendly expression, pointing to the side of the frame with one hand (towards empty space); crisp white shirt; a plain, softly lit studio backdrop in a muted color" },
  { id: "laughing-kitchen", label: "Laughing · kitchen", brief: "laughing naturally, relaxed; a casual sweater; a light, clean kitchen at home with morning light, softly blurred" },
  { id: "skeptical-dark", label: "Skeptical · dark backdrop", brief: "a skeptical look, one eyebrow slightly raised, lips pressed; dark suit and open-collar shirt; a plain dark charcoal backdrop with soft rim light" },
];

