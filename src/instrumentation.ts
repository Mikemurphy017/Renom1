/**
 * Server start-up: checks every hour for advisors whose record day it is and
 * sends their reminder (in-app notice, plus email when set up). Each reminder
 * goes once per record day, so restarts and extra checks are harmless.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RECORD_DAY_REMINDERS === "off") return;
  const { runRecordDayReminders } = await import("@/lib/notify/server");
  const tick = () => void runRecordDayReminders().catch((e) => console.warn("[notify] reminders failed:", (e as Error).message));
  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60_000).unref?.();
}
