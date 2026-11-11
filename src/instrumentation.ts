/**
 * Server start-up. Two background checks, both safe to run again after a
 * restart:
 *  - every hour, advisors whose record day it is get their reminder (in-app
 *    notice, plus email when set up), once per record day;
 *  - every ten minutes, cinematic videos nobody has open are moved along (the
 *    still fetched, the video submitted or collected).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { advanceAll } = await import("@/lib/cinematic/server");
  const films = () => void advanceAll().catch((e) => console.warn("[cinematic] tick failed:", (e as Error).message));
  setTimeout(films, 90_000);
  setInterval(films, 10 * 60_000).unref?.();

  if (process.env.RECORD_DAY_REMINDERS === "off") return;
  const { runRecordDayReminders } = await import("@/lib/notify/server");
  const tick = () => void runRecordDayReminders().catch((e) => console.warn("[notify] reminders failed:", (e as Error).message));
  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60_000).unref?.();
}
