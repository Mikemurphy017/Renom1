"use client";

import * as React from "react";
import type { AdvisorProfile, ComplianceStatus, StageId, Video } from "./types";
import type { ReviewComment, ReviewItem } from "./compliance";
import { EMPTY_PROFILE } from "./profile";
import { clearDrafts } from "./drafts";

/**
 * App state, saved in this browser (localStorage) so work survives a refresh.
 * Every mutation goes through these functions so they can later be swapped
 * for a real database behind an API.
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Advisor" | "Assistant" | "Compliance Reviewer";
}

interface Persisted {
  version: 1;
  onboarded: boolean;
  videos: Video[];
  reviews: ReviewItem[];
  requireApproval: boolean;
  reviewer: string;
  profile: AdvisorProfile;
  team: TeamMember[];
}

const KEY = "renom.state.v1";
const INITIAL: Persisted = {
  version: 1,
  onboarded: false,
  videos: [],
  reviews: [],
  requireApproval: true,
  reviewer: "",
  profile: EMPTY_PROFILE,
  team: [],
};

interface Store {
  /** False until saved state has been read from this browser. */
  hydrated: boolean;
  onboarded: boolean;
  completeOnboarding: (p: { profile: AdvisorProfile; requireApproval: boolean; reviewer: string }) => void;
  resetAll: () => void;
  videos: Video[];
  getVideo: (id: string) => Video | undefined;
  updateVideo: (id: string, patch: Partial<Video>) => void;
  addVideo: (v: Partial<Video> & Pick<Video, "title">) => Video;
  deleteVideo: (id: string) => void;
  setStage: (id: string, stage: StageId) => void;
  reviews: ReviewItem[];
  setReviewStatus: (id: string, status: ComplianceStatus) => void;
  resolveComment: (reviewId: string, commentId: string) => void;
  submitForReview: (videoId: string, kind?: ReviewItem["kind"]) => void;
  addComment: (reviewId: string, c: Omit<ReviewComment, "id" | "at" | "resolved">) => void;
  requireApproval: boolean;
  setRequireApproval: (v: boolean) => void;
  reviewer: string;
  setReviewer: (name: string) => void;
  profile: AdvisorProfile;
  updateProfile: (patch: Partial<AdvisorProfile>) => void;
  team: TeamMember[];
  setTeam: (t: TeamMember[]) => void;
}

const StoreContext = React.createContext<Store | null>(null);

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    return p.version === 1 ? { ...INITIAL, ...p, profile: { ...EMPTY_PROFILE, ...p.profile } } : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(INITIAL);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const saved = load();
    if (saved) setState(saved);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [state, hydrated]);

  const value = React.useMemo<Store>(() => {
    const set = (fn: (s: Persisted) => Partial<Persisted>) => setState((s) => ({ ...s, ...fn(s) }));
    const now = () => new Date().toISOString();
    return {
      hydrated,
      onboarded: state.onboarded,
      completeOnboarding: ({ profile, requireApproval, reviewer }) => set(() => ({ onboarded: true, profile, requireApproval, reviewer })),
      resetAll: () => {
        try {
          localStorage.removeItem(KEY);
        } catch {}
        clearDrafts();
        setState(INITIAL);
      },
      videos: state.videos,
      getVideo: (id) => state.videos.find((v) => v.id === id),
      updateVideo: (id, patch) => set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch, lastEdited: now() } : v)) })),
      addVideo: (partial) => {
        const v: Video = {
          id: `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
          category: "Wealth Strategy",
          format: "short",
          stage: "idea",
          status: "in_progress",
          mode: "evergreen",
          outline: [],
          runtimeSec: 55,
          platforms: [],
          compliance: "draft",
          createdAt: now(),
          lastEdited: now(),
          ...partial,
        };
        set((s) => ({ videos: [v, ...s.videos] }));
        return v;
      },
      deleteVideo: (id) => set((s) => ({ videos: s.videos.filter((v) => v.id !== id), reviews: s.reviews.filter((r) => r.videoId !== id) })),
      setStage: (id, stage) => set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, stage, lastEdited: now() } : v)) })),
      reviews: state.reviews,
      setReviewStatus: (id, status) =>
        set((s) => {
          const r = s.reviews.find((x) => x.id === id);
          return {
            reviews: s.reviews.map((x) => (x.id === id ? { ...x, status, decidedAt: status === "approved" || status === "changes_requested" ? now() : x.decidedAt } : x)),
            videos: r ? s.videos.map((v) => (v.id === r.videoId ? { ...v, compliance: status } : v)) : s.videos,
          };
        }),
      resolveComment: (reviewId, commentId) =>
        set((s) => ({ reviews: s.reviews.map((r) => (r.id === reviewId ? { ...r, comments: r.comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c)) } : r)) })),
      submitForReview: (videoId, kind = "Video + script") =>
        set((s) => {
          const existing = s.reviews.find((r) => r.videoId === videoId && r.kind === kind);
          const reviews: ReviewItem[] = existing
            ? s.reviews.map((r) => (r === existing ? { ...r, status: "submitted", submittedAt: now() } : r))
            : [
                {
                  id: `r${Date.now().toString(36)}`,
                  videoId,
                  kind,
                  status: "submitted",
                  submittedAt: now(),
                  submittedBy: s.profile.name || "You",
                  reviewer: s.reviewer || "Your reviewer",
                  dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
                  comments: [],
                },
                ...s.reviews,
              ];
          return { reviews, videos: s.videos.map((v) => (v.id === videoId ? { ...v, compliance: "submitted" } : v)) };
        }),
      addComment: (reviewId, c) =>
        set((s) => ({ reviews: s.reviews.map((r) => (r.id === reviewId ? { ...r, comments: [...r.comments, { ...c, id: `c${Date.now()}`, at: now(), resolved: false }] } : r)) })),
      requireApproval: state.requireApproval,
      setRequireApproval: (v) => set(() => ({ requireApproval: v })),
      reviewer: state.reviewer,
      setReviewer: (name) => set(() => ({ reviewer: name })),
      profile: state.profile,
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      team: state.team,
      setTeam: (team) => set(() => ({ team })),
    };
  }, [state, hydrated]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** The subset of the profile every writing request sends. */
export function voiceProfileOf(p: AdvisorProfile) {
  return {
    name: p.name,
    credentials: p.credentials,
    firm: p.firm,
    niche: p.niche,
    idealClient: p.idealClient,
    bio: p.bio,
    tone: p.tone,
    opinions: p.opinions,
    sampleWriting: p.sampleWriting,
  };
}
