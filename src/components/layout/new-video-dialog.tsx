"use client";

import * as React from "react";
import { ArrowRight, Monitor, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStartVideo } from "./use-start-video";
import type { VideoFormat } from "@/lib/types";
import { BRAND } from "@/lib/brand";

export function NewVideoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const start = useStartVideo();
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
      </DialogContent>
    </Dialog>
  );
}
