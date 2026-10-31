"use client";

import { UploadFinishedButton } from "@/components/layout/upload-finished";
import * as React from "react";
import { ArrowRight, Monitor, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStartVideo } from "./use-start-video";
import { useStartPost } from "@/components/posts/posts-list";
import type { VideoFormat } from "@/lib/types";
import { BRAND } from "@/lib/brand";

export function NewVideoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const start = useStartVideo();
  const startPost = useStartPost();
  const [topic, setTopic] = React.useState("");
  const [format, setFormat] = React.useState<VideoFormat>("short");

  const go = () => {
    onOpenChange(false);
    start(topic, format);
    setTopic("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">What do you want to talk about?</DialogTitle>
          <DialogDescription>A sentence is plenty. Or leave it blank and {BRAND.name} will suggest ideas.</DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          rows={3}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go();
            }
          }}
          placeholder="e.g. Why executives wait too long to sell company stock"
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 font-serif text-lg outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <div className="flex items-center justify-between gap-3">
          <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as VideoFormat)}>
            <ToggleGroupItem value="short"><Smartphone /> Short</ToggleGroupItem>
            <ToggleGroupItem value="long"><Monitor /> Long</ToggleGroupItem>
          </ToggleGroup>
          <Button className="rounded-full px-5" onClick={go}>
            Start <ArrowRight />
          </Button>
        </div>
        <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-[13px] text-muted-foreground">
          Already made a video?
          <UploadFinishedButton variant="ghost" className="h-7 rounded-full px-2 text-[13px] font-medium text-primary hover:text-primary" label="Upload it for editing" onPicked={() => onOpenChange(false)} />
        </div>
        <div className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          Not filming today?
          <button type="button" className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline" onClick={() => { onOpenChange(false); startPost("text", topic); setTopic(""); }}>Write a text post</button>
          <button type="button" className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline" onClick={() => { onOpenChange(false); startPost("image", topic); setTopic(""); }}>Text + image post</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
