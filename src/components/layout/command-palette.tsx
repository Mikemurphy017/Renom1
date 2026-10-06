"use client";

import { useRouter } from "next/navigation";
import { Plus, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useStore } from "@/lib/store";
import { STAGES, stageIndex } from "@/lib/stages";
import { NAV } from "./nav";

export function CommandPalette({ open, onOpenChange, onNewVideo }: { open: boolean; onOpenChange: (o: boolean) => void; onNewVideo: () => void }) {
  const router = useRouter();
  const { videos } = useStore();
  const { resolvedTheme, setTheme } = useTheme();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const active = videos.filter((v) => v.status !== "published");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showClose={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command>
          <CommandInput placeholder="Jump to a video, step or page…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => { onOpenChange(false); onNewVideo(); }}>
                <Plus /> New video
              </CommandItem>
              <CommandItem onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); onOpenChange(false); }}>
                <Moon /> Toggle navy mode
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Pages">
              {NAV.map((n) => (
                <CommandItem key={n.href} onSelect={() => go(n.href)}>
                  <n.icon /> {n.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Videos in progress">
              {active.map((v) => {
                const s = STAGES[stageIndex(v.stage)];
                return (
                  <CommandItem key={v.id} value={`${v.title} ${v.category}`} onSelect={() => go(`/studio/${v.id}/${v.stage}`)}>
                    <s.icon />
                    <span className="flex-1 truncate">{v.title}</span>
                    <span className="text-[11px] text-muted-foreground">{s.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup heading="Jump to step">
              {active.slice(0, 4).flatMap((v) =>
                STAGES.slice(0, stageIndex(v.stage) + 1).map((s) => (
                  <CommandItem key={v.id + s.id} value={`${v.title} ${s.label} step`} onSelect={() => go(`/studio/${v.id}/${s.id}`)}>
                    <s.icon />
                    <span className="truncate">
                      {s.label} <span className="text-muted-foreground">— {v.title}</span>
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span><kbd className="font-sans">↑↓</kbd> navigate</span>
            <span><kbd className="font-sans">↵</kbd> open</span>
            <span><kbd className="font-sans">esc</kbd> close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
