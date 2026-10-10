import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BRAND } from "@/lib/brand";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** The shared frame for the Privacy policy and Terms of Service: numbered sections with a contents box. */
export function LegalPage({ title, effective, intro, sections }: { title: string; effective: string; intro?: React.ReactNode; sections: LegalSection[] }) {
  const NAME = BRAND.name;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label={`${NAME} home`}><Logo /></Link>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-14 pb-24 sm:px-6">
        <div className="eyebrow mb-3 text-primary">Legal</div>
        <h1 className="font-serif text-[40px] leading-tight tracking-tight sm:text-[52px]">{title}</h1>
        <p className="mt-3 text-[14px] text-muted-foreground">Effective {effective}</p>
        {intro && <div className="mt-6 text-[15px] leading-relaxed text-foreground/85 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">{intro}</div>}

        <nav aria-label="On this page" className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="eyebrow mb-3">On this page</div>
          <ol className="grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground"><span className="tnum mr-1.5 text-primary">{i + 1}.</span>{s.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="font-serif text-[26px] leading-tight"><span className="tnum mr-2 text-primary">{i + 1}.</span>{s.title}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/85 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[12px] text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} {NAME}. All rights reserved.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of service</Link>
            <Link href="/" className="hover:text-foreground">Home</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
