"use client";

import * as React from "react";
import { UsersRound } from "lucide-react";

type Account = { name: string; service: string; avatar: string };

const SERVICE: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", twitter: "X", threads: "Threads", pinterest: "Pinterest" };

/** Advisors don't connect anything: the team posts for them. Shows which of their accounts the team posts to. */
export function PublishingSection() {
  const [accounts, setAccounts] = React.useState<Account[] | null>(null);
  React.useEffect(() => {
    fetch("/api/posting/accounts", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setAccounts(j.ok ? j.accounts : []))
      .catch(() => setAccounts([]));
  }, []);
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brass-soft text-primary"><UsersRound className="size-5" /></span>
        <div>
          <div className="text-[15px] font-medium">Our team posts for you</div>
          <p className="mt-1 text-[13px] text-muted-foreground">When a video is ready, choose “Have our team post it” in the Post step. You can always download the MP4 and post it yourself instead.</p>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <div className="mb-2 text-[13px] font-medium">Accounts we post to</div>
        {accounts === null ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">None set up yet. Tell your administrator which accounts you’d like us to post to.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <li key={`${a.service}-${a.name}`} className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-[13px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.avatar ? <img src={a.avatar} alt="" className="size-6 rounded-full" /> : <span className="size-6 rounded-full bg-muted" />}
                {a.name} <span className="text-muted-foreground">· {SERVICE[a.service] ?? a.service}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
