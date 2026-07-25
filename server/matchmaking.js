import { randomUUID } from "node:crypto";
import { db, findActiveMatchForUser } from "./db.js";
import { getUserByToken } from "./auth.js";
import { pickYouTubeSample } from "./youtube.js";

const MATCH_SIZE = 10;
const PRODUCTION_TIME_MS = 30 * 60 * 1000;
const VOTING_TIME_MS = 15 * 60 * 1000;

export function configureMatchmaking(io) {
  function finalizeExpiredMatches(now = new Date()) {
    const expiredMatches = db.prepare(`
      SELECT id FROM matches
      WHERE status = 'production' AND submission_deadline <= ?
    `).all(now.toISOString());

    for (const match of expiredMatches) {
      const submitted = db.prepare(`
        SELECT mp.user_id
        FROM match_players mp
        JOIN submissions s ON s.match_id = mp.match_id AND s.user_id = mp.user_id
        WHERE mp.match_id = ?
      `).all(match.id);
      const kicked = db.prepare(`
        SELECT mp.user_id
        FROM match_players mp
        LEFT JOIN submissions s ON s.match_id = mp.match_id AND s.user_id = mp.user_id
        WHERE mp.match_id = ? AND s.id IS NULL
      `).all(match.id);

      db.exec("BEGIN");
      try {
        const removePlayer = db.prepare("DELETE FROM match_players WHERE match_id = ? AND user_id = ?");
        kicked.forEach((player) => removePlayer.run(match.id, player.user_id));
        db.prepare("UPDATE matches SET status = ? WHERE id = ?").run(
          submitted.length >= 2 ? "voting" : "cancelled",
          match.id,
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      kicked.forEach((player) => {
        io.to(`user:${player.user_id}`).emit("match:kicked", {
          matchId: match.id,
          reason: "Дедлайн истёк: работа не была загружена за 30 минут",
        });
      });
      submitted.forEach((player) => {
        if (submitted.length < 2) {
          io.to(`user:${player.user_id}`).emit("match:cancelled", {
            matchId: match.id,
            reason: "Недостаточно участников успели загрузить работу",
          });
        } else {
          io.to(`user:${player.user_id}`).emit("match:update", findActiveMatchForUser(player.user_id));
        }
      });
    }
    return expiredMatches.length;
  }

  async function broadcastQueue() {
    const queued = db.prepare(`
      SELECT q.user_id, q.joined_at
      FROM matchmaking_queue q
      ORDER BY q.joined_at ASC
    `).all();

    queued.forEach((entry, index) => {
      io.to(`user:${entry.user_id}`).emit("queue:update", {
        status: "queued",
        count: Math.min(queued.length, MATCH_SIZE),
        required: MATCH_SIZE,
        position: index + 1,
      });
    });

    if (queued.length >= MATCH_SIZE) await createMatches();
  }

  async function createMatches() {
    while (true) {
      const players = db.prepare(`
        SELECT user_id FROM matchmaking_queue ORDER BY joined_at ASC LIMIT ?
      `).all(MATCH_SIZE);
      if (players.length < MATCH_SIZE) return;

      const sample = await pickYouTubeSample();
      const matchId = randomUUID();
      const now = new Date();
      const submissionDeadline = new Date(now.getTime() + PRODUCTION_TIME_MS);
      const votingDeadline = new Date(submissionDeadline.getTime() + VOTING_TIME_MS);

      db.exec("BEGIN");
      try {
        db.prepare(`
          INSERT INTO matches (
            id, status, youtube_id, sample_title, sample_channel, sample_thumbnail,
            created_at, submission_deadline, voting_deadline
          ) VALUES (?, 'production', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          matchId,
          sample.youtubeId,
          sample.title,
          sample.channel,
          sample.thumbnail ?? null,
          now.toISOString(),
          submissionDeadline.toISOString(),
          votingDeadline.toISOString(),
        );
        const addPlayer = db.prepare(`
          INSERT INTO match_players (match_id, user_id, slot, joined_at)
          VALUES (?, ?, ?, ?)
        `);
        const removeQueue = db.prepare("DELETE FROM matchmaking_queue WHERE user_id = ?");
        players.forEach((player, index) => {
          addPlayer.run(matchId, player.user_id, index + 1, now.toISOString());
          removeQueue.run(player.user_id);
        });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      for (const player of players) {
        io.to(`user:${player.user_id}`).emit("match:found", findActiveMatchForUser(player.user_id));
      }
    }
  }

  io.use((socket, next) => {
    const user = getUserByToken(socket.handshake.auth?.token);
    if (!user) return next(new Error("unauthorized"));
    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);

    finalizeExpiredMatches();
    const activeMatch = findActiveMatchForUser(userId);
    if (activeMatch) socket.emit("match:found", activeMatch);
    else if (db.prepare("SELECT 1 FROM matchmaking_queue WHERE user_id = ?").get(userId)) {
      void broadcastQueue();
    }

    socket.on("queue:join", async (callback = () => {}) => {
      const match = findActiveMatchForUser(userId);
      if (match) {
        callback({ ok: true, match });
        socket.emit("match:found", match);
        return;
      }
      db.prepare(`
        INSERT OR IGNORE INTO matchmaking_queue (user_id, joined_at) VALUES (?, ?)
      `).run(userId, new Date().toISOString());
      callback({ ok: true });
      await broadcastQueue();
    });

    socket.on("queue:leave", async (callback = () => {}) => {
      db.prepare("DELETE FROM matchmaking_queue WHERE user_id = ?").run(userId);
      callback({ ok: true });
      socket.emit("queue:update", { status: "idle", count: 0, required: MATCH_SIZE });
      await broadcastQueue();
    });

    socket.on("disconnect", () => {
      // Даём пользователю перезагрузить страницу без потери места.
      setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(`user:${userId}`);
        if (!room?.size) {
          db.prepare("DELETE FROM matchmaking_queue WHERE user_id = ?").run(userId);
          void broadcastQueue();
        }
      }, 15_000);
    });
  });

  async function fillWithBots(realUserId) {
    for (let index = 1; index < MATCH_SIZE; index += 1) {
      const username = `bot_${String(Date.now()).slice(-5)}_${index}`;
      const id = randomUUID();
      db.prepare(`
        INSERT INTO users (
          id, email, username, display_name, password_hash, password_salt,
          bio, rating, calibration_games, created_at
        ) VALUES (?, ?, ?, ?, 'bot', 'bot', 'Тестовый игрок', ?, ?, ?)
      `).run(
        id,
        `${username}@beat-arena.local`,
        username,
        `Producer ${index}`,
        940 + Math.floor(Math.random() * 260),
        Math.floor(Math.random() * 6),
        new Date().toISOString(),
      );
      db.prepare(`
        INSERT INTO matchmaking_queue (user_id, joined_at) VALUES (?, ?)
      `).run(id, new Date(Date.now() + index).toISOString());
    }
    if (!db.prepare("SELECT 1 FROM matchmaking_queue WHERE user_id = ?").get(realUserId)) {
      db.prepare("INSERT INTO matchmaking_queue (user_id, joined_at) VALUES (?, ?)").run(
        realUserId,
        new Date(Date.now() - 1000).toISOString(),
      );
    }
    await broadcastQueue();
    return findActiveMatchForUser(realUserId);
  }

  const deadlineTimer = setInterval(() => finalizeExpiredMatches(), 1_000);
  deadlineTimer.unref();
  queueMicrotask(() => finalizeExpiredMatches());

  return { broadcastQueue, fillWithBots, finalizeExpiredMatches };
}
