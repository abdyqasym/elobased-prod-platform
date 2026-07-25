export type Page = "match" | "leaderboard" | "profile";

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  avatarData: string | null;
  rating: number;
  calibrationGames: number;
  wins: number;
  battles: number;
  createdAt: string;
};

export type MatchPlayer = Pick<
  User,
  "id" | "username" | "displayName" | "avatarData" | "rating" | "calibrationGames"
> & { slot: number; submitted: boolean };

export type Match = {
  id: string;
  status: "production" | "voting";
  sample: {
    youtubeId: string;
    title: string;
    channel: string;
    thumbnail: string | null;
  };
  createdAt: string;
  submissionDeadline: string;
  votingDeadline: string;
  players: MatchPlayer[];
  submission: {
    id: string;
    audioUrl: string;
    durationSeconds: number | null;
    createdAt: string;
  } | null;
};

export type QueueStatus = {
  status: "idle" | "queued";
  count: number;
  required: number;
  position?: number;
};

// Типы следующей стадии матча: анонимная сдача работ и голосование.
export type Submission = {
  id: string;
  number: number;
  title: string;
  producer: string;
  duration: string;
  seed: number;
  baseScore: number;
  rating: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  handle: string;
  rating: number;
  wins: number;
  battles: number;
  trend: number;
  avatar: string;
};

export type ResultRow = {
  submission: Submission;
  score: number;
  place: number;
  delta: number;
  isUser: boolean;
};
