import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { claudeConfigured } from "@/lib/ai/claude";
import { bufferConfigured } from "@/lib/buffer/server";
import { emailProvider } from "@/lib/email";
import { objects } from "@/lib/storage/objects";
import { stockFootageEnabled } from "@/lib/video/local/broll";
import { currentUser, isAdmin, type User } from "./server";

/** The signed-in admin, or a ready-made 401/403 response for everyone else. */
export async function requireAdmin(request: Request): Promise<{ admin: User; denied?: never } | { admin?: never; denied: Response }> {
  const user = await currentUser(request);
  if (!user) return { denied: NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 }) };
  if (!isAdmin(user)) return { denied: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  return { admin: user };
}

export function serviceStatus() {
  const asrDir = process.env.ASR_MODEL_DIR || path.join(process.cwd(), ".models", "asr-gigaspeech");
  const provider = emailProvider();
  return [
    { id: "storage", label: "Storage", ok: objects().kind === "bucket", detail: objects().kind === "bucket" ? "Storage bucket" : "Local disk (lost on redeploy)" },
    { id: "claude", label: "Claude (scripts, captions)", ok: claudeConfigured(), detail: claudeConfigured() ? "Connected" : "ANTHROPIC_API_KEY not set" },
    { id: "buffer", label: "Buffer", ok: bufferConfigured(), detail: bufferConfigured() ? "Connected" : "BUFFER_API_KEY not set" },
    { id: "email", label: "Email (password resets)", ok: !!provider, detail: provider === "resend" ? "Resend" : provider === "smtp" ? "SMTP" : "Not set: resets need a link from here" },
    { id: "asr", label: "Speech recognition", ok: existsSync(asrDir), detail: existsSync(asrDir) ? "Model installed" : "Model missing: captions follow the script" },
    { id: "pexels", label: "Stock b-roll", ok: stockFootageEnabled(), detail: stockFootageEnabled() ? "Pexels" : "Advisor library only" },
  ];
}
