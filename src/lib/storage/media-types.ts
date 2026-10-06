/** Images the platform keeps for an advisor: headshots, thumbnails, brand marks. */
export const MEDIA_KINDS = ["headshot", "thumbnail", "logo", "broll", "music"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_MB = 12;
/** B-roll can be photos or short clips; music is audio. */
export const ACCEPTED_BROLL_TYPES = [...ACCEPTED_IMAGE_TYPES, "video/mp4", "video/quicktime", "video/webm"];
export const ACCEPTED_MUSIC_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg"];
export const MAX_MEDIA_MB = 150;
export const acceptedTypes = (kind: MediaKind) => (kind === "broll" ? ACCEPTED_BROLL_TYPES : kind === "music" ? ACCEPTED_MUSIC_TYPES : ACCEPTED_IMAGE_TYPES);
