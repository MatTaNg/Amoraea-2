/**
 * AMORAEA — Placeholder Screen Components
 *
 * All screens from the design system, built as swappable React components.
 * Each screen accepts a minimal set of props and renders placeholder data.
 * Replace with real data/logic when ready.
 *
 * Screens:
 *   <ProfileFeed />       — Home / curated profile feed
 *   <Connections />       — Chat list / connections
 *   <Conversation />      — Individual chat thread
 *   <MyProfile />         — User's own profile page
 *   <Notifications />     — Activity feed
 *   <VideoCall />         — Video call screen
 *   <AlertScreen />       — Push notification / alert overlay
 *
 * Usage:
 *   import { ProfileFeed, Connections, ... } from './AmorareaPlaceholders';
 */

import { useState } from "react";

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const T = {
  void:        "#05060D",
  deep:        "#080B14",
  surface:     "#0D1120",
  raised:      "#111827",
  border:      "rgba(82,142,220,0.12)",
  borderGlow:  "rgba(82,142,220,0.28)",
  flameWhite:  "#EEF6FF",
  flameBright: "#C8E4FF",
  flameMid:    "#5BA8E8",
  flameCore:   "#1E6FD9",
  flameDeep:   "#0D3A9C",
  textPrimary: "#E8F0F8",
  textSec:     "#7A9ABE",
  textDim:     "#3D5470",
  success:     "#2A8C6A",
  gold:        "#C9A96E",
};

const fonts = {
  serif: "'Cormorant Garamond', serif",
  ui:    "'Jost', sans-serif",
};

// Google Fonts injected once
if (typeof document !== "undefined" && !document.getElementById("amoraea-fonts")) {
  const link = document.createElement("link");
  link.id = "amoraea-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";
  document.head.appendChild(link);
}

// ─────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────

const grain = {
  position: "fixed", inset: 0, opacity: 0.022, pointerEvents: "none", zIndex: 999,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
};

const Grain = () => <div style={grain} />;

const Wordmark = ({ size = 18 }) => (
  <div style={{ fontFamily: fonts.serif, fontSize: size, fontWeight: 300,
    letterSpacing: "0.15em", color: T.flameBright }}>
    amor<span style={{ color: T.flameMid }}>æ</span>a
  </div>
);

const NavBar = ({ active }) => {
  const items = [
    { id: "home",   icon: <HomeIcon /> },
    { id: "chat",   icon: <ChatIcon /> },
    { id: "notifs", icon: <BellIcon /> },
    { id: "profile",icon: <UserIcon /> },
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "16px 0 28px", background: `linear-gradient(to top, ${T.void} 60%, transparent)`,
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: "flex", flexDirection: "column",
          alignItems: "center", gap: 4, cursor: "pointer", opacity: active === item.id ? 1 : 0.32 }}>
          {item.icon}
          <div style={{ width: 4, height: 4, borderRadius: "50%",
            background: T.flameCore, opacity: active === item.id ? 1 : 0 }} />
        </div>
      ))}
    </nav>
  );
};

const Screen = ({ children, active, style = {} }) => (
  <div style={{ width: 375, minHeight: 812, background: T.deep, position: "relative",
    overflow: "hidden", border: `1px solid ${T.border}`, borderRadius: 44,
    boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 40px 120px rgba(0,0,0,0.8),
                0 0 60px rgba(30,111,217,0.06)`, flexShrink: 0, ...style }}>
    <Grain />
    <div style={{ padding: "14px 28px 0", display: "flex", justifyContent: "space-between",
      alignItems: "center", fontFamily: fonts.ui, fontSize: 12, fontWeight: 400,
      color: T.textSec, position: "relative", zIndex: 5 }}>
      <span>9:41</span>
      <span style={{ letterSpacing: 1 }}>◆ ◆ ◆</span>
    </div>
    <div style={{ padding: "16px 24px 100px", height: "calc(812px - 46px)", overflow: "hidden" }}>
      {children}
    </div>
    <NavBar active={active} />
  </div>
);

const Tag = ({ children, glow }) => (
  <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 300,
    letterSpacing: 1, textTransform: "uppercase", fontFamily: fonts.ui,
    border: `1px solid ${glow ? "rgba(30,111,217,0.3)" : T.border}`,
    color: glow ? T.flameMid : T.textSec,
    background: glow ? "rgba(30,111,217,0.06)" : "transparent" }}>
    {children}
  </span>
);

const Divider = ({ my = 0 }) => (
  <div style={{ height: 1, background: T.border, margin: `${my}px 0` }} />
);

// ─────────────────────────────────────────────
// ICONS (inline SVG — no deps)
// ─────────────────────────────────────────────
const Ic = ({ d, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5">
    <path d={d} />
  </svg>
);

const HomeIcon  = () => <Ic d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />;
const ChatIcon  = () => <Ic d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />;
const BellIcon  = () => <Ic d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />;
const UserIcon  = () => <Ic d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />;
const BackIcon  = () => <Ic d="M15 19l-7-7 7-7" />;
const VideoIcon = () => <Ic d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />;
const MicIcon   = () => <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>;
const SendIcon  = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const Avatar = ({ initial, size = 52, online = false, dim = false }) => (
  <div style={{ position: "relative", flexShrink: 0 }}>
    <div style={{ width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${T.flameDeep}, ${T.flameCore})`,
      border: `1px solid ${dim ? T.border : T.borderGlow}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: fonts.serif, fontSize: size * 0.36, fontWeight: 300,
      color: dim ? T.textSec : T.flameBright, opacity: dim ? 0.6 : 1 }}>
      {initial}
    </div>
    {online && (
      <div style={{ position: "absolute", bottom: 2, right: 2, width: 10, height: 10,
        background: T.success, borderRadius: "50%", border: `2px solid ${T.deep}` }} />
    )}
  </div>
);

// ─────────────────────────────────────────────
// SCREEN 1 — PROFILE FEED
// ─────────────────────────────────────────────
/**
 * ProfileFeed
 * Props:
 *   profile  — { name, age, location, compatibility, tags, bio }
 *   onPass   — () => void
 *   onConnect — () => void
 *   remaining — number
 */
export const ProfileFeed = ({
  profile = {
    name: "Isabelle", age: 28, location: "London, UK",
    compatibility: 91,
    tags: ["Conflict & Repair · 9", "Accountability · 8", "Writer", "Somatic work"],
  },
  onPass = () => {},
  onConnect = () => {},
  remaining = 3,
}) => (
  <Screen active="home">
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: 28, paddingTop: 4 }}>
      <Wordmark />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <BellIcon />
          <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7,
            background: T.flameCore, borderRadius: "50%",
            boxShadow: `0 0 6px ${T.flameCore}` }} />
        </div>
        <Avatar initial="M" size={36} />
      </div>
    </div>

    {/* Pill */}
    <div style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300,
      letterSpacing: 2, textTransform: "uppercase", color: T.textDim, marginBottom: 16 }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        background: T.flameCore, boxShadow: `0 0 6px ${T.flameCore}`, marginRight: 6 }} />
      A new connection awaits
    </div>

    {/* Card */}
    <div style={{ background: T.surface, borderRadius: 24, overflow: "hidden",
      border: `1px solid ${T.border}`, marginBottom: 16 }}>
      {/* Image placeholder */}
      <div style={{ height: 280, background:
        `radial-gradient(ellipse at 40% 35%, rgba(30,111,217,0.18) 0%, transparent 60%),
         radial-gradient(ellipse at 70% 70%, rgba(13,58,156,0.12) 0%, transparent 50%),
         linear-gradient(160deg, #0D1E38, #0A1528)`,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 90, height: 160, background:
          "linear-gradient(to bottom, rgba(82,142,220,0.15), rgba(30,111,217,0.05))",
          borderRadius: "45px 45px 40px 40px", opacity: 0.4 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 140,
          background: `linear-gradient(to top, ${T.surface} 30%, transparent)` }} />
        {/* Compatibility badge */}
        <div style={{ position: "absolute", top: 16, right: 16, width: 48, height: 48,
          borderRadius: "50%", background: "rgba(5,6,13,0.7)", border: `1px solid ${T.borderGlow}`,
          backdropFilter: "blur(8px)", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: fonts.serif, fontSize: 15, fontWeight: 400,
            color: T.flameBright, lineHeight: 1 }}>{profile.compatibility}</span>
          <span style={{ fontFamily: fonts.ui, fontSize: 8, color: T.textDim,
            letterSpacing: 1 }}>match</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", marginBottom: 4 }}>
          <span style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 400,
            color: T.textPrimary }}>{profile.name}</span>
          <span style={{ fontFamily: fonts.ui, fontSize: 13, fontWeight: 300,
            color: T.textSec }}>{profile.age}</span>
        </div>
        <div style={{ fontFamily: fonts.ui, fontSize: 11, fontWeight: 300,
          letterSpacing: 1.5, textTransform: "uppercase", color: T.textDim, marginBottom: 12 }}>
          ✦ {profile.location}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {profile.tags.map((t, i) => <Tag key={i} glow={i < 2}>{t}</Tag>)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onPass} style={{ flex: 1, padding: 13, borderRadius: 10,
            background: "transparent", border: `1px solid ${T.border}`, color: T.textDim,
            fontFamily: fonts.ui, fontSize: 11, fontWeight: 300, letterSpacing: 2,
            textTransform: "uppercase", cursor: "pointer" }}>Pass</button>
          <button onClick={onConnect} style={{ flex: 2, padding: 13, borderRadius: 10,
            background: `linear-gradient(135deg, ${T.flameDeep}, ${T.flameCore})`,
            border: "none", color: T.flameWhite, fontFamily: fonts.ui, fontSize: 11,
            fontWeight: 400, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(30,111,217,0.3)" }}>Connect →</button>
        </div>
      </div>
    </div>

    <div style={{ textAlign: "center", fontFamily: fonts.ui, fontSize: 10,
      fontWeight: 300, letterSpacing: 2, textTransform: "uppercase", color: T.textDim }}>
      {remaining} profiles remaining
    </div>
  </Screen>
);

// ─────────────────────────────────────────────
// SCREEN 2 — CONNECTIONS (CHAT LIST)
// ─────────────────────────────────────────────
/**
 * Connections
 * Props:
 *   chats — [{ id, name, preview, time, unread, online }]
 *   onOpen — (id) => void
 */
export const Connections = ({
  chats = [
    { id: 1, name: "Isabelle", preview: "I was thinking about what you said...", time: "now", unread: 2, online: true },
    { id: 2, name: "Sophia",   preview: "That makes a lot of sense actually",   time: "2h",   unread: 0, online: false },
    { id: 3, name: "Naomi",    preview: "Are you free this weekend?",            time: "yesterday", unread: 1, online: false },
    { id: 4, name: "Léa",      preview: "Hey, I saw your profile...",            time: "3 days",    unread: 0, online: false },
  ],
  onOpen = () => {},
}) => (
  <Screen active="chat">
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "baseline", marginBottom: 24, paddingTop: 4 }}>
      <span style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: 300,
        color: T.textPrimary }}>Connections</span>
      <span style={{ fontFamily: fonts.ui, fontSize: 11, color: T.flameMid,
        fontWeight: 300 }}>{chats.length} active</span>
    </div>

    {/* Story bubbles */}
    <div style={{ display: "flex", gap: 14, marginBottom: 24, overflow: "hidden" }}>
      {chats.slice(0, 3).map(c => (
        <div key={c.id} style={{ display: "flex", flexDirection: "column",
          alignItems: "center", gap: 6 }}>
          <Avatar initial={c.name[0]} size={56} online={c.online} />
          <span style={{ fontFamily: fonts.ui, fontSize: 10, color: T.textDim,
            fontWeight: 300 }}>{c.name}</span>
        </div>
      ))}
    </div>

    <Divider my={0} />

    {chats.map(c => (
      <div key={c.id} onClick={() => onOpen(c.id)}
        style={{ display: "flex", alignItems: "center", gap: 14,
          padding: "14px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
        <Avatar initial={c.name[0]} size={52} online={c.online} dim={!c.unread && !c.online} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontFamily: fonts.serif, fontSize: 17, fontWeight: 400,
              color: c.unread ? T.textPrimary : T.textSec }}>{c.name}</span>
            <span style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300,
              color: T.textDim }}>{c.time}</span>
          </div>
          <div style={{ fontFamily: fonts.ui, fontSize: 13, fontWeight: 300,
            color: T.textSec, whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis" }}>{c.preview}</div>
        </div>
        {c.unread > 0 && (
          <div style={{ width: 18, height: 18, borderRadius: "50%",
            background: T.flameCore, color: "white", fontFamily: fonts.ui,
            fontSize: 9, fontWeight: 500, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: `0 0 8px rgba(30,111,217,0.5)` }}>
            {c.unread}
          </div>
        )}
      </div>
    ))}
  </Screen>
);

// ─────────────────────────────────────────────
// SCREEN 3 — CONVERSATION
// ─────────────────────────────────────────────
/**
 * Conversation
 * Props:
 *   contact  — { name, online }
 *   messages — [{ id, role: "me"|"them", content, time }]
 *   onBack   — () => void
 *   onSend   — (text) => void
 */
export const Conversation = ({
  contact = { name: "Isabelle", online: true },
  messages = [
    { id: 1, role: "them", content: "I really appreciated how honest you were in your profile. It's rare.", time: "8:42" },
    { id: 2, role: "me",   content: "It took a few tries to get there. I kept softening things and then deleting it all.", time: "8:45" },
    { id: 3, role: "them", content: "That's actually what made it feel real. The unpolished version of someone tells you more.", time: "8:47" },
    { id: 4, role: "me",   content: "What drew you to Amoraea in the first place?", time: "8:51" },
    { id: 5, role: "them", content: "I was tired of apps where depth is optional. I wanted something that filtered for it from the start.", time: "8:54" },
    { id: 6, role: "them", content: "I was thinking about what you said last night...", time: "9:38" },
  ],
  onBack = () => {},
  onSend = () => {},
}) => {
  const [draft, setDraft] = useState("");
  return (
    <Screen active="chat">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        padding: "12px 0 16px", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none",
          color: T.flameMid, fontSize: 22, cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center" }}>‹</button>
        <Avatar initial={contact.name[0]} size={40} online={contact.online} />
        <div style={{ flex: 1, marginLeft: 4 }}>
          <div style={{ fontFamily: fonts.serif, fontSize: 18, fontWeight: 400,
            color: T.textPrimary }}>{contact.name}</div>
          {contact.online && (
            <div style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300,
              letterSpacing: 1.5, textTransform: "uppercase", color: T.success }}>● online</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 16, color: T.textSec }}>
          <VideoIcon /><span style={{ fontSize: 20 }}>···</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10,
        height: 480, overflow: "hidden" }}>
        <div style={{ textAlign: "center", fontFamily: fonts.ui, fontSize: 10,
          color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", padding: "4px 0" }}>
          Yesterday · 8:42 pm
        </div>
        {messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.role === "me" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "78%", padding: "12px 16px", fontSize: 14, fontWeight: 300,
              lineHeight: 1.55, fontFamily: fonts.ui,
              ...(m.role === "them" ? {
                background: T.surface, border: `1px solid ${T.border}`,
                color: T.textPrimary, borderRadius: "18px 18px 18px 4px",
              } : {
                background: "linear-gradient(135deg, rgba(13,58,156,0.8), rgba(30,111,217,0.6))",
                border: "1px solid rgba(30,111,217,0.25)",
                color: T.flameBright, borderRadius: "18px 18px 4px 18px",
              }),
            }}>{m.content}</div>
            <div style={{ fontFamily: fonts.ui, fontSize: 10, color: T.textDim,
              fontWeight: 300, marginTop: 3, letterSpacing: 0.5,
              textAlign: m.role === "me" ? "right" : "left" }}>{m.time}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ position: "absolute", bottom: 80, left: 24, right: 24,
        display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && draft.trim()) { onSend(draft); setDraft(""); }}}
          placeholder="Say something real..."
          style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 24, padding: "12px 18px", fontFamily: fonts.ui, fontSize: 14,
            fontWeight: 300, color: T.textPrimary, outline: "none" }}
        />
        <button onClick={() => { if (draft.trim()) { onSend(draft); setDraft(""); }}}
          style={{ width: 42, height: 42, borderRadius: "50%",
            background: `linear-gradient(135deg, ${T.flameDeep}, ${T.flameCore})`,
            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 4px 16px rgba(30,111,217,0.35)",
            color: "white" }}>
          <SendIcon />
        </button>
      </div>
    </Screen>
  );
};

// ─────────────────────────────────────────────
// SCREEN 4 — MY PROFILE
// ─────────────────────────────────────────────
/**
 * MyProfile
 * Props:
 *   user — { name, location, memberSince, topMatch, connections, bio, scores, tags }
 *   onEdit — () => void
 */
export const MyProfile = ({
  user = {
    name: "Matthew", location: "London", memberSince: "2025",
    topMatch: 91, connections: 3, bio: "I've done enough of my own work to know the difference between connection and avoidance. Looking for someone who knows that too.",
    scores: [
      { label: "Conflict & Repair",  value: 8.5 },
      { label: "Accountability",      value: 8.0 },
      { label: "Responsiveness",      value: 7.2 },
      { label: "Desire & Limits",     value: 7.8 },
    ],
    tags: ["Depth over breadth", "Therapy-adjacent", "Late nights", "Books", "Long silences"],
  },
  onEdit = () => {},
}) => (
  <Screen active="profile">
    {/* Hero */}
    <div style={{ height: 200, margin: "0 -24px", position: "relative",
      background: `radial-gradient(ellipse at 50% 60%, rgba(30,111,217,0.2) 0%, transparent 70%),
                   linear-gradient(160deg, #0D1E38, #080B14)`,
      display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", bottom: -45, width: 90, height: 90,
        borderRadius: "50%", background: `linear-gradient(135deg, ${T.flameDeep}, ${T.flameCore})`,
        border: `2px solid ${T.borderGlow}`, boxShadow: "0 0 30px rgba(30,111,217,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: fonts.serif, fontSize: 32, fontWeight: 300, color: T.flameBright }}>
        {user.name[0]}
      </div>
    </div>

    <div style={{ marginTop: 58 }}>
      <div style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 400,
        letterSpacing: "0.04em", color: T.textPrimary, textAlign: "center", marginBottom: 4 }}>
        {user.name}
      </div>
      <div style={{ fontFamily: fonts.ui, fontSize: 11, fontWeight: 300,
        letterSpacing: 2.5, textTransform: "uppercase", color: T.textDim,
        textAlign: "center", marginBottom: 24 }}>
        ✦ {user.location} · Member since {user.memberSince}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", border: `1px solid ${T.border}`,
        borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
        {[
          { num: user.topMatch, label: "Top match" },
          { num: user.connections, label: "Connections" },
          { num: "✓", label: "Verified", color: T.success },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: "14px 8px", textAlign: "center",
            borderRight: i < 2 ? `1px solid ${T.border}` : "none" }}>
            <span style={{ display: "block", fontFamily: fonts.serif, fontSize: 22,
              fontWeight: 400, color: s.color || T.flameBright }}>{s.num}</span>
            <span style={{ display: "block", fontFamily: fonts.ui, fontSize: 9,
              fontWeight: 300, letterSpacing: 1.5, textTransform: "uppercase",
              color: s.color || T.textDim, marginTop: 2 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Bio */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 400, letterSpacing: 2.5,
          textTransform: "uppercase", color: T.textDim, marginBottom: 10 }}>About</div>
        <div style={{ fontFamily: fonts.serif, fontSize: 15, fontWeight: 300,
          fontStyle: "italic", lineHeight: 1.7, color: T.textSec }}>"{user.bio}"</div>
      </div>

      {/* Assessment scores */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 400, letterSpacing: 2.5,
          textTransform: "uppercase", color: T.textDim, marginBottom: 12 }}>Assessment scores</div>
        {user.scores.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: fonts.ui, fontSize: 11, fontWeight: 300,
              color: T.textSec, width: 110, flexShrink: 0 }}>{s.label}</span>
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)",
              borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, width: `${s.value * 10}%`,
                background: `linear-gradient(to right, ${T.flameDeep}, ${T.flameMid})` }} />
            </div>
            <span style={{ fontFamily: fonts.ui, fontSize: 11, color: T.textDim,
              fontWeight: 300, width: 24, textAlign: "right" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div>
        <div style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 400, letterSpacing: 2.5,
          textTransform: "uppercase", color: T.textDim, marginBottom: 10 }}>Into</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {user.tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
        </div>
      </div>
    </div>
  </Screen>
);

// ─────────────────────────────────────────────
// SCREEN 5 — NOTIFICATIONS
// ─────────────────────────────────────────────
/**
 * Notifications
 * Props:
 *   items — [{ id, type: "match"|"message"|"review"|"reminder", title, body, time, unread }]
 *   onTap — (id) => void
 */
export const Notifications = ({
  items = [
    { id: 1, type: "match",    title: "Isabelle connected with you",    body: "Your compatibility score is 91 — one of your highest matches to date.", time: "Just now",          unread: true },
    { id: 2, type: "message",  title: "Isabelle sent a message",        body: '"I was thinking about what you said..."',                               time: "2 min ago",         unread: true },
    { id: 3, type: "review",   title: "Your profile was reviewed",      body: "You've been approved and added to the active pool.",                    time: "Yesterday · 6:14 pm", unread: false },
    { id: 4, type: "message",  title: "Naomi sent a message",           body: '"Are you free this weekend?"',                                         time: "Yesterday · 3:40 pm", unread: false },
    { id: 5, type: "reminder", title: "Complete your profile",          body: "Add a bio to help your matches understand who you are.",                time: "2 days ago",         unread: false },
  ],
  onTap = () => {},
}) => {
  const iconFor = type => ({
    match:    { emoji: "🔥", bg: "rgba(30,111,217,0.1)",  border: "rgba(30,111,217,0.25)" },
    message:  { emoji: "💬", bg: "rgba(30,111,217,0.07)", border: "rgba(30,111,217,0.18)" },
    review:   { emoji: "◆",  bg: "rgba(30,111,217,0.07)", border: "rgba(30,111,217,0.2)" },
    reminder: { emoji: "📋", bg: "rgba(82,142,220,0.06)", border: T.border },
  }[type] || { emoji: "◆", bg: T.surface, border: T.border });

  const today = items.filter(i => ["Just now","2 min ago"].includes(i.time));
  const earlier = items.filter(i => !["Just now","2 min ago"].includes(i.time));

  const renderItem = item => {
    const ic = iconFor(item.type);
    return (
      <div key={item.id} onClick={() => onTap(item.id)}
        style={{ display: "flex", gap: 14, padding: "16px 0",
          borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%",
          background: ic.bg, border: `1px solid ${ic.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0 }}>{ic.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fonts.ui, fontSize: 14, fontWeight: 400,
            color: T.textPrimary, marginBottom: 3, lineHeight: 1.4 }}>
            {item.title}
          </div>
          <div style={{ fontFamily: fonts.ui, fontSize: 12, fontWeight: 300,
            color: T.textSec, lineHeight: 1.5, marginBottom: 4 }}>{item.body}</div>
          <div style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300,
            letterSpacing: 1, color: T.textDim, textTransform: "uppercase" }}>{item.time}</div>
        </div>
        {item.unread && (
          <div style={{ width: 7, height: 7, borderRadius: "50%",
            background: T.flameCore, boxShadow: `0 0 6px ${T.flameCore}`,
            marginTop: 6, flexShrink: 0 }} />
        )}
      </div>
    );
  };

  return (
    <Screen active="notifs">
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 20, paddingTop: 4 }}>
        <span style={{ fontFamily: fonts.serif, fontSize: 22, fontWeight: 300,
          color: T.textPrimary }}>Activity</span>
      </div>
      {today.length > 0 && <>
        <div style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 300, letterSpacing: 2,
          textTransform: "uppercase", color: T.textDim, marginBottom: 8 }}>Today</div>
        {today.map(renderItem)}
      </>}
      {earlier.length > 0 && <>
        <div style={{ fontFamily: fonts.ui, fontSize: 9, fontWeight: 300, letterSpacing: 2,
          textTransform: "uppercase", color: T.textDim, margin: "16px 0 8px" }}>Earlier</div>
        {earlier.map(renderItem)}
      </>}
    </Screen>
  );
};

// ─────────────────────────────────────────────
// SCREEN 6 — VIDEO CALL
// ─────────────────────────────────────────────
/**
 * VideoCall
 * Props:
 *   contact  — { name }
 *   duration — string e.g. "24:08"
 *   onEnd    — () => void
 *   onMute   — () => void
 *   onCamera — () => void
 */
export const VideoCall = ({
  contact = { name: "Isabelle" },
  duration = "24:08",
  onEnd = () => {},
  onMute = () => {},
  onCamera = () => {},
}) => (
  <div style={{ width: 375, height: 812, position: "relative", overflow: "hidden",
    borderRadius: 44, border: `1px solid ${T.border}`, flexShrink: 0,
    background: `radial-gradient(ellipse at 30% 40%, rgba(13,58,156,0.25) 0%, transparent 55%),
                 radial-gradient(ellipse at 75% 70%, rgba(5,30,80,0.3) 0%, transparent 50%),
                 linear-gradient(160deg, #060910, #080B14)` }}>
    <Grain />

    {/* Status bar */}
    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0",
      fontFamily: fonts.ui, fontSize: 12, color: T.textSec, position: "relative", zIndex: 5 }}>
      <span>9:41</span><span style={{ letterSpacing: 1 }}>◆ ◆ ◆</span>
    </div>

    {/* Duration */}
    <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center",
      fontFamily: fonts.ui, fontSize: 13, fontWeight: 300, color: T.textSec, letterSpacing: 2 }}>
      {duration}
    </div>

    {/* Self view */}
    <div style={{ position: "absolute", top: 20, right: 20, width: 100, height: 140,
      borderRadius: 16, border: `1px solid ${T.borderGlow}`,
      background: `radial-gradient(ellipse at 50% 40%, rgba(30,111,217,0.12) 0%, transparent 60%),
                   linear-gradient(160deg, #0D1E38, #080B14)`,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 70, background: "rgba(82,142,220,0.15)",
        borderRadius: "20px 20px 18px 18px", opacity: 0.5 }} />
    </div>

    {/* Caller avatar */}
    <div style={{ position: "absolute", top: "28%", left: "50%", transform: "translateX(-50%)" }}>
      <div style={{ width: 130, height: 130, borderRadius: "50%",
        background: "linear-gradient(135deg, #0D1E38, #162040)",
        border: `1px solid ${T.borderGlow}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: fonts.serif, fontSize: 48, fontWeight: 300, color: T.flameMid,
        boxShadow: "0 0 40px rgba(30,111,217,0.2)" }}>
        {contact.name[0]}
      </div>
    </div>

    {/* Glow */}
    <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
      width: 300, height: 300, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(13,58,156,0.2) 0%, transparent 70%)",
      filter: "blur(40px)" }} />

    {/* Info */}
    <div style={{ position: "absolute", bottom: 140, left: 0, right: 0, textAlign: "center" }}>
      <div style={{ fontFamily: fonts.serif, fontSize: 28, fontWeight: 300,
        color: T.textPrimary, letterSpacing: "0.04em", marginBottom: 6 }}>{contact.name}</div>
      <div style={{ fontFamily: fonts.ui, fontSize: 11, fontWeight: 300,
        letterSpacing: 2, textTransform: "uppercase", color: T.flameMid }}>● In call</div>
    </div>

    {/* Controls */}
    <div style={{ position: "absolute", bottom: 48, left: 0, right: 0,
      display: "flex", justifyContent: "center", gap: 20, alignItems: "center" }}>
      {[
        { icon: <MicIcon />, onClick: onMute },
        { icon: <span style={{ fontSize: 20 }}>📵</span>, onClick: onEnd,
          big: true, red: true },
        { icon: <VideoIcon />, onClick: onCamera },
      ].map((btn, i) => (
        <button key={i} onClick={btn.onClick} style={{
          width: btn.big ? 64 : 56, height: btn.big ? 64 : 56, borderRadius: "50%",
          background: btn.red ? "rgba(180,40,40,0.7)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${btn.red ? "rgba(220,60,60,0.4)" : T.border}`,
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", color: T.textPrimary,
          boxShadow: btn.red ? "0 4px 20px rgba(180,40,40,0.4)" : "none",
        }}>{btn.icon}</button>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// SCREEN 7 — ALERT / PUSH NOTIFICATION
// ─────────────────────────────────────────────
/**
 * AlertScreen
 * Props:
 *   type    — "match" | "review" | "message"
 *   title   — string
 *   body    — string
 *   time    — string
 *   primaryLabel   — string
 *   secondaryLabel — string
 *   onPrimary   — () => void
 *   onSecondary — () => void
 */
export const AlertScreen = ({
  type = "match",
  title = "A new connection has found you.",
  body = "Isabelle from London has been matched with you. Your compatibility score is 91 — your highest yet.",
  time = "Today · 9:41 am",
  primaryLabel = "View Profile →",
  secondaryLabel = "Later",
  onPrimary = () => {},
  onSecondary = () => {},
}) => {
  const config = {
    match:   { emoji: "🔥", glowColor: "rgba(30,111,217,0.15)",  iconBg: "rgba(30,111,217,0.08)", iconBorder: T.borderGlow },
    review:  { emoji: "◆",  glowColor: "rgba(30,111,217,0.12)",  iconBg: "rgba(30,111,217,0.08)", iconBorder: T.borderGlow },
    message: { emoji: "💬", glowColor: "rgba(30,111,217,0.12)",  iconBg: "rgba(30,111,217,0.08)", iconBorder: T.borderGlow },
  }[type] || {};

  return (
    <div style={{ width: 375, height: 812, background: `linear-gradient(to bottom, ${T.void}, #06080F)`,
      borderRadius: 44, border: `1px solid ${T.border}`, flexShrink: 0, overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 32px", position: "relative",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 120px rgba(0,0,0,0.8)" }}>
      <Grain />

      {/* Status bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-between", padding: "14px 28px 0",
        fontFamily: fonts.ui, fontSize: 12, color: T.textSec }}>
        <span>9:41</span><span style={{ letterSpacing: 1 }}>◆ ◆ ◆</span>
      </div>

      {/* Glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
        width: 260, height: 260, borderRadius: "50%",
        background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
        filter: "blur(40px)", pointerEvents: "none" }} />

      {/* Icon */}
      <div style={{ width: 80, height: 80, borderRadius: "50%",
        background: config.iconBg, border: `1px solid ${config.iconBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32, marginBottom: 28, position: "relative" }}>
        {config.emoji}
        <div style={{ position: "absolute", inset: -8, borderRadius: "50%",
          border: `1px solid rgba(30,111,217,0.15)` }} />
      </div>

      <div style={{ fontFamily: fonts.serif, fontSize: 26, fontWeight: 300,
        color: T.textPrimary, textAlign: "center", letterSpacing: "0.03em",
        lineHeight: 1.3, marginBottom: 14 }}>{title}</div>

      <div style={{ fontFamily: fonts.ui, fontSize: 14, fontWeight: 300,
        color: T.textSec, textAlign: "center", lineHeight: 1.7,
        marginBottom: 36, maxWidth: 280 }}>{body}</div>

      <button onClick={onPrimary} style={{ width: "100%", padding: 16, borderRadius: 10,
        background: `linear-gradient(135deg, ${T.flameDeep}, ${T.flameCore})`,
        border: "none", color: T.flameWhite, fontFamily: fonts.ui, fontSize: 11,
        fontWeight: 400, letterSpacing: 2.5, textTransform: "uppercase", cursor: "pointer",
        marginBottom: 12, boxShadow: "0 8px 30px rgba(30,111,217,0.3)" }}>
        {primaryLabel}
      </button>

      <button onClick={onSecondary} style={{ width: "100%", padding: 14, borderRadius: 10,
        background: "transparent", border: `1px solid ${T.border}`, color: T.textDim,
        fontFamily: fonts.ui, fontSize: 11, fontWeight: 300, letterSpacing: 2,
        textTransform: "uppercase", cursor: "pointer" }}>
        {secondaryLabel}
      </button>

      <div style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300, letterSpacing: 2,
        textTransform: "uppercase", color: T.textDim, marginTop: 24 }}>{time}</div>
    </div>
  );
};

// ─────────────────────────────────────────────
// DEMO — renders all screens side by side
// Remove this export and the import in your app
// once you wire up real screens
// ─────────────────────────────────────────────
export default function AmorareaDemo() {
  return (
    <div style={{ background: T.void, minHeight: "100vh", padding: 60 }}>
      <div style={{ fontFamily: fonts.serif, fontSize: 36, fontWeight: 300,
        letterSpacing: "0.2em", color: T.flameBright, textAlign: "center",
        marginBottom: 8 }}>AMORAEA</div>
      <div style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300,
        letterSpacing: 3, textTransform: "uppercase", color: T.textDim,
        textAlign: "center", marginBottom: 60 }}>Placeholder Components</div>

      {[
        ["Profile Feed", <ProfileFeed />],
        ["Connections",  <Connections />],
        ["Conversation", <Conversation />],
        ["My Profile",   <MyProfile />],
        ["Notifications",<Notifications />],
        ["Video Call",   <VideoCall />],
        ["Alert — Match",   <AlertScreen type="match" />],
        ["Alert — Review",  <AlertScreen type="review" title="Someone is waiting to hear from you." body="You have 3 profiles ready to review. Take a moment when you're present — they deserve your full attention." primaryLabel="Open App →" secondaryLabel="Remind me later" />],
        ["Alert — Message", <AlertScreen type="message" title="Isabelle sent you a message." body={'"I was thinking about what you said last night — and I think I understand what you meant now."'} primaryLabel="Reply →" />],
      ].map(([label, el]) => (
        <div key={label} style={{ marginBottom: 80 }}>
          <div style={{ fontFamily: fonts.ui, fontSize: 10, fontWeight: 300,
            letterSpacing: 3, textTransform: "uppercase", color: T.textDim,
            marginBottom: 20 }}>{label}</div>
          <div style={{ display: "flex" }}>{el}</div>
        </div>
      ))}
    </div>
  );
}
