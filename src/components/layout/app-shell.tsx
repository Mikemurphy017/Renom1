"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Navbar } from "./navbar";
import { CommandPalette } from "./command-palette";
import { NewVideoDialog } from "./new-video-dialog";
import { ShellContext } from "./shell-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, onboarded } = useStore();
  const [palette, setPalette] = React.useState(false);
  const [newVideo, setNewVideo] = React.useState(false);

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

  // First run: send people to setup before anything else.
  React.useEffect(() => {
    if (hydrated && !onboarded) router.replace("/welcome");
  }, [hydrated, onboarded, router]);

  const ctx = React.useMemo(() => ({ openPalette: () => setPalette(true), openNewVideo: () => setNewVideo(true) }), []);

  return (
    <ShellContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{hydrated && onboarded ? children : null}</main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} onNewVideo={() => setNewVideo(true)} />
      <NewVideoDialog open={newVideo} onOpenChange={setNewVideo} />
    </ShellContext.Provider>
  );
}
