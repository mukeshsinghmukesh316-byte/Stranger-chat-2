# StrangerChat

A real-time, 1-on-1 anonymous stranger chat web application with topic matching, interest filtering, language preferences, WebRTC peer-to-peer voice and video chat, safety rate limiting, and real-time online user statistics.

---

## 🌟 Key Features

- **Real Matchmaking**: Anonymous 1-on-1 random pairing using an in-memory server queue. No databases or permanent storage required.
- **Interest & Language Filtering**: Match with strangers based on common interests or preferred languages.
- **Real-Time Text Chat**: Instant messaging powered by a custom Node.js WebSocket backend with typing indicators and message delivery receipts.
- **WebRTC Peer-to-Peer Voice & Video**:
  - Direct 1-on-1 browser-to-browser audio and video streams via `RTCPeerConnection`.
  - Zero server recording, processing, or media persistence. Audio/video flows purely P2P.
  - Front/Back camera switching for mobile devices.
  - Mute/Unmute microphone and Camera On/Off toggles.
- **Safety & Anti-Spam**:
  - Sliding window rate-limiting for messages and matchmaking requests.
  - In-memory temporary blocking and user reporting system.
  - Automatic session cleanup on user disconnect or skip ("Next").
- **Privacy First**: No user signups, no tracking cookies, no message logging, and no persistent logs.

---

## 📁 Project Structure

```
.
├── server.ts                 # Express HTTP server & production entry point
├── server/
│   └── websocket.ts          # In-memory WebSocket matchmaking, text & WebRTC signaling
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main application controller & state machine
│   ├── types.ts              # Global TypeScript interfaces & event definitions
│   ├── components/
│   │   ├── Header.tsx        # Navigation header with online user counter
│   │   ├── LandingPage.tsx   # Topic selection, profile setup, & interest picker
│   │   ├── SearchingScreen.tsx # Matchmaking search status view
│   │   ├── ChatScreen.tsx    # Primary chat view with message viewport
│   │   ├── VoiceControlBar.tsx # WebRTC audio controls & status bar
│   │   ├── VideoCanvas.tsx   # WebRTC video preview & controls overlay
│   │   ├── ReportModal.tsx   # User report modal
│   │   └── DirectivesModal.tsx # Community guidelines & privacy notice
│   ├── services/
│   │   ├── chatService.ts    # WebSocket client manager & event listener target
│   │   ├── voiceService.ts   # WebRTC audio stream lifecycle manager
│   │   └── videoService.ts   # WebRTC video stream lifecycle manager
│   └── utils/                # Helper utilities (anonymous username generator, etc.)
├── .env.example              # Environment variables template
├── package.json              # Dependencies & build scripts
└── vite.config.ts            # Vite build configuration
```

---

## 🛠️ Environment Variables Setup

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

### Configuration Options

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP and WebSocket server listening port. |
| `NODE_ENV` | No | `development` | Set to `production` for bundled serving. |
| `ALLOWED_ORIGINS` | No | *(empty)* | Comma-separated list of allowed frontend origins for CORS and WS origin verification. |
| `VITE_WS_URL` | No | *(auto)* | Explicit WebSocket backend URL (e.g. `wss://api.example.com/ws/chat`). Auto-detects `ws://` / `wss://` if left empty. |
| `VITE_STUN_SERVERS` | No | Google STUN | Comma-separated list of WebRTC STUN servers (e.g. `stun:stun.l.google.com:19302`). |
| `VITE_TURN_SERVER_URL` | No | *(empty)* | TURN server URL for NAT traversal (e.g. `turn:turn.example.com:3478`). |
| `VITE_TURN_USERNAME` | No | *(empty)* | TURN authentication username. |
| `VITE_TURN_CREDENTIAL` | No | *(empty)* | TURN authentication credential/secret. |

---

## 🚀 Local Development Instructions

### Prerequisites

- Node.js 18+
- npm 9+

### Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000` with Vite middleware enabled.

3. **Verify Health Endpoint**:
   Open `http://localhost:3000/health` or `http://localhost:3000/api/health`.

---

## 🏗️ Production Build & Deployment Requirements

### Build Commands

To build the project for production:

```bash
npm run build
```

This compiles:
1. The Vite frontend single-page application into static files in `dist/`.
2. The Node.js Express backend into `dist/server.cjs` via `esbuild`.

### Production Start Command

To launch the compiled production bundle:

```bash
npm run start
```

### Server Security Features
- **Security Headers**: Injected automatically (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Clean Health Check**: `GET /health` returns `{ status: "ok" }` without exposing internal state or connection metrics.
- **Graceful Shutdown**: Listens to `SIGTERM` and `SIGINT`, closes client WebSockets with `1001 Going Away`, and stops the HTTP listener.

---

## 📡 WebRTC & TURN Configuration Explanation

WebRTC requires signaling to exchange network candidates (ICE) and SDP offers/answers.

1. **Signaling**: Handled securely via the existing WebSocket connection (`/ws/chat`).
2. **STUN Servers**: Used by browsers to discover their own public IP address. By default, Google's public STUN servers are configured.
3. **TURN Servers**: Necessary when both peers sit behind restrictive NATs or enterprise firewalls that block direct P2P connection.
   - To configure TURN in production, set `VITE_TURN_SERVER_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL` in your `.env` file or environment variables.

---

## 🔒 Privacy & Safety Declarations

- **No Data Recorded**: Text messages, audio streams, and video feeds are never saved, recorded, or written to disk or database.
- **P2P Streaming**: WebRTC audio and video media flows directly between matched clients.
- **No Third-Party Analytics**: No tracking scripts, analytics tools, or external databases are used.
