/* eslint-disable @next/next/no-img-element -- small static brand files; plain <img> keeps them crisp at any size */
import { BRAND, isDefaultBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Brand mark + name. Renom Video uses its own wordmark (navy on light
 * backgrounds, cream in dark mode or on navy); a reseller's brand from
 * src/lib/brand.ts gets a mark and the name in type.
 */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  if (isDefaultBrand && !BRAND.logoUrl) {
    const img = "h-[22px] w-auto sm:h-[26px]";
    return (
      <span className={cn("flex items-center", className)}>
        {onDark ? (
          <img src="/brand/renom-wordmark-light.png" alt={BRAND.name} width={742} height={105} className={img} />
        ) : (
          <>
            <img src="/brand/renom-wordmark-navy.png" alt={BRAND.name} width={1350} height={190} className={cn(img, "dark:hidden")} />
            <img src="/brand/renom-wordmark-light.png" alt={BRAND.name} width={742} height={105} className={cn(img, "hidden dark:block")} />
          </>
        )}
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {BRAND.logoUrl ? (
        // A reseller's logo can live on any host, so a plain <img> rather than next/image.
        <img src={BRAND.logoUrl} alt="" className="size-7 rounded-lg object-contain" />
      ) : (
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
          <rect width="32" height="32" rx="8" fill={BRAND.mark.background} />
          <text x="16" y="22.5" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fontWeight="600" fill={BRAND.mark.foreground}>
            {BRAND.name.charAt(0).toUpperCase()}
          </text>
        </svg>
      )}
      <span className="font-serif text-[18px] tracking-tight whitespace-nowrap sm:text-[20px]">{BRAND.name}</span>
    </span>
  );
}

