"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Leaf, Newspaper, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/videos";
import type { Category, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

function Choice({ active, onClick, icon: Icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ElementType; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-brass-soft/60" : "border-border hover:border-primary/40"
      )}
    >
      <Icon className={cn("mt-0.5 size-4", active ? "text-primary" : "text-muted-foreground")} />
      <div>
        <div className="text-[13px] font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </button>
  );
}

export function NewVideoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { addVideo } = useStore();
  const [title, setTitle] = React.useState("");
  const [format, setFormat] = React.useState<VideoFormat>("short");
  const [mode, setMode] = React.useState<"evergreen" | "timely">("evergreen");
  const [category, setCategory] = React.useState<Category>("Tax Planning");

  const create = () => {
    const v = addVideo({ title: title.trim() || "Untitled video", format, mode, category });
    onOpenChange(false);
    setTitle("");
    toast.success("Video created", { description: "Starting in the Idea step." });
    router.push(`/studio/${v.id}/idea`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="eyebrow">New video</div>
          <DialogTitle>Start from an idea</DialogTitle>
          <DialogDescription>Give it a working title, or leave it blank and let Renom suggest ideas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nv-title">Working title</Label>
            <Input id="nv-title" placeholder="e.g. Roth conversions before RMDs" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <div className="flex gap-2">
              <Choice active={format === "short"} onClick={() => setFormat("short")} icon={Smartphone} title="Short-form" sub="9:16 · under 60s" />
              <Choice active={format === "long"} onClick={() => setFormat("long")} icon={Monitor} title="Long-form" sub="16:9 · 5–15 min" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Idea source</Label>
            <div className="flex gap-2">
              <Choice active={mode === "evergreen"} onClick={() => setMode("evergreen")} icon={Leaf} title="Evergreen" sub="Always relevant" />
              <Choice active={mode === "timely"} onClick={() => setMode("timely")} icon={Newspaper} title="Timely" sub="News & markets" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create}>Create video</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
