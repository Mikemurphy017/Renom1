"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { NewVideoDialog } from "./new-video-dialog";
import { ShellContext } from "./shell-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [palette, setPalette] = React.useState(false);
  const [newVideo, setNewVideo] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ctx = React.useMemo(() => ({ openPalette: () => setPalette(true), openNewVideo: () => setNewVideo(true) }), []);

  return (
    <ShellContext.Provider value={ctx}>
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] lg:block">
          <SidebarNav />
        </aside>
        <DialogPrimitive.Root open={mobileNav} onOpenChange={setMobileNav}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/40 lg:hidden" />
            <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[260px] shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden">
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <SidebarNav onNavigate={() => setMobileNav(false)} />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[240px]">
          <Topbar onMenu={() => setMobileNav(true)} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} onNewVideo={() => setNewVideo(true)} />
      <NewVideoDialog open={newVideo} onOpenChange={setNewVideo} />
    </ShellContext.Provider>
  );
}
