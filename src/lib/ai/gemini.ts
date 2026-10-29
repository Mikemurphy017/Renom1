/**
 * Google Gemini image generation (server side only), for cover scenes: the
 * advisor's photo goes in with a scene brief, a new photo of them in that
 * scene comes out. Env: GEMINI_API_KEY (or GOOGLE_API_KEY); optional
 * GEMINI_IMAGE_MODEL and GEMINI_API_URL.
 */

import { CLONE_LOOKS, type CloneLook } from "./clone-looks";

const key = () => process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
const BASE = () => (process.env.GEMINI_API_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
const MODEL = () => process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

export const geminiConfigured = () => !!key();

export class GeminiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };

/** One image from reference photos (one or several of the same person) and a prompt. */
export async function editImage(o: { image?: Uint8Array; mimeType?: string; images?: { bytes: Uint8Array; mimeType: string }[]; prompt: string; aspect: "16:9" | "9:16" | "3:4" | "1:1" | "4:5" }): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const refs = o.images ?? (o.image ? [{ bytes: o.image, mimeType: o.mimeType ?? "image/jpeg" }] : []);
  if (!key()) throw new GeminiError("AI scenes aren’t set up for this studio yet.", 503);
  let res: Response;
  try {
    res = await fetch(`${BASE()}/models/${encodeURIComponent(MODEL())}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...refs.map((r) => ({ inline_data: { mime_type: r.mimeType, data: Buffer.from(r.bytes).toString("base64") } })), { text: o.prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: o.aspect } },
      }),
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[gemini] request failed:", (e as Error).message);
    throw new GeminiError("Couldn’t reach the image service. Try again in a moment.");
  }
  const j = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string; status?: string };
  } | null;
  if (!res.ok) {
    console.error(`[gemini] ${res.status}: ${JSON.stringify(j)?.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) throw new GeminiError("The studio’s Gemini key was refused. Your administrator can check it.");
    if (res.status === 429 && /free_tier|limit: 0|billing/i.test(j?.error?.message ?? "")) throw new GeminiError("AI scenes need billing turned on for the studio’s Gemini key (Google AI Studio → Billing). Your administrator can set it up.", 429);
    if (res.status === 429) throw new GeminiError("The image service is busy (or the studio hit its Gemini limit). Try again in a minute.", 429);
    throw new GeminiError(j?.error?.message?.slice(0, 200) || `The image service returned an error (${res.status}).`);
  }
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p.inlineData ?? (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : undefined);
    if (d?.data) return { bytes: new Uint8Array(Buffer.from(d.data, "base64")), mimeType: d.mimeType || "image/png" };
  }
  const why = j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason;
  console.error(`[gemini] no image: ${why ?? "unknown"} ${parts.map((p) => p.text).filter(Boolean).join(" ").slice(0, 300)}`);
  throw new GeminiError(why && /SAFETY|PROHIBITED|BLOCK/i.test(why) ? "The image service declined this one. Try another setting or photo." : "The image service didn’t return a picture. Try again.");
}

/** Where the main person's face is in a photo (brow to chin; centre and size, 0–1), by Gemini. Null when it can't tell. */
export async function locateFace(image: Uint8Array, mimeType: string): Promise<{ x: number; y: number; w: number; h: number } | null> {
  if (!key()) return null;
  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash";
  try {
    const res = await fetch(`${BASE()}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: Buffer.from(image).toString("base64") } },
              { text: 'Find the face of the main person in this photo (from the eyebrows to the chin, ear to ear). Reply with JSON only: {"box_2d": [ymin, xmin, ymax, xmax]} with coordinates from 0 to 1000. If there is no face, reply {"box_2d": null}.' },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const j = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    if (!res.ok) {
      console.error(`[gemini] face ${res.status}: ${JSON.stringify(j)?.slice(0, 300)}`);
      return null;
    }
    const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as { box_2d?: number[] | null } | { box_2d?: number[] }[];
    const box = Array.isArray(parsed) ? parsed[0]?.box_2d : parsed.box_2d;
    if (!Array.isArray(box) || box.length !== 4 || box.some((v) => typeof v !== "number")) return null;
    const [y0, x0, y1, x1] = box.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return null;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  } catch (e) {
    console.error("[gemini] face:", (e as Error).message);
    return null;
  }
}

/** Where we asked the image model to put the person, for when the face can't be found. */
export const placedFace = (shape: "long" | "short", side: "left" | "right") =>
  shape === "short" ? { x: 0.5, y: 0.62, w: 0.22, h: 0.13 } : { x: side === "left" ? 0.72 : 0.28, y: 0.42, w: 0.14, h: 0.25 };

/** Settings advisors can pick for a scene. */
export const SETTINGS: Record<string, string> = {
  home: "a warm home office with full bookshelves behind them and a window with soft daylight",
  office: "a bright modern office with floor-to-ceiling windows and a softly blurred city view",
  study: "a cozy study with a brass desk lamp, a leafy plant and shelves of books",
  kitchen: "a clean, light kitchen table at home with morning light",
  outdoors: "outdoors on a terrace with soft golden-hour light and blurred greenery",
  boardroom: "a calm conference room with a long table and large windows",
};

/** The brief for one scene. Text goes on later in the app, so the picture has none. */
export function scenePrompt(o: { title: string; topic?: string; setting: string; extra?: string; shape: "long" | "short"; side: "left" | "right" }) {
  const where = SETTINGS[o.setting] ?? SETTINGS.home;
  const room = o.shape === "short" ? "the top 40% of the frame" : `the ${o.side === "left" ? "left" : "right"} half of the frame`;
  const place = o.shape === "short" ? "in the lower half of the frame, chest-up, centered" : `on the ${o.side === "left" ? "right" : "left"} side of the frame, chest-up`;
  return [
    "Create a photorealistic YouTube thumbnail photo of the person in the reference photo.",
    "Keep their identity exactly: same face, facial features, age, skin tone, hair and facial hair. Do not beautify, slim, de-age or change them. Similar clothing is fine.",
    `Setting: ${where}.`,
    "Framing: the whole head must be in frame with clear space above the top of the hair (at least 12% of the image height). Never crop the top of the head or the chin.",
    `Place the person ${place}, looking into the camera with a big, readable expression that fits the topic, YouTube-thumbnail style (surprised, worried, excited or skeptical; exaggerated enough to read at phone size, but still a real photo, never cartoonish).`,
    `Video topic: "${o.title.slice(0, 160)}".${o.topic ? ` What it covers: ${o.topic.slice(0, 500)}` : ""}`,
    "Include one simple prop that illustrates the topic, for example a tablet or computer monitor showing a clean line or bar chart (at most two short labels on the chart), or a relevant everyday object.",
    o.extra ? `Also: ${o.extra.slice(0, 200)}.` : "",
    `Keep ${room} uncluttered and slightly darker or plainer, because a big headline will be added there later.`,
    "Professional, high-end look: shallow depth of field, soft key light on the face, natural color, crisp detail.",
    "Do not add any text, letters, captions, logos, watermarks or borders anywhere in the image (other than the tiny chart labels).",
  ]
    .filter(Boolean)
    .join("\n");
}

export { CLONE_LOOKS };

export function clonePrompt(look: CloneLook, count: number) {
  return [
    `Create a new photorealistic portrait photo of the person in the reference photo${count > 1 ? "s (all of the same person)" : ""}.`,
    "Keep their identity exactly: same face, facial features, face shape, age, skin tone, eye color, hair (color, length, hairline) and any facial hair or glasses. Do not beautify, slim, de-age, or change their weight or ethnicity.",
    `Expression, outfit and setting: ${look.brief}.`,
    look.group === "Reactions" || look.group === "Gestures & props"
      ? "The expression should be big and readable at phone size, like a creator's YouTube thumbnail, while still looking like a real photo of this person."
      : "Keep it natural and credible: a real, polished photo of this person, the kind used on a professional profile or magazine feature.",
    "Any props, charts, screens or whiteboards show no readable words or numbers.",
    "Framing: chest-up, the person centered and facing the camera, the whole head in frame with clear space above the hair (at least 12% of the image height). Never crop the top of the head or the chin.",
    "Keep the background simple and softly out of focus so the person stands out; a headline will be placed beside or above them later.",
    "Professional photo-shoot look: soft key light on the face, natural color, crisp detail, shallow depth of field.",
    "Do not add any text, letters, logos, watermarks or borders.",
  ].join("\n");
}

/** Ready-made settings for post photos, like a professional editorial shoot. */
export const POST_SCENES = [
  { id: "boardroom", label: "Presenting to clients", brief: "standing at the head of a modern glass-walled boardroom, presenting to four or five attentive clients seated around the table, gesturing toward a large wall screen showing a simple bar chart; the clients are softly out of focus in the foreground" },
  { id: "couple", label: "With a couple at home", brief: "sitting at a bright kitchen table with a retired couple, reviewing a plan on a tablet together, warm and reassuring" },
  { id: "desk", label: "At the desk", brief: "at a tidy desk in a bright modern office, on a video call with a laptop open, smiling, natural light from a large window" },
  { id: "stage", label: "Speaking on stage", brief: "speaking on stage at a small professional seminar with a microphone, an audience in the foreground softly out of focus, a large screen behind" },
  { id: "coffee", label: "Coffee with a client", brief: "having coffee with a client at a modern café table, listening attentively, relaxed and friendly" },
  { id: "city", label: "Walking in the city", brief: "walking confidently along a modern city street with glass office buildings, in business attire, candid documentary style" },
  { id: "whiteboard", label: "At the whiteboard", brief: "explaining an idea at a whiteboard covered in simple arrows and boxes to two colleagues in a bright meeting room" },
  { id: "handshake", label: "Welcoming a client", brief: "shaking hands with a new client in a modern office reception area, both smiling, warm professional moment" },
] as const;

/** A photo of the advisor in a scene, for a text-and-image post, like an editorial or stock photo shoot. */
export function postPhotoPrompt(scene: string, count: number) {
  return [
    `Create a new photorealistic photo featuring the person in the reference photo${count > 1 ? "s (all of the same person)" : ""} as the main subject.`,
    "Keep their identity exactly: same face, facial features, face shape, age, skin tone, eye color, hair (color, length, hairline) and any facial hair or glasses. Do not beautify, slim, de-age, or change their weight or ethnicity.",
    `The scene: the person is ${scene}.`,
    "Dress them in polished business attire that suits the scene. Any other people are clearly different people, and are secondary to the main subject.",
    "It should look like a high-end editorial or corporate photo shoot: natural light, true-to-life color, shallow depth of field, a real moment rather than a posed headshot. The person's face is clearly visible and in focus.",
    "Any screens, charts, papers, whiteboards or signs show no readable words, numbers or logos.",
    "Do not add any text, letters, logos, watermarks or borders.",
  ].join("\n");
}
