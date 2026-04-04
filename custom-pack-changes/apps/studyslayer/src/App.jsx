import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WINNING_SCORE = 5;
const QUESTION_TIME_SEC = 20;
const REVEAL_HOLD_MS = 4500;
const LEADERBOARD_HOLD_MS = 5000;
// ─── Supabase client ──────────────────────────────────────────────────────────
const sb = {
  headers: () => ({
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${sb._token || SUPABASE_ANON_KEY}`,
  }),
  _token: null,
  _userId: null,

  async signUp(email, password, username) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: { username } }),
    });
    const d = await r.json();
    if (d.access_token) { sb._token = d.access_token; sb._userId = d.user?.id; }
    return d;
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (d.access_token) { sb._token = d.access_token; sb._userId = d.user?.id; }
    return d;
  },

  async signOut() {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: sb.headers() });
    sb._token = null; sb._userId = null;
  },

  async query(table, params = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: { ...sb.headers(), Prefer: "return=representation" },
    });
    return r.json();
  },

  async insert(table, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...sb.headers(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.json();
  },

  async update(table, params, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      method: "PATCH",
      headers: { ...sb.headers(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return r.json();
  },

  async rpc(fn, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: sb.headers(),
      body: JSON.stringify(body),
    });
    return r.json();
  },
};

// ─── Polymarket API ───────────────────────────────────────────────────────────
// `tag` = our UI / stored category id. `gammaSlug` = Polymarket Gamma `tag_slug` (must match their browse tags).
const POLY_CATEGORIES = [
  { tag: "sports", name: "Sports", emoji: "\u26bd" },
  { tag: "nba", name: "NBA", emoji: "\ud83c\udfc0" },
  { tag: "nfl", name: "NFL", emoji: "\ud83c\udfc8" },
  { tag: "soccer", name: "Soccer", emoji: "\ud83c\udfdf\ufe0f" },
  { tag: "politics", name: "Politics", emoji: "\ud83c\udfdb\ufe0f" },
  { tag: "us-politics", name: "U.S. Politics", emoji: "\ud83c\uddfa\ud83c\uddf8" },
  { tag: "elections", name: "Elections", emoji: "\ud83d\uddf3\ufe0f" },
  { tag: "geopolitics", name: "Geopolitics", emoji: "\ud83c\udf0d" },
  { tag: "crypto", name: "Crypto", emoji: "\u20bf" },
  { tag: "crypto-prices", name: "Crypto prices", emoji: "\ud83d\udcb1" },
  { tag: "pop-culture", name: "Pop Culture", emoji: "\ud83c\udfac" },
  { tag: "music", name: "Music", emoji: "\ud83c\udfb5" },
  { tag: "movies", name: "Movies", emoji: "\ud83c\udf7f" },
  { tag: "youtube", name: "YouTube", emoji: "\u25b6\ufe0f" },
  { tag: "business", name: "Business", emoji: "\ud83d\udcbc" },
  { tag: "finance", name: "Finance", emoji: "\ud83c\udfe6" },
  { tag: "economy", name: "Economy", emoji: "\ud83d\udcc8" },
  { tag: "stocks", name: "Stocks", emoji: "\ud83d\udcc9" },
  { tag: "fed", name: "Fed & rates", emoji: "\ud83d\udcb8" },
  { tag: "commodities", name: "Commodities", emoji: "\ud83d\udee2\ufe0f" },
  { tag: "science", gammaSlug: "tech", name: "Science & Tech", emoji: "\ud83d\udd2c" },
  { tag: "ai", name: "AI", emoji: "\ud83e\udd16" },
  { tag: "space", name: "Space", emoji: "\ud83d\udef0\ufe0f" },
  { tag: "climate", name: "Climate", emoji: "\ud83c\udf21\ufe0f" },
  { tag: "weather", name: "Weather", emoji: "\u26c8\ufe0f" },
  { tag: "health", name: "Health", emoji: "\u2695\ufe0f" },
  { tag: "esports", name: "Esports", emoji: "\ud83c\udfae" },
  { tag: "chess", name: "Chess", emoji: "\u265f\ufe0f" },
];

function gammaTagSlugForUiCategory(uiTag) {
  const row = POLY_CATEGORIES.find((c) => c.tag === uiTag);
  return row?.gammaSlug ?? row?.tag ?? uiTag;
}

const GAMMA_ORIGIN = "https://gamma-api.polymarket.com";

async function polyFetch(url) {
  // In `vite` dev, use same-origin proxy (see vite.config.js) — avoids CORS entirely.
  const primary =
    import.meta.env.DEV && url.startsWith(GAMMA_ORIGIN)
      ? "/polymarket-api" + url.slice(GAMMA_ORIGIN.length)
      : url;

  try {
    const res = await fetch(primary);
    if (res.ok) return res.json();
  } catch {
    /* CORS or network */
  }

  // Production / preview: public CORS proxies (corsproxy.io often 403s Polymarket).
  const encoded = encodeURIComponent(url);
  const fallbacks = [
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://corsproxy.io/?${encoded}`,
  ];
  for (const proxyUrl of fallbacks) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) return res.json();
    } catch {
      /* try next */
    }
  }
  throw new Error("Failed to fetch from Polymarket");
}

function parseOutcomePrices(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number);
  try { return JSON.parse(raw).map(Number); } catch { return []; }
}

/** Strip a leading "Predict:" so the UI can always render a literal `Predict: ` prefix (avoids duplicates). */
function stripLeadingPredictLabel(text) {
  return String(text ?? "")
    .trim()
    .replace(/^Predict:\s*/i, "")
    .trim();
}

/**
 * Title shown during the game. Always includes the visible "Predict: " prefix.
 * Supports both `question_text` (PostgREST default) and `questionText` if the client ever maps keys.
 */
function getQuestionDisplayTitle(row) {
  const raw = row?.question_text ?? row?.questionText ?? "";
  const body = stripLeadingPredictLabel(raw);
  return body ? `Predict: ${body}` : "Predict:";
}

function withPredictLabel(text) {
  const body = stripLeadingPredictLabel(text);
  return body ? `Predict: ${body}` : "Predict:";
}

function eventToQuestion(event, tag) {
  if (!event?.markets?.length) return null;

  if (event.markets.length >= 3) {
    // Gamma returns markets in arbitrary order — take the four highest implied probabilities (Yes price).
    const scored = event.markets
      .map((m) => {
        const prices = parseOutcomePrices(m.outcomePrices);
        const prob = prices[0] ?? 0;
        const label =
          m.groupItemTitle || m.question?.replace(/^Will\s+/i, "").replace(/\?$/, "") || "Unknown";
        return { label, prob };
      })
      .filter((x) => x.label && x.label !== "Unknown");

    scored.sort((a, b) => b.prob - a.prob || String(a.label).localeCompare(String(b.label)));

    const top = scored.slice(0, 4);
    const options = top.map((x) => x.label);
    const probabilities = top.map((x) => x.prob);
    if (options.length < 2) return null;
    const topIdx = probabilities.indexOf(Math.max(...probabilities));
    return {
      question: withPredictLabel(event.title),
      options,
      probabilities,
      correct: topIdx,
      category: tag,
      source: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
    };
  }

  if (event.markets.length === 1) {
    const market = event.markets[0];
    const prices = parseOutcomePrices(market.outcomePrices);
    const yesProb = prices[0] || 0.5;
    const noProb = prices[1] || (1 - yesProb);
    return {
      question: withPredictLabel(event.title || market.question),
      options: ["Yes", "No"],
      probabilities: [yesProb, noProb],
      correct: yesProb >= noProb ? 0 : 1,
      category: tag,
      source: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
    };
  }

  return null;
}

/** Top-volume events from Gamma, then random `count` questions for one category tag. */
async function fetchPolymarketQuestions(tag, count = 5) {
  const poolLimit = 50;
  const slug = gammaTagSlugForUiCategory(tag);
  try {
    // Gamma expects `tag_slug`, not `tag`. Using `tag=` returns mostly global trending (wrong category).
    const events = await polyFetch(
      `${GAMMA_ORIGIN}/events?tag_slug=${encodeURIComponent(slug)}&closed=false&active=true&limit=${poolLimit}&order=volume24hr&ascending=false`
    );
    if (!Array.isArray(events)) return [];

    const candidates = [];
    for (const event of events) {
      const q = eventToQuestion(event, tag);
      if (q) candidates.push(q);
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    return candidates.slice(0, count);
  } catch (err) {
    console.warn(`Failed to fetch ${tag} from Polymarket:`, err);
    return [];
  }
}

// ─── Gemini API ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const CUSTOM_STYLES = [
  { id: "funny", label: "Funny", emoji: "😂" },
  { id: "kid-friendly", label: "Kid-Friendly", emoji: "🧒" },
  { id: "for-friends", label: "For Friends", emoji: "👯" },
  { id: "for-family", label: "For Family", emoji: "👨‍👩‍👧" },
  { id: "educational", label: "Educational", emoji: "📚" },
  { id: "spicy", label: "Spicy", emoji: "🌶️" },
];

async function fetchGeminiQuestions(settings, playerNames = []) {
  const { numQuestions, style } = settings;
  const styleLabel = CUSTOM_STYLES.find(s => s.id === style)?.label || style;
  const namesLine =
    settings.includeNames && playerNames.length
      ? `Some questions should reference or be personalized to these players by name: ${playerNames.join(", ")}.`
      : "";

  const prompt = `Generate ${numQuestions} fun trivia/prediction questions for a multiplayer party game.
Style: ${styleLabel}
${namesLine}

Return a JSON array of exactly ${numQuestions} objects. Each object MUST have:
- "question": string (the question text, keep it concise)
- "options": array of exactly 4 answer choices (strings, keep each short)
- "correct": number (0-3, index of the best/most likely answer)
- "probabilities": array of 4 numbers between 0 and 1 that sum to approximately 1.0 (reflecting likelihood of each answer)

Make questions varied, fun, and appropriate for the "${styleLabel}" style. Only return the raw JSON array — no markdown, no code block, no explanation.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return parsed.map(q => ({
    question: withPredictLabel(q.question),
    options: q.options,
    probabilities: q.probabilities,
    correct: q.correct,
    category: "custom",
    source: null,
  }));
}

// ─── Avatar colors ────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#00bcd4","#ff5722"];
const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : "??";

// ─── Styles ───────────────────────────────────────────────────────────────────
const G = {
  bg: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  card: { background: "rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "1.5rem" },
  input: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "10px 14px", color: "#fff", width: "100%", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btn: { borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer", border: "none", transition: "all 0.2s" },
  btnPrimary: { background: "linear-gradient(135deg, #667eea, #764ba2)", color: "#fff" },
  btnDanger: { background: "linear-gradient(135deg, #e74c3c, #c0392b)", color: "#fff" },
  btnGhost: { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" },
  text: { color: "#fff" },
  muted: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" },
};

// ─── Components ───────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color || "#667eea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#667eea", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />;
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const colors = { error: "#e74c3c", success: "#2ecc71", info: "#3498db" };
  return (
    <div style={{ position: "fixed", top: 20, right: 20, background: colors[type] || "#333", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 9999, maxWidth: 320, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
      {msg}
    </div>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth, toast }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !username)) return toast("Fill in all fields", "error");
    setLoading(true);
    try {
      let res;
      if (mode === "signup") {
        res = await sb.signUp(email, password, username);
        if (res.error) return toast(res.error.message || "Sign up failed", "error");
        if (res.access_token) onAuth({ id: sb._userId, email, username });
        else toast("Check your email to confirm your account", "info");
      } else {
        res = await sb.signIn(email, password);
        if (res.error) return toast(res.error.message || "Sign in failed", "error");
        const profile = await sb.query("profiles", `?id=eq.${sb._userId}`);
        onAuth({ id: sb._userId, email, username: profile[0]?.username || email, avatar_color: profile[0]?.avatar_color });
      }
    } catch { toast("Network error", "error"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
      <div style={{ width: 400, maxWidth: "90vw" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 56, animation: "float 3s ease-in-out infinite" }}>{"\ud83c\udfb0"}</div>
          <h1 style={{ ...G.text, fontSize: 32, fontWeight: 800, margin: "0.5rem 0 0.25rem", letterSpacing: "-0.02em" }}>StudySlayer</h1>
          <p style={G.muted}>Predict the market. Beat your friends.</p>
        </div>
        <div style={G.card}>
          <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
            {["signin","signup"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ ...G.btn, flex: 1, ...(mode === m ? G.btnPrimary : G.btnGhost) }}>
                {m === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
          {mode === "signup" && (
            <div style={{ marginBottom: 12 }}>
              <label style={G.label}>Username</label>
              <input style={G.input} placeholder="predictor42" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={G.label}>Email</label>
            <input style={G.input} type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={G.label}>Password</label>
            <input style={G.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{ ...G.btn, ...G.btnPrimary, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <Spinner /> : (mode === "signin" ? "Enter the Arena" : "Join the Game")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOBBY SCREEN ─────────────────────────────────────────────────────────────
function LobbyScreen({ user, onCreateRoom, onJoinRoom, onSignOut, toast }) {
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      let code, attempts = 0;
      while (attempts < 10) {
        const candidate = Math.random().toString(36).slice(2, 8).toUpperCase();
        const existing = await sb.query("rooms", `?code=eq.${candidate}`);
        if (!existing.length) { code = candidate; break; }
        attempts++;
      }
      const room = await sb.insert("rooms", { code, host_id: user.id, status: "lobby" });
      if (room.error || !room[0]) return toast(room[0]?.message || "Failed to create room", "error");
      await sb.insert("room_players", { room_id: room[0].id, player_id: user.id });
      onCreateRoom(room[0]);
    } catch { toast("Error creating room", "error"); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return toast("Enter a room code", "error");
    setLoading(true);
    try {
      const rooms = await sb.query("rooms", `?code=eq.${joinCode.toUpperCase()}&status=eq.lobby`);
      if (!rooms[0]) return toast("Room not found or game already started", "error");
      const existing = await sb.query("room_players", `?room_id=eq.${rooms[0].id}&player_id=eq.${user.id}`);
      if (!existing[0]) await sb.insert("room_players", { room_id: rooms[0].id, player_id: user.id });
      onJoinRoom(rooms[0]);
    } catch { toast("Error joining room", "error"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, fontFamily: "'Segoe UI', sans-serif", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{"\ud83c\udfb0"}</span>
            <div>
              <div style={{ ...G.text, fontWeight: 800, fontSize: 18 }}>StudySlayer</div>
              <div style={G.muted}>Main Lobby</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={user.username} color={user.avatar_color} />
            <div>
              <div style={{ ...G.text, fontWeight: 600, fontSize: 14 }}>{user.username}</div>
              <button onClick={onSignOut} style={{ ...G.muted, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>Sign out</button>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h2 style={{ ...G.text, fontSize: 28, fontWeight: 800, margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>Think you can predict the future?</h2>
          <p style={G.muted}>Pick categories, guess what the market thinks, and compete with friends</p>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={G.card}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{"\ud83d\ude80"}</div>
            <h3 style={{ ...G.text, margin: "0 0 0.5rem", fontWeight: 700 }}>Create a Room</h3>
            <p style={{ ...G.muted, marginBottom: "1.25rem" }}>Host a game and pick your prediction categories</p>
            <button onClick={handleCreate} disabled={loading} style={{ ...G.btn, ...G.btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <Spinner /> : "Create Room"}
            </button>
          </div>

          <div style={G.card}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{"\ud83d\udd17"}</div>
            <h3 style={{ ...G.text, margin: "0 0 0.5rem", fontWeight: 700 }}>Join a Room</h3>
            <p style={{ ...G.muted, marginBottom: "1.25rem" }}>Enter a 6-character room code from your friend</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...G.input, letterSpacing: "0.15em", fontWeight: 700, textTransform: "uppercase" }} placeholder="ENTER CODE" maxLength={6} value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleJoin()} />
              <button onClick={handleJoin} disabled={loading} style={{ ...G.btn, ...G.btnPrimary, whiteSpace: "nowrap" }}>Join</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOM SCREEN (Category Selection) ─────────────────────────────────────────
function RoomScreen({ user, room, onGameStart, onLeave, toast }) {
  const [players, setPlayers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [customPack, setCustomPack] = useState({ numQuestions: 5, style: "funny", includeNames: false });
  const [customPackReady, setCustomPackReady] = useState(false);
  const isHost = room.host_id === user.id;
  const pollRef = useRef();

  const refresh = useCallback(async () => {
    const p = await sb.query("room_players", `?room_id=eq.${room.id}&select=*,profiles(*)`);
    if (Array.isArray(p)) setPlayers(p);
    const roomData = await sb.query("rooms", `?id=eq.${room.id}`);
    if (roomData[0]?.status === "playing") onGameStart(roomData[0]);
  }, [room.id]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 3000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  const selectCategory = (tag) => {
    setSelectedCategory(prev => (prev === tag ? null : tag));
  };

  const startGame = async () => {
    if (!selectedCategory) return toast("Select a category", "error");
    if (selectedCategory === "custom" && !customPackReady) return toast("Save your custom pack settings first", "error");
    setGenerating(true);
    try {
      await sb.update("rooms", `?id=eq.${room.id}`, { status: "generating" });

      let questions;
      if (selectedCategory === "custom") {
        const playerNames = players.map(p => p.profiles?.username).filter(Boolean);
        questions = await fetchGeminiQuestions(customPack, playerNames);
      } else {
        questions = await fetchPolymarketQuestions(selectedCategory, 5);
        if (questions.length < 5) {
          throw new Error(
            questions.length === 0
              ? "No questions found. Try another category."
              : `Only ${questions.length} markets available — try another category.`
          );
        }
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await sb.insert("questions", {
          room_id: room.id,
          question_text: q.question,
          options: q.options,
          correct_answer: q.correct,
          explanation: JSON.stringify({ probabilities: q.probabilities, source: q.source, category: q.category }),
          question_order: i,
        });
      }

      // Reset all player scores to 0
      for (const p of players) {
        await sb.update("room_players", `?room_id=eq.${room.id}&player_id=eq.${p.player_id}`, { score: 0 });
      }

      const roundDeadline = new Date(Date.now() + QUESTION_TIME_SEC * 1000).toISOString();
      await sb.update("rooms", `?id=eq.${room.id}`, {
        status: "playing",
        current_question: 0,
        game_phase: "question",
        round_deadline: roundDeadline,
      });
      toast("Game starting!", "success");
    } catch (e) {
      toast("Failed to start: " + e.message, "error");
      await sb.update("rooms", `?id=eq.${room.id}`, { status: "lobby" });
    }
    finally { setGenerating(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, fontFamily: "'Segoe UI', sans-serif", padding: "1.5rem 1rem" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ ...G.text, fontWeight: 800, fontSize: 22 }}>Room Lobby</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ ...G.text, fontSize: 24, fontWeight: 800, letterSpacing: "0.1em", background: "linear-gradient(135deg,#667eea,#764ba2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{room.code}</span>
              <span style={G.muted}>Share this code with friends</span>
            </div>
          </div>
          <button onClick={onLeave} style={{ ...G.btn, ...G.btnGhost, fontSize: 13 }}>{"\u2190"} Leave</button>
        </div>

        {/* Players */}
        <div style={{ ...G.card, marginBottom: "1rem" }}>
          <div style={{ ...G.muted, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.1em" }}>Players ({players.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {players.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 8 }}>
                <Avatar name={p.profiles?.username} color={p.profiles?.avatar_color} size={28} />
                <span style={{ ...G.text, fontWeight: 600, fontSize: 13 }}>{p.profiles?.username}</span>
                {p.player_id === room.host_id && <span style={{ fontSize: 11 }}>{"\ud83d\udc51"}</span>}
              </div>
            ))}
            {players.length === 0 && <div style={G.muted}>Waiting for players...</div>}
          </div>
        </div>

        {/* Category Selection */}
        {isHost && (
          <>
            <div style={{ ...G.card, marginBottom: "1rem" }}>
              <div style={{ ...G.muted, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.1em" }}>Choose Category</div>
              <p style={{ ...G.muted, marginBottom: 16 }}>Pick a Polymarket category for 5 real prediction questions, or build a Custom Pack with AI.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10 }}>
                {POLY_CATEGORIES.map(cat => {
                  const isSelected = selectedCategory === cat.tag;
                  return (
                    <button
                      key={cat.tag}
                      onClick={() => selectCategory(cat.tag)}
                      style={{
                        background: isSelected ? "rgba(102,126,234,0.3)" : "rgba(255,255,255,0.06)",
                        border: isSelected ? "2px solid #667eea" : "2px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        padding: "16px 12px",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>{cat.emoji}</div>
                      <div style={{ ...G.text, fontWeight: 600, fontSize: 13 }}>{cat.name}</div>
                    </button>
                  );
                })}
                {/* Custom Pack option */}
                {(() => {
                  const isSelected = selectedCategory === "custom";
                  return (
                    <button
                      onClick={() => selectCategory("custom")}
                      style={{
                        background: isSelected ? "rgba(118,75,162,0.35)" : "rgba(255,255,255,0.06)",
                        border: isSelected ? "2px solid #764ba2" : "2px dashed rgba(255,255,255,0.25)",
                        borderRadius: 12,
                        padding: "16px 12px",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>✨</div>
                      <div style={{ ...G.text, fontWeight: 600, fontSize: 13 }}>Custom Pack</div>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Custom Pack Configuration */}
            {selectedCategory === "custom" && (
              <div style={{ ...G.card, marginBottom: "1rem", border: customPackReady ? "1px solid rgba(118,75,162,0.6)" : "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ ...G.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✨ Custom Pack</div>
                <div style={{ ...G.muted, marginBottom: 16 }}>AI will generate your questions based on these settings.</div>

                {/* Number of questions */}
                <div style={{ marginBottom: 16 }}>
                  <label style={G.label}>Number of Questions: {customPack.numQuestions}</label>
                  <input
                    type="range" min={3} max={15} step={1}
                    value={customPack.numQuestions}
                    onChange={e => { setCustomPack(p => ({ ...p, numQuestions: Number(e.target.value) })); setCustomPackReady(false); }}
                    style={{ width: "100%", accentColor: "#764ba2", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={G.muted}>3</span><span style={G.muted}>15</span>
                  </div>
                </div>

                {/* Style pills */}
                <div style={{ marginBottom: 16 }}>
                  <label style={G.label}>Style / Audience</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CUSTOM_STYLES.map(s => {
                      const active = customPack.style === s.id;
                      return (
                        <button key={s.id} onClick={() => { setCustomPack(p => ({ ...p, style: s.id })); setCustomPackReady(false); }}
                          style={{ ...G.btn, padding: "7px 14px", fontSize: 13, background: active ? "rgba(118,75,162,0.45)" : "rgba(255,255,255,0.07)", border: active ? "1px solid #764ba2" : "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>
                          {s.emoji} {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Include names toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "10px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
                  <div>
                    <div style={{ ...G.text, fontWeight: 600, fontSize: 13 }}>Include Player Names</div>
                    <div style={{ ...G.muted }}>AI will personalize some questions with player names</div>
                  </div>
                  <div
                    onClick={() => { setCustomPack(p => ({ ...p, includeNames: !p.includeNames })); setCustomPackReady(false); }}
                    style={{ width: 44, height: 24, borderRadius: 12, background: customPack.includeNames ? "#764ba2" : "rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                  >
                    <div style={{ position: "absolute", top: 3, left: customPack.includeNames ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </div>
                </div>

                <button
                  onClick={() => setCustomPackReady(true)}
                  style={{ ...G.btn, background: "linear-gradient(135deg,#764ba2,#667eea)", color: "#fff", width: "100%", fontWeight: 700 }}
                >
                  {customPackReady ? "✓ Saved" : "Save Custom Pack"}
                </button>
              </div>
            )}

            <div style={G.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ ...G.text, fontWeight: 700, fontSize: 15 }}>First to {WINNING_SCORE} points wins!</div>
                  <div style={G.muted}>{selectedCategory === "custom" ? "Match the AI's best answer to score" : "Match the market's top pick to score"}</div>
                </div>
                <div style={{ ...G.text, fontSize: 28 }}>{"\ud83c\udfc6"}</div>
              </div>
              <button onClick={startGame} disabled={generating || !selectedCategory || (selectedCategory === "custom" && !customPackReady)}
                style={{ ...G.btn, background: "linear-gradient(135deg,#11998e,#38ef7d)", color: "#fff", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: (!selectedCategory || (selectedCategory === "custom" && !customPackReady)) ? 0.5 : 1 }}>
                {generating
                  ? <><Spinner />{selectedCategory === "custom" ? " Generating with AI..." : " Fetching predictions..."}</>
                  : selectedCategory === "custom"
                    ? `✨ Start Game (${customPack.numQuestions} questions)`
                    : "🎲 Start Game (5 questions)"}
              </button>
            </div>
          </>
        )}
        {!isHost && (
          <div style={{ ...G.card, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u23f3"}</div>
            <p style={G.muted}>Waiting for the host to pick a category and start the game...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GAME SCREEN (Kahoot-style: all answer or time up → reveal → leaderboard → next) ──
function GameScreen({ user, room, onGameEnd }) {
  const isHost = room.host_id === user.id;
  const onGameEndRef = useRef(onGameEnd);
  useEffect(() => { onGameEndRef.current = onGameEnd; }, [onGameEnd]);

  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(() => Number(room.current_question) || 0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [allAnswers, setAllAnswers] = useState({});
  const [players, setPlayers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SEC);
  const [phase, setPhase] = useState(room.game_phase || "question");
  const [roundDeadline, setRoundDeadline] = useState(room.round_deadline || null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});
  const [winner, setWinner] = useState(null);

  const finalizedRef = useRef(null);
  const revealTimeoutRef = useRef(null);
  const leaderboardTimeoutRef = useRef(null);
  const playersRef = useRef([]);
  const currentIdxRef = useRef(currentIdx);
  const questionsRef = useRef([]);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  useEffect(() => () => {
    clearTimeout(revealTimeoutRef.current);
    clearTimeout(leaderboardTimeoutRef.current);
  }, []);

  useEffect(() => {
    (async () => {
      const [qs, ps] = await Promise.all([
        sb.query("questions", `?room_id=eq.${room.id}&order=question_order.asc`),
        sb.query("room_players", `?room_id=eq.${room.id}&select=*,profiles(*)`),
      ]);
      if (Array.isArray(qs)) setQuestions(qs);
      if (Array.isArray(ps)) {
        setPlayers(ps);
        const sc = {};
        ps.forEach(p => { sc[p.player_id] = p.score || 0; });
        setScores(sc);
      }
      setLoading(false);
    })();
  }, [room.id]);

  const curQ = questions[currentIdx];

  const getQuestionMeta = (q) => {
    if (!q) return { probabilities: [], source: null, category: null };
    try {
      return JSON.parse(q.explanation);
    } catch {
      return { probabilities: [], source: null, category: null };
    }
  };

  const refreshAnswers = useCallback(async () => {
    if (!curQ) return;
    const ans = await sb.query("answers", `?question_id=eq.${curQ.id}`);
    if (Array.isArray(ans)) {
      const map = {};
      ans.forEach(a => { map[a.player_id] = a; });
      setAllAnswers(map);
    }
  }, [curQ?.id]);

  const refreshScores = useCallback(async () => {
    const ps = await sb.query("room_players", `?room_id=eq.${room.id}&select=*,profiles(*)`);
    if (Array.isArray(ps)) {
      setPlayers(ps);
      const sc = {};
      ps.forEach(p => { sc[p.player_id] = p.score || 0; });
      setScores(sc);
      const w = ps.find(p => (p.score || 0) >= WINNING_SCORE);
      if (w) setWinner(w);
    }
  }, [room.id]);

  const runAdvanceFromLeaderboard = useCallback(async () => {
    clearTimeout(revealTimeoutRef.current);
    clearTimeout(leaderboardTimeoutRef.current);
    const idx = currentIdxRef.current;
    const qlen = questionsRef.current.length;
    await refreshScores();
    const ps = await sb.query("room_players", `?room_id=eq.${room.id}&select=*`);
    const win = Array.isArray(ps) && ps.find(p => (p.score || 0) >= WINNING_SCORE);
    if (win) {
      await sb.update("rooms", `?id=eq.${room.id}`, { status: "finished" });
      onGameEndRef.current();
      return;
    }
    if (idx >= qlen - 1) {
      await sb.update("rooms", `?id=eq.${room.id}`, { status: "finished" });
      onGameEndRef.current();
      return;
    }
    const next = idx + 1;
    const deadline = new Date(Date.now() + QUESTION_TIME_SEC * 1000).toISOString();
    await sb.update("rooms", `?id=eq.${room.id}`, {
      current_question: next,
      game_phase: "question",
      round_deadline: deadline,
    });
    setCurrentIdx(next);
    setSelected(null);
    setAnswered(false);
    setAllAnswers({});
    setRoundDeadline(deadline);
    setPhase("question");
    finalizedRef.current = null;
  }, [room.id, refreshScores]);

  const finalizeQuestionRoundHost = useCallback(async () => {
    const cq = curQ;
    if (!cq) return;
    if (!playersRef.current.length) return;

    // No answer row => wrong (Kahoot). We do not insert stubs for other players (often blocked by RLS).
    await sb.update("rooms", `?id=eq.${room.id}`, { game_phase: "reveal" });
    await refreshAnswers();
    await refreshScores();
    setPhase("reveal");

    clearTimeout(revealTimeoutRef.current);
    clearTimeout(leaderboardTimeoutRef.current);

    revealTimeoutRef.current = setTimeout(async () => {
      await sb.update("rooms", `?id=eq.${room.id}`, { game_phase: "leaderboard" });
      setPhase("leaderboard");
      await refreshScores();
      leaderboardTimeoutRef.current = setTimeout(() => {
        void runAdvanceFromLeaderboard();
      }, LEADERBOARD_HOLD_MS);
    }, REVEAL_HOLD_MS);
  }, [curQ, room.id, refreshAnswers, refreshScores, runAdvanceFromLeaderboard]);

  // Sync timer from server deadline (all clients)
  useEffect(() => {
    if (phase !== "question" || !roundDeadline) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((new Date(roundDeadline).getTime() - Date.now()) / 1000));
      setTimeLeft(s);
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [phase, roundDeadline]);

  // Everyone: poll room row for phase / index / deadline
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await sb.query("rooms", `?id=eq.${room.id}`);
      const row = r[0];
      if (!row) return;
      if (row.status === "finished") {
        onGameEndRef.current();
        return;
      }
      if (row.round_deadline) setRoundDeadline(row.round_deadline);
      if (row.game_phase && ["question", "reveal", "leaderboard"].includes(row.game_phase)) {
        setPhase(row.game_phase);
      }
      const cqNum = row.current_question;
      if (typeof cqNum === "number" && cqNum !== currentIdxRef.current) {
        setCurrentIdx(cqNum);
        setSelected(null);
        setAnswered(false);
        setAllAnswers({});
        finalizedRef.current = null;
      }
    }, 800);
    return () => clearInterval(id);
  }, [room.id]);

  // Host: ensure first round has deadline + phase in DB (if missing)
  useEffect(() => {
    if (!isHost || loading || !curQ) return;
    (async () => {
      const r = await sb.query("rooms", `?id=eq.${room.id}`);
      const row = r[0];
      if (row?.round_deadline && row?.game_phase === "question") return;
      const deadline = new Date(Date.now() + QUESTION_TIME_SEC * 1000).toISOString();
      await sb.update("rooms", `?id=eq.${room.id}`, {
        current_question: currentIdxRef.current,
        game_phase: "question",
        round_deadline: deadline,
      });
      setRoundDeadline(deadline);
      setPhase("question");
    })();
  }, [isHost, loading, curQ?.id, room.id]);

  // Host: when everyone answered or time is up, lock round once
  useEffect(() => {
    if (!isHost || phase !== "question" || !curQ || loading) return;
    if (!playersRef.current.length) return;
    const qid = curQ.id;
    const iv = setInterval(async () => {
      try {
        const [ansRows, roomRows] = await Promise.all([
          sb.query("answers", `?question_id=eq.${qid}`),
          sb.query("rooms", `?id=eq.${room.id}`),
        ]);
        const n = Array.isArray(ansRows) ? ansRows.length : 0;
        const row = roomRows?.[0];
        const dl = row?.round_deadline ? new Date(row.round_deadline).getTime() : 0;
        const timedOut = dl > 0 && Date.now() >= dl;
        const allIn = n >= playersRef.current.length;
        if (!allIn && !timedOut) return;
        if (finalizedRef.current === qid) return;
        finalizedRef.current = qid;
        clearInterval(iv);
        await finalizeQuestionRoundHost();
      } catch (e) {
        console.warn(e);
      }
    }, 400);
    return () => clearInterval(iv);
  }, [isHost, phase, curQ?.id, loading, room.id, finalizeQuestionRoundHost]);

  useEffect(() => {
    if (!curQ) return;
    if (phase === "question") {
      const t = setInterval(refreshAnswers, 1000);
      return () => clearInterval(t);
    }
    if (phase === "reveal") refreshAnswers();
  }, [curQ?.id, phase, refreshAnswers]);

  useEffect(() => {
    if (phase === "reveal" || phase === "leaderboard") refreshScores();
  }, [phase, refreshScores]);

  const submitAnswer = async (optIdx) => {
    if (answered || phase !== "question") return;
    if (!curQ) return;
    setSelected(optIdx);
    setAnswered(true);
    const isCorrect = optIdx === curQ.correct_answer;
    await sb.insert("answers", {
      question_id: curQ.id,
      player_id: user.id,
      selected_option: optIdx,
      is_correct: isCorrect,
    });
    if (isCorrect) {
      const currentScore = scores[user.id] || 0;
      await sb.update("room_players", `?room_id=eq.${room.id}&player_id=eq.${user.id}`, { score: currentScore + 1 });
      setScores(prev => ({ ...prev, [user.id]: currentScore + 1 }));
    }
    refreshAnswers();
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!curQ) return null;

  const meta = getQuestionMeta(curQ);
  const options = Array.isArray(curQ.options) ? curQ.options : JSON.parse(curQ.options);
  const optionColors = ["#3498db","#e74c3c","#2ecc71","#f39c12"];
  const totalAnswered = Object.keys(allAnswers).length;
  const categoryInfo = POLY_CATEGORIES.find(c => c.tag === meta.category);

  const myRow = allAnswers[user.id];
  const myPickRaw = myRow?.selected_option;
  const myPick = myPickRaw !== undefined && myPickRaw !== null ? Number(myPickRaw) : selected;
  const missedRound = phase === "reveal" && !myRow;
  const pickedRight = !!myRow && myPick === curQ.correct_answer;
  const pickedWrong = !!myRow && myPick !== curQ.correct_answer;

  const podiumColors = ["#f1c40f","#bdc3c7","#cd7f32"];
  const medals = ["\ud83e\udd47","\ud83e\udd48","\ud83e\udd49"];
  const sortedPodium = [...players].sort((a, b) => (scores[b.player_id] || 0) - (scores[a.player_id] || 0));

  return (
    <div style={{ minHeight: "100vh", background: G.bg, fontFamily: "'Segoe UI', sans-serif", padding: "1.5rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {categoryInfo && <span style={{ fontSize: 18 }}>{categoryInfo.emoji}</span>}
            <span style={G.muted}>
              {phase === "leaderboard" ? "Leaderboard" : `Question ${currentIdx + 1} of ${questions.length}`}
            </span>
          </div>
          {phase === "question" && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ ...G.text, fontWeight: 800, fontSize: 22, color: timeLeft <= 5 ? "#e74c3c" : "#2ecc71" }}>{timeLeft}s</div>
              <div style={{ ...G.muted, fontSize: 12 }}>{totalAnswered}/{players.length} answered</div>
            </div>
          )}
          {phase === "reveal" && <div style={{ ...G.text, fontWeight: 700, fontSize: 14, color: "#2ecc71" }}>Answer reveal</div>}
          {phase === "leaderboard" && <div style={{ ...G.muted, fontSize: 13 }}>Next question in a moment...</div>}
        </div>

        {phase !== "leaderboard" && (
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
            {sortedPodium.map(p => (
              <div key={p.player_id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 20, border: p.player_id === user.id ? "1px solid rgba(102,126,234,0.5)" : "1px solid transparent" }}>
                <Avatar name={p.profiles?.username} color={p.profiles?.avatar_color} size={20} />
                <span style={{ ...G.text, fontSize: 12, fontWeight: 600 }}>{scores[p.player_id] || 0}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>/{WINNING_SCORE}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, marginBottom: "1.5rem" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg,#667eea,#764ba2)", borderRadius: 4, width: `${((currentIdx) / questions.length) * 100}%`, transition: "width 0.5s" }} />
        </div>

        {phase === "leaderboard" ? (
          <div style={G.card}>
            <div style={{ ...G.text, fontWeight: 800, fontSize: 22, marginBottom: 16, textAlign: "center" }}>{"\ud83c\udfc6"} Standings</div>
            {sortedPodium.map((p, i) => (
              <div key={p.player_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < sortedPodium.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <div style={{ fontSize: 22, width: 36 }}>{medals[i] || `#${i + 1}`}</div>
                <Avatar name={p.profiles?.username} color={p.profiles?.avatar_color} size={36} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ ...G.text, fontWeight: 700 }}>{p.profiles?.username}</div>
                  {p.player_id === user.id && <div style={{ fontSize: 11, color: "#667eea" }}>You</div>}
                </div>
                <div style={{ ...G.text, fontSize: 24, fontWeight: 800, color: podiumColors[i] || "#fff" }}>
                  {scores[p.player_id] || 0}
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>pts</span>
                </div>
              </div>
            ))}
            {winner && (
              <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(241,196,15,0.15)", borderRadius: 10, border: "1px solid rgba(241,196,15,0.3)", textAlign: "center" }}>
                <div style={{ ...G.text, fontWeight: 800, fontSize: 17 }}>
                  {"\ud83c\udfc6"} {winner.profiles?.username} reached {WINNING_SCORE} points!
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ ...G.card, textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ ...G.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{meta.category === "custom" ? "What's the best answer?" : "What does the market predict?"}</div>
              <div style={{ ...G.text, fontSize: 20, fontWeight: 700, lineHeight: 1.4 }}>{getQuestionDisplayTitle(curQ)}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {options.map((opt, i) => {
                let border = "2px solid transparent";
                let bg = `${optionColors[i % optionColors.length]}22`;
                const prob = meta.probabilities?.[i];
                const isCorrectAnswer = i === curQ.correct_answer;

                if (phase === "reveal") {
                  if (isCorrectAnswer) {
                    bg = `${optionColors[i % optionColors.length]}44`;
                    border = `2px solid ${optionColors[i % optionColors.length]}`;
                  } else if (myRow && i === myPick) {
                    bg = "rgba(231,76,60,0.2)";
                    border = "2px solid #e74c3c";
                  }
                } else if (selected === i) {
                  bg = `${optionColors[i % optionColors.length]}55`;
                  border = `2px solid ${optionColors[i % optionColors.length]}`;
                }

                return (
                  <button key={i} type="button" onClick={() => submitAnswer(i)} disabled={answered || phase !== "question"}
                    style={{ background: bg, border, borderRadius: 12, padding: "1rem", color: "#fff", fontWeight: 600, fontSize: 15, cursor: phase === "question" && !answered ? "pointer" : "default", textAlign: "left", transition: "all 0.2s", position: "relative" }}>
                    <span style={{ opacity: 0.6, fontSize: 12, display: "block", marginBottom: 4 }}>{["A","B","C","D"][i]}</span>
                    {opt}
                    {phase === "reveal" && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: isCorrectAnswer ? "#2ecc71" : optionColors[i % optionColors.length], borderRadius: 3, width: `${(prob || 0) * 100}%`, transition: "width 0.8s ease-out" }} />
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: 700 }}>
                          {((prob || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                    {phase === "reveal" && isCorrectAnswer && <span style={{ position: "absolute", top: 8, right: 10, fontSize: 18 }}>{"\u2713"}</span>}
                  </button>
                );
              })}
            </div>

            {phase === "reveal" && (
              <div style={{ ...G.card, marginBottom: "1rem" }}>
                <div style={{ ...G.text, fontWeight: 700, marginBottom: 6 }}>
                  {missedRound && "⏰ Time's up — no answer (counts as wrong)."}
                  {!missedRound && pickedRight && (meta.category === "custom" ? "✅ Correct! +1 point" : "✅ You matched the market's top pick! +1 point")}
                  {!missedRound && pickedWrong && (meta.category === "custom" ? "❌ Not the best answer" : "❌ The market disagrees with your pick")}
                </div>
                <div style={G.muted}>
                  {meta.category === "custom"
                    ? "AI-generated question"
                    : <>Polymarket data as of right now{meta.source && (
                        <span> &mdash; <a href={meta.source} target="_blank" rel="noopener noreferrer" style={{ color: "#667eea" }}>View on Polymarket</a></span>
                      )}</>
                  }
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── RESULTS SCREEN ───────────────────────────────────────────────────────────
function ResultsScreen({ user, room, onLeave }) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    (async () => {
      const p = await sb.query("room_players", `?room_id=eq.${room.id}&select=*,profiles(*)&order=score.desc`);
      if (Array.isArray(p)) setPlayers(p);
    })();
  }, [room.id]);

  const podiumColors = ["#f1c40f","#bdc3c7","#cd7f32"];
  const medals = ["\ud83e\udd47","\ud83e\udd48","\ud83e\udd49"];

  return (
    <div style={{ minHeight: "100vh", background: G.bg, fontFamily: "'Segoe UI', sans-serif", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: "0.5rem" }}>{"\ud83c\udfc6"}</div>
        <h2 style={{ ...G.text, fontSize: 32, fontWeight: 800, margin: "0 0 0.5rem" }}>Game Over!</h2>
        <p style={{ ...G.muted, marginBottom: "0.5rem" }}>Final Standings</p>
        {players[0] && (
          <p style={{ ...G.text, fontSize: 18, fontWeight: 600, marginBottom: "2rem" }}>
            {players[0].profiles?.username} wins with {players[0].score} {players[0].score === 1 ? "point" : "points"}!
          </p>
        )}

        <div style={G.card}>
          {players.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < players.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
              <div style={{ fontSize: 24, width: 32 }}>{medals[i] || `#${i + 1}`}</div>
              <Avatar name={p.profiles?.username} color={p.profiles?.avatar_color} size={40} />
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ ...G.text, fontWeight: 700 }}>{p.profiles?.username}</div>
                {p.player_id === user.id && <div style={{ fontSize: 11, color: "#667eea" }}>You</div>}
              </div>
              <div style={{ ...G.text, fontSize: 22, fontWeight: 800, color: podiumColors[i] || "#fff" }}>
                {p.score || 0}
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>pts</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: "1.5rem" }}>
          <button onClick={onLeave} style={{ ...G.btn, ...G.btnGhost }}>Main Menu</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth");
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "info" });

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "info" }), 3500);
  };

  const handleAuth = (u) => { setUser(u); setScreen("lobby"); };
  const handleSignOut = async () => { await sb.signOut(); setUser(null); setScreen("auth"); };
  const handleCreateRoom = (r) => { setRoom(r); setScreen("room"); };
  const handleJoinRoom = (r) => { setRoom(r); setScreen("room"); };
  const handleGameStart = (r) => { setRoom(r); setScreen("game"); };
  const handleGameEnd = () => setScreen("results");
  const handleLeave = () => { setRoom(null); setScreen("lobby"); };

  return (
    <>
      <Toast msg={toast.msg} type={toast.type} />
      {screen === "auth" && <AuthScreen onAuth={handleAuth} toast={showToast} />}
      {screen === "lobby" && <LobbyScreen user={user} onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} onSignOut={handleSignOut} toast={showToast} />}
      {screen === "room" && <RoomScreen user={user} room={room} onGameStart={handleGameStart} onLeave={handleLeave} toast={showToast} />}
      {screen === "game" && <GameScreen user={user} room={room} onGameEnd={handleGameEnd} />}
      {screen === "results" && <ResultsScreen user={user} room={room} onLeave={handleLeave} />}
      <style>{`* { box-sizing: border-box; } body { margin: 0; } input::placeholder { color: rgba(255,255,255,0.3); } textarea::placeholder { color: rgba(255,255,255,0.3); } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
