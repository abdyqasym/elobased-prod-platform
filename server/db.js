import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(currentDir, "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, "beat-arena.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    avatar_data TEXT,
    rating INTEGER NOT NULL DEFAULT 1000,
    calibration_games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    battles INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matchmaking_queue (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    youtube_id TEXT NOT NULL,
    sample_title TEXT NOT NULL,
    sample_channel TEXT NOT NULL,
    sample_thumbnail TEXT,
    created_at TEXT NOT NULL,
    submission_deadline TEXT NOT NULL,
    voting_deadline TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_players (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (match_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    duration_seconds INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(match_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    voter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 10),
    created_at TEXT NOT NULL,
    PRIMARY KEY (voter_id, submission_id)
  );
`);

// Миграция матчей, созданных в ранней версии с дедлайном 24 часа.
const legacyMatches = db.prepare(`
  SELECT id, created_at, submission_deadline
  FROM matches
  WHERE status = 'production'
`).all();
const shortenDeadline = db.prepare(`
  UPDATE matches SET submission_deadline = ?, voting_deadline = ? WHERE id = ?
`);
for (const match of legacyMatches) {
  const expectedDeadline = new Date(new Date(match.created_at).getTime() + 30 * 60 * 1000);
  if (new Date(match.submission_deadline) > expectedDeadline) {
    shortenDeadline.run(
      expectedDeadline.toISOString(),
      new Date(expectedDeadline.getTime() + 15 * 60 * 1000).toISOString(),
      match.id,
    );
  }
}

// Очередь не должна переживать перезапуск dev-сервера: сокеты уже отключены.
db.exec("DELETE FROM matchmaking_queue;");

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    location: row.location,
    avatarData: row.avatar_data,
    rating: row.rating,
    calibrationGames: row.calibration_games,
    wins: row.wins,
    battles: row.battles,
    createdAt: row.created_at,
  };
}

export function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function findActiveMatchForUser(userId) {
  const match = db.prepare(`
    SELECT m.*
    FROM matches m
    JOIN match_players mp ON mp.match_id = m.id
    WHERE mp.user_id = ? AND m.status IN ('creating', 'production', 'voting')
    ORDER BY m.created_at DESC
    LIMIT 1
  `).get(userId);

  if (!match) return null;
  const players = db.prepare(`
    SELECT
      u.id, u.username, u.display_name, u.avatar_data, u.rating, u.calibration_games,
      mp.slot, CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS submitted
    FROM match_players mp
    JOIN users u ON u.id = mp.user_id
    LEFT JOIN submissions s ON s.match_id = mp.match_id AND s.user_id = mp.user_id
    WHERE mp.match_id = ?
    ORDER BY mp.slot
  `).all(match.id);
  const submission = db.prepare(`
    SELECT id, audio_url, duration_seconds, created_at
    FROM submissions
    WHERE match_id = ? AND user_id = ?
  `).get(match.id, userId);

  return {
    id: match.id,
    status: match.status,
    sample: {
      youtubeId: match.youtube_id,
      title: match.sample_title,
      channel: match.sample_channel,
      thumbnail: match.sample_thumbnail,
    },
    createdAt: match.created_at,
    submissionDeadline: match.submission_deadline,
    votingDeadline: match.voting_deadline,
    players: players.map((player) => ({
      id: player.id,
      username: player.username,
      displayName: player.display_name,
      avatarData: player.avatar_data,
      rating: player.rating,
      calibrationGames: player.calibration_games,
      slot: player.slot,
      submitted: Boolean(player.submitted),
    })),
    submission: submission
      ? {
          id: submission.id,
          audioUrl: submission.audio_url,
          durationSeconds: submission.duration_seconds,
          createdAt: submission.created_at,
        }
      : null,
  };
}
