import type { Platform, PlatformId } from "../types";

export const PLATFORMS: Platform[] = [
  { id: "youtube", label: "YouTube", short: "YouTube", aspect: "16:9", preferredFormat: "long", titleLimit: 100, descLimit: 5000, hashtagLimit: 15, maxFileMB: 256000, customThumbnail: true, connected: true, handle: "@CatherineHaleCFP" },
  { id: "youtube_shorts", label: "YouTube Shorts", short: "Shorts", aspect: "9:16", preferredFormat: "short", titleLimit: 100, descLimit: 5000, hashtagLimit: 15, maxFileMB: 256000, customThumbnail: false, connected: true, handle: "@CatherineHaleCFP" },
  { id: "instagram", label: "Instagram", short: "Instagram", aspect: "9:16", preferredFormat: "short", descLimit: 2200, hashtagLimit: 30, maxFileMB: 4000, customThumbnail: true, connected: true, handle: "@halewealth" },
  { id: "tiktok", label: "TikTok", short: "TikTok", aspect: "9:16", preferredFormat: "short", descLimit: 2200, maxFileMB: 4000, customThumbnail: true, connected: false },
  { id: "facebook", label: "Facebook", short: "Facebook", aspect: "1:1 / 4:5", preferredFormat: "short", titleLimit: 255, descLimit: 63206, maxFileMB: 10000, customThumbnail: true, connected: true, handle: "Hale Wealth Partners" },
  { id: "linkedin", label: "LinkedIn", short: "LinkedIn", aspect: "16:9", preferredFormat: "long", titleLimit: 200, descLimit: 3000, hashtagLimit: 5, maxFileMB: 5000, customThumbnail: true, connected: true, handle: "Catherine Hale, CFP®" },
  { id: "x", label: "X", short: "X", aspect: "16:9", preferredFormat: "short", descLimit: 280, hashtagLimit: 2, maxFileMB: 512, customThumbnail: false, connected: false },
];

export const getPlatform = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;
