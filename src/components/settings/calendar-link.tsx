"use client";

import * as React from "react";
import { CalendarDays, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { bookingCta, normalizeUrl } from "@/lib/booking";

/** Settings → Calendar link: the booking page that goes into captions and end cards. */
export function CalendarLink() {
  const { profile, updateProfile } = useStore();
  const [value, setValue] = React.useState(profile.calendarUrl ?? "");
  const saved = profile.calendarUrl ?? "";
  React.useEffect(() => setValue(profile.calendarUrl ?? ""), [profile.calendarUrl]);
  const dirty = value.trim() !== saved;

  const save = () => {
    if (!value.trim()) {
      updateProfile({ calendarUrl: undefined });
      toast.success("Calendar link removed");
      return;
    }
    const url = normalizeUrl(value);
    if (!url) {
      toast.error("That doesn’t look like a link", { description: "Paste the address of your booking page, like calendly.com/your-name." });
      return;
    }
    updateProfile({ calendarUrl: url });
    setValue(url);
    toast.success("Calendar link saved", { description: "New videos add it to the caption and end card." });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brass-soft text-primary"><CalendarDays className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <label htmlFor="calendar-url" className="text-[15px] font-medium">Your booking link</label>
          <p className="mt-1 text-[13px] text-muted-foreground">Calendly, Google Calendar, Microsoft Bookings, HubSpot, or any page where someone can book a call with you.</p>
        </div>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input id="calendar-url" value={value} onChange={(e) => setValue(e.target.value)} placeholder="calendly.com/your-name/intro" inputMode="url" autoComplete="url" className="h-10" />
        <Button type="submit" className="h-10 rounded-full px-5" disabled={!dirty}>
          {!dirty && saved ? <><Check /> Saved</> : "Save"}
        </Button>
      </form>
      {saved && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-[12px] text-muted-foreground">
          <span>On screen: <span className="font-medium text-foreground">{bookingCta(saved)}</span></span>
          <a href={saved} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Test the link <ExternalLink className="size-3" /></a>
        </div>
      )}
    </div>
  );
}
