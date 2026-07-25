import "dotenv/config";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import multer from "multer";
import { Server } from "socket.io";
import { login, logout, register, requireAuth } from "./auth.js";
import { db, findActiveMatchForUser, findUserById, publicUser } from "./db.js";
import { configureMatchmaking } from "./matchmaking.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(currentDir, "..");
const uploadsDir = join(currentDir, "uploads");
mkdirSync(uploadsDir, { recursive: true });
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});
const matchmaking = configureMatchmaking(io);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase() || (file.mimetype === "audio/wav" ? ".wav" : ".mp3");
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedMime = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"]);
    const allowedExtension = new Set([".mp3", ".wav"]);
    if (allowedMime.has(file.mimetype) && allowedExtension.has(extname(file.originalname).toLowerCase())) {
      callback(null, true);
    } else {
      callback(new Error("Можно загрузить только MP3 или WAV"));
    }
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: "sqlite", queueSize: db.prepare("SELECT COUNT(*) count FROM matchmaking_queue").get().count });
});
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.post("/api/auth/logout", requireAuth, logout);

app.get("/api/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
app.patch("/api/me", requireAuth, (req, res) => {
  const displayName = String(req.body.displayName ?? "").trim().slice(0, 40);
  const bio = String(req.body.bio ?? "").trim().slice(0, 240);
  const location = String(req.body.location ?? "").trim().slice(0, 60);
  const avatarData = req.body.avatarData === null ? null : String(req.body.avatarData ?? "");

  if (displayName.length < 2) return res.status(400).json({ error: "Имя слишком короткое" });
  if (avatarData && (!avatarData.startsWith("data:image/") || avatarData.length > 1_500_000)) {
    return res.status(400).json({ error: "Аватар должен быть изображением до 1 МБ" });
  }

  db.prepare(`
    UPDATE users SET display_name = ?, bio = ?, location = ?, avatar_data = ? WHERE id = ?
  `).run(displayName, bio, location, avatarData || null, req.user.id);
  res.json({ user: publicUser(findUserById(req.user.id)) });
});

app.get("/api/matches/current", requireAuth, (req, res) => {
  matchmaking.finalizeExpiredMatches();
  res.json({ match: findActiveMatchForUser(req.user.id) });
});

app.post("/api/matches/:matchId/submission", requireAuth, upload.single("beat"), (req, res) => {
  const removeUploadedFile = () => {
    if (!req.file) return;
    try {
      unlinkSync(req.file.path);
    } catch {
      // Файл уже удалён или не был записан.
    }
  };
  const match = db.prepare("SELECT * FROM matches WHERE id = ?").get(req.params.matchId);
  const player = db.prepare(`
    SELECT 1 FROM match_players WHERE match_id = ? AND user_id = ?
  `).get(req.params.matchId, req.user.id);

  if (!match || !player) {
    removeUploadedFile();
    return res.status(404).json({ error: "Ты не участвуешь в этом матче" });
  }
  if (match.status !== "production" || new Date(match.submission_deadline) <= new Date()) {
    removeUploadedFile();
    matchmaking.finalizeExpiredMatches();
    return res.status(409).json({ error: "Дедлайн истёк — загрузка закрыта" });
  }
  if (!req.file) return res.status(400).json({ error: "Выбери MP3 или WAV файл" });

  const existing = db.prepare(`
    SELECT audio_url FROM submissions WHERE match_id = ? AND user_id = ?
  `).get(match.id, req.user.id);
  const submissionId = randomUUID();
  const audioUrl = `/uploads/${req.file.filename}`;
  db.prepare(`
    INSERT INTO submissions (id, match_id, user_id, audio_url, duration_seconds, created_at)
    VALUES (?, ?, ?, ?, NULL, ?)
    ON CONFLICT(match_id, user_id) DO UPDATE SET
      audio_url = excluded.audio_url,
      duration_seconds = excluded.duration_seconds,
      created_at = excluded.created_at
  `).run(submissionId, match.id, req.user.id, audioUrl, new Date().toISOString());

  if (existing?.audio_url?.startsWith("/uploads/")) {
    try {
      unlinkSync(join(uploadsDir, existing.audio_url.slice("/uploads/".length)));
    } catch {
      // Старого файла уже нет.
    }
  }

  const updatedMatch = findActiveMatchForUser(req.user.id);
  io.to(`user:${req.user.id}`).emit("match:update", updatedMatch);
  res.status(201).json({ match: updatedMatch, submission: updatedMatch.submission });
});

app.get("/api/leaderboard", requireAuth, (_req, res) => {
  const users = db.prepare(`
    SELECT * FROM users
    WHERE password_hash != 'bot' OR battles > 0
    ORDER BY rating DESC, wins DESC
    LIMIT 50
  `).all();
  res.json({ users: users.map(publicUser) });
});

app.post("/api/dev/fill-match", requireAuth, async (req, res, next) => {
  if (process.env.NODE_ENV === "production") return res.status(404).end();
  try {
    const match = await matchmaking.fillWithBots(req.user.id);
    res.json({ match });
  } catch (error) {
    next(error);
  }
});

const distDir = join(rootDir, "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(join(distDir, "index.html")));
}

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Файл больше 30 МБ" });
  }
  res.status(error.message?.includes("MP3") ? 400 : 500).json({
    error: error.message?.includes("MP3") ? error.message : "Внутренняя ошибка сервера",
  });
});

const port = Number(process.env.PORT || 3001);
server.listen(port, "127.0.0.1", () => {
  console.log(`BeatArena API: http://127.0.0.1:${port}`);
});
