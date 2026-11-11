import type { CinematicAspect } from "./core";

/**
 * Which Higgsfield API models make the still and the video, and the exact
 * inputs each takes (from each model's API reference; the API rejects fields a
 * model doesn't list). The video model is a swappable strategy: set
 * CINEMATIC_VIDEO_MODEL to another id below to change it, no code change.
 */

export interface ImageModel {
  id: string;
  input(o: { prompt: string; headshotUrl: string; aspect: CinematicAspect }): Record<string, unknown>;
}

export interface VideoModel {
  id: string;
  label: string;
  minSeconds: number;
  maxSeconds: number;
  input(o: { prompt: string; imageUrl: string; seconds: number; aspect: CinematicAspect }): Record<string, unknown>;
}

const IMAGE_MODELS: ImageModel[] = [
  // Takes input images and keeps their detail: the headshot is the identity reference.
  { id: "xai/grok-imagine-image-2.0", input: (o) => ({ prompt: o.prompt, image_urls: [o.headshotUrl], aspect_ratio: o.aspect, resolution: "2k", quality: "medium" }) },
  { id: "ideogram/v4.0", input: (o) => ({ prompt: o.prompt.slice(0, 2048), image_url: o.headshotUrl, aspect_ratio: o.aspect, rendering_speed: "QUALITY" }) },
];

/** 1080p by default; 720p costs well under half as much on most models. */
export const videoResolution = () => (process.env.CINEMATIC_VIDEO_RESOLUTION?.trim() === "720p" ? "720p" : "1080p");

const VIDEO_MODELS: VideoModel[] = [
  // First frame + prompt, native speech and sound, up to 30 seconds. The frame sets the shape.
  { id: "bytedance/seedance-2.5/image-to-video", label: "Seedance 2.5", minSeconds: 4, maxSeconds: 30, input: (o) => ({ image_url: o.imageUrl, prompt: o.prompt, duration: o.seconds, resolution: videoResolution(), output_format: "mp4", generate_audio: true }) },
  { id: "alibaba/wan-3.0/image-to-video", label: "Wan 3.0", minSeconds: 2, maxSeconds: 30, input: (o) => ({ image_url: o.imageUrl, prompt: o.prompt, duration: o.seconds, resolution: videoResolution(), aspect_ratio: o.aspect, generate_audio: true }) },
  { id: "xai/grok-imagine-video/v1.5/reference-to-video", label: "Grok Imagine Video 1.5", minSeconds: 1, maxSeconds: 15, input: (o) => ({ image_url: o.imageUrl, prompt: o.prompt, duration: o.seconds, resolution: videoResolution(), aspect_ratio: o.aspect }) },
];

export const imageModel = (): ImageModel => IMAGE_MODELS.find((m) => m.id === process.env.CINEMATIC_IMAGE_MODEL?.trim()) ?? IMAGE_MODELS[0];
export const videoModel = (): VideoModel => VIDEO_MODELS.find((m) => m.id === process.env.CINEMATIC_VIDEO_MODEL?.trim()) ?? VIDEO_MODELS[0];
