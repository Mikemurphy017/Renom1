/** Review queue and archive shapes, plus how each status is shown. */
import type { ComplianceStatus, PlatformId } from "./types";

export interface ReviewComment {
  id: string;
  author: string;
  initials: string;
  role: string;
  at: string;
  anchor: { kind: "line"; section: "hook" | "body" | "cta"; index: number } | { kind: "time"; seconds: number };
  text: string;
  resolved: boolean;
}

export interface ReviewItem {
  id: string;
  videoId: string;
  kind: "Video + script" | "Descriptions" | "Thumbnail";
  status: ComplianceStatus;
  submittedAt: string;
  submittedBy: string;
  reviewer: string;
  dueAt: string;
  comments: ReviewComment[];
  decidedAt?: string;
}

export interface ArchiveRow {
  id: string;
  videoId: string;
  title: string;
  platform: PlatformId;
  publishedAt: string;
  caption: string;
  disclosure: string;
  approver: string;
  approvedAt: string;
  channel?: string;
  how?: string;
}

export const COMPLIANCE_STATUS_META: Record<ComplianceStatus, { label: string; variant: "default" | "brass" | "danger" | "success" }> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Submitted", variant: "brass" },
  changes_requested: { label: "Changes Requested", variant: "danger" },
  approved: { label: "Approved", variant: "success" },
};
