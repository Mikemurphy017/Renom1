"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Something on a studio page failed to render: say so plainly and offer a way back. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <div className="eyebrow mb-3">Something went wrong</div>
      <h1 className="font-serif text-[32px] leading-tight tracking-tight text-balance">This page didn’t load properly.</h1>
      <p className="mt-3 text-[15px] text-muted-foreground text-pretty">Your work is saved to your account. Try again, and if it keeps happening, let us know.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button className="rounded-full px-6" onClick={reset}><RotateCcw /> Try again</Button>
        <Button variant="outline" className="rounded-full px-6" asChild><Link href="/">Go to Home</Link></Button>
      </div>
    </div>
  );
}
