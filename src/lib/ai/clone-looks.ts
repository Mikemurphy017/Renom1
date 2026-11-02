/**
 * The AI photo set: the advisor in the kinds of photos a financial advisor
 * actually uses for content (professional headshots, at work with clients,
 * measured on-camera expressions, a little lifestyle), made from their
 * headshots, for covers and posts. Each look is one image. Polished and
 * credible throughout: expressive where it helps a cover, never goofy.
 */
export type CloneGroup = "Headshots" | "At work" | "Expressions" | "Lifestyle";

export interface CloneLook {
  id: string;
  label: string;
  group: CloneGroup;
  brief: string;
}

export const CLONE_GROUPS: CloneGroup[] = ["Headshots", "At work", "Expressions", "Lifestyle"];

export const CLONE_LOOKS: CloneLook[] = [
  // ── Headshots: the core of the set, like a professional photo shoot ──
  { id: "studio-classic", label: "Classic studio", group: "Headshots", brief: "a classic professional headshot, a warm, confident closed-mouth smile, shoulders angled slightly; a tailored navy suit, white shirt and a subtle tie; a seamless medium-gray studio backdrop with soft, even lighting" },
  { id: "office-smile", label: "Office, smiling", group: "Headshots", brief: "a friendly, approachable professional headshot with a natural open smile; a charcoal suit and light blue shirt, no tie; a bright modern office with glass and wood, softly blurred" },
  { id: "confident", label: "Arms crossed", group: "Headshots", brief: "a confident executive portrait, arms loosely crossed, a calm, assured smile; a navy suit over a crisp white open-collar shirt; a modern office corridor with soft window light, softly blurred" },
  { id: "window-light", label: "Window light", group: "Headshots", brief: "an editorial portrait by a large window, soft natural side light, a thoughtful, warm expression; a gray blazer over a fine-knit sweater; a light, airy office, softly blurred" },
  { id: "dark-backdrop", label: "Dark backdrop", group: "Headshots", brief: "a premium portrait on a deep navy backdrop with a soft rim light, a composed, trustworthy half-smile; a charcoal suit and white shirt" },
  { id: "seated", label: "Seated", group: "Headshots", brief: "seated, leaning forward slightly with forearms on the knees, hands loosely together, a warm, engaged smile; a navy blazer and open-collar shirt; a tasteful office lounge, softly blurred" },
  { id: "outdoor-business", label: "Outdoors", group: "Headshots", brief: "an outdoor business portrait, a relaxed, confident smile; a tailored suit, no tie; modern office buildings and greenery behind, softly blurred in daylight" },
  { id: "skyline", label: "City skyline", group: "Headshots", brief: "standing with an assured, calm smile, hands in pockets; a tailored navy suit, no tie; floor-to-ceiling windows behind with a city skyline at dusk, softly blurred" },

  // ── At work: the advisor doing the job ──
  { id: "client-meeting", label: "With clients", group: "At work", brief: "sitting across a table from a couple in their sixties (shown from behind and softly blurred at the edge of the frame), listening attentively with a reassuring smile, a folder of documents on the table; business attire; a warm, modern office" },
  { id: "reviewing", label: "Reviewing a plan", group: "At work", brief: "at a desk reviewing printed financial documents with a pen in hand, looking up at the camera with a calm, focused expression; shirt and tie, sleeves neat; a tidy office with warm lighting" },
  { id: "laptop", label: "At the laptop", group: "At work", brief: "at a desk with a laptop open, turned toward the camera mid-conversation, a friendly professional expression; a light blue shirt and navy blazer; a bright home office with a bookshelf, softly blurred" },
  { id: "boardroom", label: "Boardroom", group: "At work", brief: "composed and trustworthy, a calm closed-mouth smile, hands resting together on a conference table; a charcoal suit and tie; a modern boardroom with large windows, softly blurred" },
  { id: "whiteboard", label: "Explaining", group: "At work", brief: "standing beside a whiteboard with a simple hand-drawn upward line and a few boxes (no readable words), holding a marker, turned toward the camera explaining with a friendly, confident expression; white shirt, sleeves rolled; a bright meeting room" },
  { id: "podium", label: "Speaking", group: "At work", brief: "speaking at a small professional seminar, one hand gesturing naturally, an engaged, confident expression; a dark suit; soft stage lighting and a blurred audience behind" },

  // ── Expressions: readable on a cover, still professional ──
  { id: "thinking", label: "Thoughtful", group: "Expressions", brief: "thoughtful, one hand lightly at the chin, eyes toward the camera with a considered expression, as if weighing a decision; a textured blazer and open-collar shirt; a study with bookshelves, softly blurred" },
  { id: "concerned", label: "Concerned", group: "Expressions", brief: "a serious, concerned expression, brows slightly drawn, looking straight at the camera as if flagging a costly mistake, measured and credible; a charcoal suit and tie; a calm office, softly blurred" },
  { id: "explaining", label: "Explaining", group: "Expressions", brief: "mid-explanation with both hands open in front of the chest, an engaged, friendly expression, eyebrows slightly raised; a navy suit, no tie; a plain, softly lit light-gray backdrop" },
  { id: "pointing", label: "Pointing aside", group: "Expressions", brief: "gesturing with an open hand toward the side of the frame (toward empty space where words will go), a confident, inviting smile; a white shirt and navy vest; a plain, softly lit studio backdrop" },
  { id: "reassuring", label: "Reassuring", group: "Expressions", brief: "a warm, reassuring smile with a slight nod, as if saying 'you're going to be fine'; a soft gray suit and light shirt; a bright office with plants, softly blurred" },
  { id: "eyebrow", label: "Here's the thing", group: "Expressions", brief: "a knowing look with one eyebrow subtly raised and a slight smile, as if about to share an insight, poised and professional; a dark suit and open collar; a plain dark charcoal backdrop with a soft rim light" },

  // ── Lifestyle: approachable, still polished ──
  { id: "walking", label: "City walk", group: "Lifestyle", brief: "walking toward the camera on a city sidewalk with a warm smile, a tailored overcoat over a suit; a downtown street, softly blurred with bokeh" },
  { id: "coffee", label: "Coffee meeting", group: "Lifestyle", brief: "at a café table with a coffee cup, smiling warmly toward the camera as if meeting a client; a smart-casual blazer and shirt; a bright, upscale café, softly blurred" },
  { id: "home-office", label: "Home office", group: "Lifestyle", brief: "leaning on the edge of a desk in a tasteful home office, a relaxed, approachable smile; a quarter-zip sweater over a collared shirt; bookshelves and warm morning light, softly blurred" },
  { id: "golf", label: "Golf course", group: "Lifestyle", brief: "a relaxed, genuine smile in a polo shirt, standing on a golf course with a club resting at the side; a sunny day, softly blurred greens" },
];
