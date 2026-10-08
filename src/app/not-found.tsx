import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export const metadata = { title: "Page not found" };

/** Unknown URLs (and pages someone isn't allowed to see) land here. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-5xl items-center py-6">
        <Link href="/" aria-label="Home"><Logo /></Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center pb-16 text-center">
        <div className="eyebrow mb-3">Error 404</div>
        <h1 className="font-serif text-[36px] leading-tight tracking-tight text-balance sm:text-[44px]">We couldn’t find that page.</h1>
        <p className="mt-3 text-[15px] text-muted-foreground text-pretty">The link may be out of date, or the page has moved. Everything you’ve made is still in your studio.</p>
        <Button asChild className="mt-8 rounded-full px-6">
          <Link href="/"><ArrowLeft /> Back to your studio</Link>
        </Button>
      </main>
    </div>
  );
}
