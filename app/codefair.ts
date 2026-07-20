export const CODEFAIR_REQUEST = "codefair:leaderboard:request";
export const CODEFAIR_SUBMIT = "codefair:leaderboard:submit";
export const CODEFAIR_LOGIN = "codefair:auth:login";
export const CODEFAIR_STATE = "codefair:leaderboard:state";
export const GAME_SLUG = "jimothy";

export type CodefairUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  isCurrentUser?: boolean;
};

export type CodefairState = {
  user: CodefairUser | null;
  entries: LeaderboardEntry[];
  currentUserRank?: number;
};

function postToHost(payload: Record<string, unknown>) {
  if (typeof window === "undefined" || window.parent === window) return false;
  window.parent.postMessage({ version: 1, game: GAME_SLUG, ...payload }, "*");
  return true;
}

export function requestCodefairState() {
  return postToHost({ type: CODEFAIR_REQUEST });
}

export function submitCodefairScore(score: number, runId: string, durationMs: number) {
  return postToHost({
    type: CODEFAIR_SUBMIT,
    score: Math.max(0, Math.floor(score)),
    runId,
    durationMs: Math.max(0, Math.floor(durationMs)),
  });
}

export function requestCodefairLogin() {
  return postToHost({ type: CODEFAIR_LOGIN, returnTo: "jimothy" });
}

function cleanUser(value: unknown): CodefairUser | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : typeof item.userId === "string" ? item.userId : "";
  const displayName =
    typeof item.displayName === "string"
      ? item.displayName
      : typeof item.name === "string"
        ? item.name
        : typeof item.username === "string"
          ? item.username
          : "";
  if (!id || !displayName) return null;
  return {
    id: id.slice(0, 160),
    displayName: displayName.trim().slice(0, 40),
    avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : undefined,
  };
}

export function parseCodefairState(data: unknown): CodefairState | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.type !== CODEFAIR_STATE && message.type !== "codefair:jimothy:state") return null;
  if (message.game && message.game !== GAME_SLUG) return null;

  const rawEntries = Array.isArray(message.entries) ? message.entries : [];
  const entries = rawEntries.slice(0, 100).flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    const score = Number(entry.score);
    const displayName =
      typeof entry.displayName === "string"
        ? entry.displayName
        : typeof entry.name === "string"
          ? entry.name
          : typeof entry.username === "string"
            ? entry.username
            : "Runner";
    if (!Number.isFinite(score) || score < 0) return [];
    return [{
      rank: Number.isInteger(entry.rank) ? Number(entry.rank) : index + 1,
      userId: typeof entry.userId === "string" ? entry.userId : `rank-${index + 1}`,
      displayName: displayName.trim().slice(0, 40),
      score: Math.floor(score),
      isCurrentUser: entry.isCurrentUser === true,
    }];
  });

  return {
    user: cleanUser(message.user ?? message.currentUser),
    entries,
    currentUserRank: Number.isInteger(message.currentUserRank) ? Number(message.currentUserRank) : undefined,
  };
}
