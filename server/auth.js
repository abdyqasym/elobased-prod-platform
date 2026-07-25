import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { db, findUserById, publicUser } from "./db.js";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;

async function hashPassword(password, salt) {
  const result = await scrypt(password, salt, 64);
  return Buffer.from(result).toString("hex");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400000);
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(hashToken(token), userId, expiresAt.toISOString(), now.toISOString());
  return token;
}

export async function register(req, res) {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Укажите корректный email" });
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Ник: 3–20 символов, латиница, цифры и _" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Пароль должен содержать минимум 8 символов" });
  }
  if (db.prepare("SELECT 1 FROM users WHERE email = ? OR username = ?").get(email, username)) {
    return res.status(409).json({ error: "Email или ник уже используется" });
  }

  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (
      id, email, username, display_name, password_hash, password_salt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, username, username, passwordHash, salt, now);

  const token = createSession(id);
  return res.status(201).json({ token, user: publicUser(findUserById(id)) });
}

export async function login(req, res) {
  const identity = String(req.body.identity ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const user = db.prepare("SELECT * FROM users WHERE email = ? OR username = ?").get(identity, identity);
  if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });

  const candidate = await hashPassword(password, user.password_salt);
  const valid = timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(user.password_hash, "hex"));
  if (!valid) return res.status(401).json({ error: "Неверный логин или пароль" });

  return res.json({ token: createSession(user.id), user: publicUser(user) });
}

export function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare(`
    SELECT user_id FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).get(hashToken(token), new Date().toISOString());
  return session ? findUserById(session.user_id) : null;
}

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: "Требуется авторизация" });
  req.user = user;
  req.authToken = token;
  next();
}

export function logout(req, res) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(req.authToken));
  res.status(204).end();
}
