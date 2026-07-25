import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  Clock3,
  Disc3,
  ExternalLink,
  Gamepad2,
  LoaderCircle,
  LocateFixed,
  LogOut,
  Menu,
  Music2,
  Pencil,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  UserRound,
  Users,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { api, uploadBeat } from "./api";
import { API_ORIGIN } from "./config";
import type { Match, Page, QueueStatus, User } from "./types";

const TOKEN_KEY = "beat-arena-token";

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark"><i /><i /><i /></span>
      <strong>BEAT<span>ARENA</span></strong>
    </div>
  );
}

function Avatar({ user, size = "medium" }: { user: Pick<User, "displayName" | "avatarData">; size?: "small" | "medium" | "large" }) {
  const initials = user.displayName.trim().slice(0, 2).toUpperCase() || "BA";
  return user.avatarData ? (
    <img className={`avatar avatar-${size}`} src={user.avatarData} alt="" />
  ) : (
    <span className={`avatar avatar-${size}`}>{initials}</span>
  );
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = mode === "register"
        ? await api<{ token: string; user: User }>("/api/auth/register", {
            method: "POST",
            body: {
              email: form.get("email"),
              username: form.get("username"),
              password: form.get("password"),
            },
          })
        : await api<{ token: string; user: User }>("/api/auth/login", {
            method: "POST",
            body: { identity: form.get("identity"), password: form.get("password") },
          });
      onAuthenticated(data.token, data.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-art">
        <Logo />
        <div className="auth-orbit">
          <div className="orbit orbit-1" />
          <div className="orbit orbit-2" />
          <div className="orbit-center"><Disc3 size={36} /></div>
          {["KICK", "FLIP", "CHOP", "BASS"].map((word, index) => (
            <span key={word} className={`orbit-label orbit-label-${index + 1}`}>{word}</span>
          ))}
        </div>
        <div className="auth-statement">
          <span className="eyebrow">Один трек. Десять продюсеров.</span>
          <h1>Услышим, кто<br />сделает <em>лучше.</em></h1>
          <p>Система найдёт соперников твоего уровня и выдаст всем один случайный трек для сэмплирования.</p>
        </div>
        <div className="auth-proof">
          <span><Users size={15} /> 10 игроков</span>
          <span><Clock3 size={15} /> 30 минут</span>
          <span><Trophy size={15} /> Рейтинг MMR</span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-box">
          <div className="mobile-logo"><Logo /></div>
          <span className="eyebrow">{mode === "register" ? "Новый игрок" : "С возвращением"}</span>
          <h2>{mode === "register" ? "Создать аккаунт" : "Войти в аккаунт"}</h2>
          <p>{mode === "register" ? "Начни калибровку и найди первый матч." : "Продолжи свой путь в рейтинге."}</p>
          <div className="auth-tabs">
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Регистрация</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Вход</button>
          </div>
          <form onSubmit={submit}>
            {mode === "register" ? (
              <>
                <label>Email<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
                <label>Никнейм<input name="username" autoComplete="username" placeholder="yourbeatname" minLength={3} required /></label>
              </>
            ) : (
              <label>Email или ник<input name="identity" autoComplete="username" placeholder="you@example.com" required /></label>
            )}
            <label>Пароль<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Минимум 8 символов" minLength={8} required /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button auth-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : mode === "register" ? "Создать аккаунт" : "Войти"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <small className="legal-copy">Продолжая, ты принимаешь правила платформы и подтверждаешь права на загружаемую музыку.</small>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  user,
  onNavigate,
  onLogout,
}: {
  page: Page;
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}) {
  const nav = [
    { id: "match" as Page, label: "Найти матч", icon: Gamepad2 },
    { id: "leaderboard" as Page, label: "Рейтинг", icon: BarChart3 },
    { id: "profile" as Page, label: "Профиль", icon: UserRound },
  ];
  return (
    <aside className="sidebar">
      <Logo />
      <nav>
        {nav.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => onNavigate(item.id)}><Icon size={19} /><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="calibration-card">
        <span className="eyebrow"><Zap size={12} /> Калибровка</span>
        <strong>{user.calibrationGames} из 5 матчей</strong>
        <div className="progress"><i style={{ width: `${Math.min(100, user.calibrationGames * 20)}%` }} /></div>
        <p>Рейтинг откроется после пяти завершённых матчей.</p>
      </div>
      <button className="sidebar-user" onClick={() => onNavigate("profile")}>
        <Avatar user={user} />
        <span><strong>{user.displayName}</strong><small>@{user.username}</small></span>
        <Pencil size={14} />
      </button>
      <button className="logout-button" onClick={onLogout}><LogOut size={15} /> Выйти</button>
    </aside>
  );
}

function Topbar({ page, user, onMenu }: { page: Page; user: User; onMenu: () => void }) {
  const content = {
    match: ["Matchmaking", "Собери лобби и получи общий сэмпл"],
    leaderboard: ["Рейтинг", "Таблица лучших продюсеров"],
    profile: ["Профиль", "Твоя публичная карточка"],
  };
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu}><Menu size={21} /></button>
      <div><h1>{content[page][0]}</h1><p>{content[page][1]}</p></div>
      <div className="topbar-user"><span>Сезон 01</span><Avatar user={user} size="small" /></div>
    </header>
  );
}

function useCountdown(deadline: string) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(deadline).getTime() - Date.now()));
  useEffect(() => {
    const calculateRemaining = () => Math.max(0, new Date(deadline).getTime() - Date.now());
    setRemaining(calculateRemaining());
    const timer = window.setInterval(() => setRemaining(calculateRemaining()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    remaining,
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}

function MatchFound({
  match,
  user,
  token,
  onMatchUpdate,
}: {
  match: Match;
  user: User;
  token: string;
  onMatchUpdate: (match: Match) => void;
}) {
  const countdown = useCountdown(match.submissionDeadline);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectFile(nextFile?: File) {
    setUploadError("");
    if (!nextFile) return;
    const extensionAllowed = /\.(mp3|wav)$/i.test(nextFile.name);
    if (!extensionAllowed || !nextFile.type.startsWith("audio/")) {
      setUploadError("Выбери аудиофайл MP3 или WAV");
      return;
    }
    if (nextFile.size > 30 * 1024 * 1024) {
      setUploadError("Файл больше 30 МБ");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function submitBeat() {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadBeat<{ match: Match }>(
        `/api/matches/${match.id}/submission`,
        token,
        file,
      );
      onMatchUpdate(result.match);
      setUploaded(true);
    } catch (requestError) {
      setUploadError(requestError instanceof Error ? requestError.message : "Не удалось загрузить бит");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="match-found">
      <div className="match-found-head">
        <div>
          <span className="live-pill"><i /> {match.status === "voting" ? "Голосование" : "Матч найден"}</span>
          <h2>{match.status === "voting" ? "Работы приняты" : "Комната готова"}</h2>
          <p>{match.status === "voting" ? "Продакшн завершён — начинается оценка работ." : "У всех один трек. Успей сделать и загрузить бит за 30 минут."}</p>
        </div>
        <div className="room-code"><span>Комната</span><strong>#{match.id.slice(0, 6).toUpperCase()}</strong></div>
      </div>
      <div className="match-layout">
        <section className="sample-card">
          <div className="youtube-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${match.sample.youtubeId}`}
              title={match.sample.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="sample-info">
            <span className="youtube-icon"><Youtube size={20} /></span>
            <div><span className="eyebrow">Трек для сэмплирования</span><h3>{match.sample.title}</h3><p>{match.sample.channel}</p></div>
            <a href={`https://www.youtube.com/watch?v=${match.sample.youtubeId}`} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>
          </div>
          <div className="sample-warning"><ShieldCheck size={16} /><span>Перед публичным релизом проверь лицензию исходного трека. Матч предназначен для творческого соревнования.</span></div>
        </section>
        <aside className="players-card">
          <div className="players-heading"><span><Users size={17} /> Игроки</span><strong>{match.players.length}/10</strong></div>
          <div className="player-list">
            {match.players.map((player) => (
              <div className={player.id === user.id ? "current" : ""} key={player.id}>
                <span className="player-slot">{String(player.slot).padStart(2, "0")}</span>
                <Avatar user={player} size="small" />
                <span>
                  <strong>{player.displayName}{player.id === user.id && " (ты)"}</strong>
                  <small>{player.submitted ? "Работа загружена" : player.calibrationGames < 5 ? `Калибровка ${player.calibrationGames}/5` : `${player.rating} MMR`}</small>
                </span>
                {player.submitted ? <Check size={14} /> : <Clock3 className="waiting-icon" size={13} />}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="match-actions">
        <div className={countdown.remaining === 0 ? "deadline expired" : "deadline"}>
          <Clock3 size={18} />
          <span><small>До закрытия загрузки</small><strong>{match.status === "production" ? countdown.label : "00:00"}</strong></span>
        </div>
        {match.status === "production" && (
          <button className="primary-button" disabled={countdown.remaining === 0} onClick={() => { setUploadOpen(true); setUploaded(false); }}>
            {match.submission ? <Check size={17} /> : <Upload size={17} />}
            {match.submission ? "Заменить бит" : "Загрузить бит"}
          </button>
        )}
      </div>
      {uploadOpen && (
        <div className="modal-backdrop" onMouseDown={() => !uploading && setUploadOpen(false)}>
          <section className="upload-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" disabled={uploading} onClick={() => setUploadOpen(false)}><X size={20} /></button>
            {uploaded ? (
              <div className="upload-success-state">
                <span className="upload-icon success"><Check size={24} /></span>
                <span className="eyebrow">Работа на сервере</span>
                <h2>Бит загружен</h2>
                <p>Ты остаёшься в матче. До дедлайна файл можно заменить.</p>
                <button className="primary-button" onClick={() => setUploadOpen(false)}>Готово</button>
              </div>
            ) : (
              <>
                <span className="upload-icon"><Upload size={23} /></span>
                <span className="eyebrow">{match.submission ? "Замена работы" : "Submission"}</span>
                <h2>Загрузить бит</h2>
                <p className="upload-description">MP3 или WAV · до 30 МБ. После <strong>{countdown.label}</strong> загрузка закроется автоматически.</p>
                <label className={file ? "audio-dropzone selected" : "audio-dropzone"}>
                  <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" onChange={(event) => selectFile(event.target.files?.[0])} />
                  {file ? <Music2 size={27} /> : <Upload size={27} />}
                  <strong>{file?.name ?? "Выбрать MP3 или WAV"}</strong>
                  <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} МБ` : "Нажми, чтобы выбрать файл"}</span>
                </label>
                {previewUrl && <audio className="audio-preview" src={previewUrl} controls />}
                {uploadError && <div className="form-error">{uploadError}</div>}
                <button className="primary-button upload-submit" disabled={!file || uploading || countdown.remaining === 0} onClick={submitBeat}>
                  {uploading ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
                  {uploading ? "Загружаем…" : match.submission ? "Заменить файл" : "Отправить работу"}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MatchmakingPage({ token, user }: { token: string; user: User }) {
  const [queue, setQueue] = useState<QueueStatus>({ status: "idle", count: 0, required: 10 });
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let mounted = true;
    api<{ match: Match | null }>("/api/matches/current", { token })
      .then((result) => mounted && setMatch(result.match))
      .catch(() => undefined);

    const socket = io(API_ORIGIN || undefined, { auth: { token } });
    socketRef.current = socket;
    socket.on("queue:update", (status: QueueStatus) => setQueue(status));
    socket.on("match:found", (nextMatch: Match) => {
      setMatch(nextMatch);
      setQueue({ status: "idle", count: 0, required: 10 });
    });
    socket.on("match:update", (nextMatch: Match) => setMatch(nextMatch));
    socket.on("match:kicked", (payload: { reason: string }) => {
      setMatch(null);
      setError(payload.reason);
    });
    socket.on("match:cancelled", (payload: { reason: string }) => {
      setMatch(null);
      setError(payload.reason);
    });
    socket.on("connect_error", () => setError("Нет соединения с сервером matchmaking"));
    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [token]);

  function joinQueue() {
    setError("");
    setQueue({ status: "queued", count: 1, required: 10, position: 1 });
    socketRef.current?.emit("queue:join", (result: { ok: boolean; match?: Match }) => {
      if (result.match) setMatch(result.match);
    });
  }

  function leaveQueue() {
    socketRef.current?.emit("queue:leave");
    setQueue({ status: "idle", count: 0, required: 10 });
  }

  async function fillDemo() {
    try {
      const result = await api<{ match: Match }>("/api/dev/fill-match", { method: "POST", token });
      setMatch(result.match);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось создать тестовый матч");
    }
  }

  if (match) return <MatchFound match={match} user={user} token={token} onMatchUpdate={setMatch} />;

  if (queue.status === "queued") {
    return (
      <div className="queue-page">
        <div className="queue-visual">
          <div className="radar-ring radar-ring-1" />
          <div className="radar-ring radar-ring-2" />
          <div className="radar-ring radar-ring-3" />
          <span className="radar-beam" />
          <div className="queue-center"><LoaderCircle className="spin-slow" size={34} /><span>Поиск</span></div>
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} className={`found-dot found-dot-${index + 1} ${index < queue.count ? "filled" : ""}`}>{index < queue.count ? <Check size={12} /> : index + 1}</span>
          ))}
        </div>
        <span className="eyebrow">Подбираем игроков твоего уровня</span>
        <h2>Ищем матч…</h2>
        <p>Не закрывай страницу. Как только соберутся десять продюсеров, сервер создаст комнату и выберет трек.</p>
        <div className="queue-count"><strong>{queue.count}</strong><span>/ {queue.required}</span><small>игроков найдено</small></div>
        {error && <div className="form-error">{error}</div>}
        <div className="queue-buttons">
          <button className="secondary-button" onClick={leaveQueue}>Отменить поиск</button>
          <button className="demo-button" onClick={fillDemo}><Sparkles size={15} /> Заполнить тестовыми игроками</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-page">
      <section className="find-match-card">
        <div className="find-copy">
          <span className="eyebrow"><Radio size={13} /> Онлайн matchmaking</span>
          <h2>Найди девять соперников.<br /><em>Сэмпл решит остальное.</em></h2>
          <p>Сервер соберёт десять игроков, выберет один случайный музыкальный YouTube-трек и откроет комнату на 30 минут.</p>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button find-button" onClick={joinQueue}><Search size={20} /> Найти матч</button>
          <span className="online-note"><i /> Сервер работает · ожидаемый поиск 1–3 мин</span>
        </div>
        <div className="lobby-art">
          <div className="record record-back"><span /></div>
          <div className="record record-front"><span><Disc3 size={32} /></span></div>
          <div className="sample-ticket"><Youtube size={20} /><span><small>СЛУЧАЙНЫЙ ТРЕК</small><strong>Откроется после поиска</strong></span></div>
        </div>
      </section>
      <div className="how-grid">
        {[
          [Search, "01", "Найди матч", "Нажми одну кнопку — система подберёт девять игроков."],
          [Youtube, "02", "Получи трек", "Один случайный трек с YouTube для всех участников."],
          [Music2, "03", "Сделай бит", "Загрузи свою интерпретацию в течение 30 минут."],
          [Trophy, "04", "Получи MMR", "Оцени работы соперников и узнай итоговое место."],
        ].map(([Icon, number, title, text]) => {
          const StepIcon = Icon as typeof Search;
          return <article key={String(number)}><span className="step-number">{String(number)}</span><StepIcon size={20} /><h3>{String(title)}</h3><p>{String(text)}</p></article>;
        })}
      </div>
      <div className="rules-strip"><ShieldCheck size={18} /><span><strong>Честная игра:</strong> имена авторов скрыты до результатов, себя оценивать нельзя, порядок работ перемешивается.</span></div>
    </div>
  );
}

function ProfilePage({ token, user, onUpdate }: { token: string; user: User; onUpdate: (user: User) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [avatarData, setAvatarData] = useState(user.avatarData);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function pickAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_000_000) {
      setStatus("Выбери изображение размером до 1 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarData(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const result = await api<{ user: User }>("/api/me", {
        method: "PATCH",
        token,
        body: { displayName, bio, location, avatarData },
      });
      onUpdate(result.user);
      setStatus("Профиль сохранён");
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <section className="profile-preview">
        <div className="profile-cover"><span>MAKE NOISE.<br />STAY HUMAN.</span></div>
        <div className="profile-identity">
          <div className="avatar-editor"><Avatar user={{ displayName, avatarData }} size="large" /><label><Camera size={16} /><input type="file" accept="image/*" onChange={(event) => pickAvatar(event.target.files?.[0])} /></label></div>
          <div><span className="eyebrow">{user.calibrationGames < 5 ? `Калибровка ${user.calibrationGames}/5` : `${user.rating} MMR`}</span><h2>{displayName}</h2><p>@{user.username}{location && ` · ${location}`}</p></div>
        </div>
        <p className="profile-bio-preview">{bio || "Добавь био — расскажи, какой звук ты ищешь."}</p>
      </section>
      <form className="profile-form" onSubmit={save}>
        <div className="form-heading"><div><span className="eyebrow">Настройки</span><h3>Редактировать профиль</h3></div><Pencil size={19} /></div>
        <label>Отображаемое имя<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required /></label>
        <label>Никнейм<input value={`@${user.username}`} disabled /></label>
        <label>Город<div className="input-icon"><LocateFixed size={16} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Алматы" maxLength={60} /></div></label>
        <label>О себе<textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Продюсер, жанры, любимое железо…" maxLength={240} /><small>{bio.length}/240</small></label>
        {status && <div className={status === "Профиль сохранён" ? "form-success" : "form-error"}>{status}</div>}
        <button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Сохранить изменения</button>
      </form>
    </div>
  );
}

function LeaderboardPage({ token, currentUser }: { token: string; currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    api<{ users: User[] }>("/api/leaderboard", { token }).then((result) => setUsers(result.users)).catch(() => undefined);
  }, [token]);
  const rows = useMemo(() => users.length ? users : [currentUser], [users, currentUser]);
  return (
    <div className="leaderboard-page">
      <section className="season-banner"><div><span className="eyebrow">Сезон 01</span><h2>FIRST FLIP</h2><p>Заверши калибровку и поднимайся в рейтинге.</p></div><Trophy size={64} /></section>
      <div className="leaderboard">
        <div className="leader-head"><span>#</span><span>Продюсер</span><span>Матчи</span><span>Победы</span><span>MMR</span></div>
        {rows.map((entry, index) => (
          <div className={entry.id === currentUser.id ? "leader-row current" : "leader-row"} key={entry.id}>
            <strong>{index + 1}</strong>
            <div><Avatar user={entry} size="small" /><span><strong>{entry.displayName}</strong><small>@{entry.username}</small></span></div>
            <span>{entry.battles}</span><span>{entry.wins}</span>
            <strong>{entry.calibrationGames < 5 ? "••••" : entry.rating}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductApp({
  token,
  user,
  onUserUpdate,
  onLogout,
}: {
  token: string;
  user: User;
  onUserUpdate: (user: User) => void;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<Page>("match");
  const [mobileMenu, setMobileMenu] = useState(false);
  return (
    <div className="app-shell">
      <div className={mobileMenu ? "mobile-overlay open" : "mobile-overlay"} onClick={() => setMobileMenu(false)} />
      <div className={mobileMenu ? "sidebar-wrap open" : "sidebar-wrap"}>
        <button className="mobile-close" onClick={() => setMobileMenu(false)}><X size={20} /></button>
        <Sidebar page={page} user={user} onNavigate={(next) => { setPage(next); setMobileMenu(false); }} onLogout={onLogout} />
      </div>
      <main>
        <Topbar page={page} user={user} onMenu={() => setMobileMenu(true)} />
        <div className="page-content">
          {page === "match" && <MatchmakingPage token={token} user={user} />}
          {page === "leaderboard" && <LeaderboardPage token={token} currentUser={user} />}
          {page === "profile" && <ProfilePage token={token} user={user} onUpdate={onUserUpdate} />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>("/api/me", { token })
      .then((result) => setUser(result.user))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
      })
      .finally(() => setLoading(false));
  }, [token]);

  function authenticated(nextToken: string, nextUser: User) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", token });
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setUser(null);
    }
  }

  if (loading) return <div className="splash"><Logo /><LoaderCircle className="spin" size={24} /></div>;
  if (!token || !user) return <AuthPage onAuthenticated={authenticated} />;
  return <ProductApp token={token} user={user} onUserUpdate={setUser} onLogout={logout} />;
}
