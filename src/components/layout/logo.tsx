import { BRAND, isDefaultBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Brand mark + name. Driven by src/lib/brand.ts so resellers can rebrand. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {BRAND.logoUrl ? (
        // A reseller's logo can live on any host, so a plain <img> rather than next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND.logoUrl} alt="" className="size-7 rounded-lg object-contain" />
      ) : (
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
          <rect width="32" height="32" rx="8" fill={BRAND.mark.background} />
          {isDefaultBrand ? (
            <path d="M10.5 23V9h6c3 0 4.8 1.7 4.8 4.2 0 2-1 3.3-2.8 3.9l3.3 5.9h-2.6l-3-5.5h-3.4V23zm2.3-7.5h3.6c1.6 0 2.6-.9 2.6-2.3s-1-2.2-2.6-2.2h-3.6z" fill={BRAND.mark.foreground} />
          ) : (
            <text x="16" y="22.5" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fontWeight="600" fill={BRAND.mark.foreground}>
              {BRAND.name.charAt(0).toUpperCase()}
            </text>
          )}
        </svg>
      )}
      <span className="font-serif text-[18px] tracking-tight whitespace-nowrap sm:text-[20px]">{BRAND.name}</span>
    </span>
  );
}
