"use client";

import { PageContainer, PageHeader } from "@/components/shared/page";
import { BRAND } from "@/lib/brand";

/** Help: a walkthrough video of the studio. */
export default function HelpPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Help" title={`Getting the most from ${BRAND.name}`} description="A quick walkthrough of the studio, from an idea to a finished, posted video." />
      <div className="mt-8 max-w-4xl">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-[#0B1F3A] shadow-soft">
          <iframe
            src="https://www.youtube-nocookie.com/embed/LDRMZlD57K4?rel=0&modestbranding=1"
            title={`${BRAND.name} walkthrough`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </PageContainer>
  );
}
