"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { usePostingSync } from "@/lib/posting/use-posting";
import { Navbar } from "./navbar";
import { TabBar } from "./tab-bar";
import { CommandPalette } from "./command-palette";
import { NewVideoDialog } from "./new-video-dialog";
import { ShellContext } from "./shell-context";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** While the studio loads: the page's outline instead of a blank screen. */
function ShellSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 pt-10 sm:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-56 rounded-lg" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // The studio has its own controls along the bottom on phones.
  const inStudio = pathname.startsWith("/studio");
  const { hydrated, onboarded } = useStore();
  usePostingSync();
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

  // First run: send people to setup before anything else (the admin dashboard excepted).
  const needsSetup = hydrated && !onboarded && !pathname.startsWith("/admin");
  React.useEffect(() => {
    if (needsSetup) router.replace("/welcome");
  }, [needsSetup, router]);

  const ctx = React.useMemo(() => ({ openPalette: () => setPalette(true), openNewVideo: () => setNewVideo(true) }), []);

  return (
    <ShellContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col">
        {/* In the studio, phones get the studio header only. */}
        <Navbar className={cn(inStudio && "hidden md:block")} />
        <main className={cn("flex-1", !inStudio && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0")}>{hydrated && !needsSetup ? children : <ShellSkeleton />}</main>
      </div>
      {!inStudio && <TabBar />}
      <CommandPalette open={palette} onOpenChange={setPalette} onNewVideo={() => setNewVideo(true)} />
      <NewVideoDialog open={newVideo} onOpenChange={setNewVideo} />
    </ShellContext.Provider>
  );
}
