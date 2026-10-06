import { randomBytes } from "node:crypto";

export * from "./media-types";

const ID_RE = /^img[a-f0-9]{18}$/;
export const isMediaId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);
export const newMediaId = () => `img${randomBytes(9).toString("hex")}`;
export const mediaKey = (id: string) => `media/${id}.img`;
export const mediaUrl = (id: string) => `/api/media/${id}`;
