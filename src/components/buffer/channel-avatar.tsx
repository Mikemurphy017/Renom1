/* eslint-disable @next/next/no-img-element */
import { PlatformIcon } from "@/components/shared/platform-icon";
import { platformForService, type BufferChannel } from "@/lib/buffer/types";
import { cn } from "@/lib/utils";

export function ChannelAvatar({ channel, className }: { channel: BufferChannel; className?: string }) {
  const platform = platformForService(channel.service, "long");
  return (
    <span className={cn("relative inline-flex size-9 shrink-0", className)}>
      <img src={channel.avatar} alt="" className="size-full rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
      {platform && (
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-card bg-card text-foreground" style={{ ["--pi-bg" as string]: "var(--card)" }}>
          <PlatformIcon id={platform} className="size-3" />
        </span>
      )}
    </span>
  );
}

export const channelLabel = (c: BufferChannel) => c.displayName || c.name;
