/** Images the platform keeps for an advisor: headshots, thumbnails, brand marks. */
export const MEDIA_KINDS = ["headshot", "thumbnail", "logo"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_MB = 12;
