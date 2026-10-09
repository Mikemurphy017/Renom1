import type { MetadataRoute } from "next";
import { BRAND, isDefaultBrand } from "@/lib/brand";

/** Lets advisors add the studio to their phone's home screen with the app icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: isDefaultBrand ? "Renom Video" : BRAND.name,
    description: BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F0",
    theme_color: "#13213F",
    icons: isDefaultBrand
      ? [
          { src: "/brand/renom-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/brand/renom-icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/brand/renom-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [],
  };
}
