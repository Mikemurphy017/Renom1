"use client";

import * as React from "react";
import type { AdvisorProfile, ComplianceStatus, StageId, Video } from "./types";
import type { ReviewComment, ReviewItem } from "./compliance";
import { EMPTY_PROFILE } from "./profile";
import { clearDrafts, exportDrafts, importDrafts, legacyDrafts, onDraftsChange } from "./drafts";

/**
 * App state for the signed-in advisor, saved to their account (/api/state)
 * a moment after each change, so it follows them to any device.
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
  requireApproval: false,
  reviewer: "",
  profile: EMPTY_PROFILE,
  team: [],
};

export interface Account {
  id: string;
  email: string;
  name: string;
  /** Can open the admin dashboard. */
  admin?: boolean;
}

interface Store {
  /** False until the account's saved state has loaded. */
  hydrated: boolean;
  /** The signed-in advisor (null on the sign-in pages). */
  account: Account | null;
  signOut: () => Promise<void>;
  /** "saving" while changes are on their way to the account, "error" if the last save failed. */
  saveState: "saved" | "saving" | "error";
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

function normalize(p: Persisted | null | undefined): Persisted | null {
  return p && p.version === 1 ? { ...INITIAL, ...p, profile: { ...EMPTY_PROFILE, ...p.profile } } : null;
}

/** Studio data saved in this browser before accounts existed. */
function legacyState(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

async function putState(state: Persisted, keepalive = false) {
  const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, drafts: exportDrafts() }), keepalive });
  if (!res.ok) throw new Error(`Save failed (${res.status})`);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(INITIAL);
  const [hydrated, setHydrated] = React.useState(false);
  const [account, setAccount] = React.useState<Account | null>(null);
  const [saveState, setSaveState] = React.useState<"saved" | "saving" | "error">("saved");
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const dirty = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the account's studio. On the sign-in pages there is no account yet.
  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { user: Account; state: Persisted | null; drafts: unknown };
        if (!live) return;
        setAccount(body.user);
        let saved = normalize(body.state);
        if (saved) importDrafts(body.drafts);
        else {
          // First sign-in on a browser that already has work: move it into the account.
          saved = legacyState();
          importDrafts(legacyDrafts());
          if (saved) await putState(saved).catch(() => {});
        }
        try {
          localStorage.removeItem(KEY);
        } catch {}
        if (saved) setState(saved);
      } catch {
        /* offline: start empty, nothing is saved until the account loads */
      } finally {
        if (live) setHydrated(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const flush = React.useCallback(async (keepalive = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      await putState(stateRef.current, keepalive);
      setSaveState("saved");
    } catch {
      dirty.current = true;
      setSaveState("error");
    }
  }, []);

  const schedule = React.useCallback(() => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }, [flush]);

  // Save a moment after each change (studio state or a draft).
  const first = React.useRef(true);
  React.useEffect(() => {
    if (!hydrated || !account) return;
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [state, hydrated, account, schedule]);
  React.useEffect(() => {
    if (!account) return;
    const off = onDraftsChange(schedule);
    return () => {
      off();
    };
  }, [account, schedule]);
  // Don't lose the last change when the tab closes.
  React.useEffect(() => {
    const onHide = () => void flush(true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const signOut = React.useCallback(async () => {
    await flush();
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    clearDrafts();
    try {
      localStorage.removeItem(KEY);
    } catch {}
    window.location.href = "/signin";
  }, [flush]);

  const value = React.useMemo<Store>(() => {
    const set = (fn: (s: Persisted) => Partial<Persisted>) => setState((s) => ({ ...s, ...fn(s) }));
    const now = () => new Date().toISOString();
    return {
      hydrated,
      account,
      signOut,
      saveState,
      onboarded: state.onboarded,
      completeOnboarding: ({ profile, requireApproval, reviewer }) => set(() => ({ onboarded: true, profile, requireApproval, reviewer })),
      resetAll: () => {
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
  }, [state, hydrated, account, signOut, saveState]);

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
