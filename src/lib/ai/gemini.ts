/**
 * Google Gemini image generation (server side only), for cover scenes: the
 * advisor's photo goes in with a scene brief, a new photo of them in that
 * scene comes out. Env: GEMINI_API_KEY (or GOOGLE_API_KEY); optional
 * GEMINI_IMAGE_MODEL and GEMINI_API_URL.
 */

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

/** One image from a reference photo and a prompt. */
export async function editImage(o: { image: Uint8Array; mimeType: string; prompt: string; aspect: "16:9" | "9:16" }): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (!key()) throw new GeminiError("AI scenes aren’t set up for this studio yet.", 503);
  let res: Response;
  try {
    res = await fetch(`${BASE()}/models/${encodeURIComponent(MODEL())}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: o.mimeType, data: Buffer.from(o.image).toString("base64") } }, { text: o.prompt }] }],
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
    `Place the person ${place}, looking into the camera with an expression that fits the topic (thoughtful, concerned or confident; never cartoonish).`,
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
