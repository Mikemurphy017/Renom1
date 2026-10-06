import { daysFromToday } from "../utils";
import type { ComplianceStatus, PlatformId } from "../types";

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
}

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "r1",
    videoId: "v02",
    kind: "Video + script",
    status: "submitted",
    submittedAt: daysFromToday(0, 6, 20),
    submittedBy: "Catherine Hale",
    reviewer: "Ruth Lindqvist",
    dueAt: daysFromToday(1, 17, 0),
    comments: [],
  },
  {
    id: "r2",
    videoId: "v03",
    kind: "Video + script",
    status: "changes_requested",
    submittedAt: daysFromToday(-2, 10, 0),
    submittedBy: "Jordan Ellis",
    reviewer: "Ruth Lindqvist",
    dueAt: daysFromToday(1, 17, 0),
    comments: [
      {
        id: "c1",
        author: "Ruth Lindqvist",
        initials: "RL",
        role: "Compliance Reviewer",
        at: daysFromToday(-1, 14, 12),
        anchor: { kind: "line", section: "body", index: 2 },
        text: "“My rule of thumb” reads as a recommendation. Please add “for many people” or tie it to the client's own risk tolerance.",
        resolved: false,
      },
      {
        id: "c2",
        author: "Ruth Lindqvist",
        initials: "RL",
        role: "Compliance Reviewer",
        at: daysFromToday(-1, 14, 20),
        anchor: { kind: "time", seconds: 284 },
        text: "On-screen example shows a specific ticker. Replace with a generic “Company X” graphic.",
        resolved: false,
      },
      {
        id: "c3",
        author: "Ruth Lindqvist",
        initials: "RL",
        role: "Compliance Reviewer",
        at: daysFromToday(-1, 14, 31),
        anchor: { kind: "line", section: "cta", index: 0 },
        text: "Checklist link must point to the approved landing page (v2), not the draft PDF.",
        resolved: true,
      },
    ],
  },
  {
    id: "r3",
    videoId: "v06",
    kind: "Descriptions",
    status: "draft",
    submittedAt: daysFromToday(-1, 9, 50),
    submittedBy: "Jordan Ellis",
    reviewer: "Ruth Lindqvist",
    dueAt: daysFromToday(3, 17, 0),
    comments: [],
  },
  {
    id: "r4",
    videoId: "v01",
    kind: "Video + script",
    status: "approved",
    submittedAt: daysFromToday(-4, 11, 0),
    submittedBy: "Catherine Hale",
    reviewer: "Ruth Lindqvist",
    dueAt: daysFromToday(-2, 17, 0),
    comments: [
      {
        id: "c4",
        author: "Ruth Lindqvist",
        initials: "RL",
        role: "Compliance Reviewer",
        at: daysFromToday(-3, 9, 2),
        anchor: { kind: "line", section: "hook", index: 0 },
        text: "“Costs five figures” — fine as hyperbole for a hook but add “can” → “can quietly cost”. Approved with that edit.",
        resolved: true,
      },
    ],
  },
  {
    id: "r5",
    videoId: "v05",
    kind: "Thumbnail",
    status: "approved",
    submittedAt: daysFromToday(-3, 15, 0),
    submittedBy: "Jordan Ellis",
    reviewer: "Ruth Lindqvist",
    dueAt: daysFromToday(-1, 17, 0),
    comments: [],
  },
];

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
}

export const COMPLIANCE_STATUS_META: Record<ComplianceStatus, { label: string; variant: "default" | "brass" | "danger" | "success" }> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Submitted", variant: "brass" },
  changes_requested: { label: "Changes Requested", variant: "danger" },
  approved: { label: "Approved", variant: "success" },
};
