# Sonic Visualizer

A browser-based audio visualizer that renders stunning animations from any audio file and exports full-resolution MP4/WebM videos. Built with React + TypeScript, powered by WebAssembly (FFmpeg) and WebCodecs API.

---

## ✨ Features

- **12 visualizer styles** — Bars, Wave, Spiral, Particles, Ring, Strings, Orbit, Spikes, Laser, Nebula, Aura, Peaks
- **Dual export engines** — GPU (WebCodecs, fast) or CPU (FFmpeg WASM, universal)
- **Up to 4K export** — 1080p / 2K / 4K at 60fps
- **16:9 and 9:16** aspect ratios (landscape + portrait/reels)
- **Profile photo mode** — circular crop, auto color extraction
- **Effects** — glow, trail, color cycle, camera shake, ghost echo, particles, rotation
- **PWA ready** — works offline, installable on mobile

---

## 🚀 Deployment Architecture

```
GitHub repo
  ├── / (main app)  ──► Vercel (frontend hosting)
  └── /render-server/  ──► Render.com (FFmpeg WASM static server)
```

### Why three services?

FFmpeg WASM uses **SharedArrayBuffer** (multi-threaded WASM), which requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on **every** page. Vercel sets these for the frontend. But the `ffmpeg-core.wasm` file (~30 MB) must be loaded cross-origin from a server that also sets `Cross-Origin-Resource-Policy: cross-origin` and `Access-Control-Allow-Origin: *`. The Render.com Express server does exactly that.

---

## 📦 Step-by-Step Setup

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/sonic-visualizer.git
cd sonic-visualizer
npm install
```

### 2. Copy FFmpeg Core Files

```bash
npm run copy-ffmpeg
```

This copies `ffmpeg-core.js` and `ffmpeg-core.wasm` from `node_modules/@ffmpeg/core` into:
- `public/ffmpeg/` — for local dev server
- `render-server/public/` — for the Render.com deployment

> **Commit `render-server/public/` to git!** Render needs these files at deploy time.

### 3. Deploy the Render.com WASM Server

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Configure:
   | Field | Value |
   |-------|-------|
   | **Root Directory** | *(blank)* |
   | **Build Command** | `cd render-server && npm install` |
   | **Start Command** | `cd render-server && node server.js` |
   | **Environment** | `Node` |
4. Click **Create Web Service**
5. Copy the service URL, e.g. `https://sonic-ffmpeg.onrender.com`

Verify it works: `curl https://sonic-ffmpeg.onrender.com/health`

### 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo
2. Vercel auto-detects Vite — accept defaults
3. Add environment variable:
   | Name | Value |
   |------|-------|
   | `VITE_FFMPEG_BASE_URL` | `https://sonic-ffmpeg.onrender.com` |
4. Click **Deploy** 🎉

### 5. Verify Deployment

```bash
# Check WASM server is alive
curl https://sonic-ffmpeg.onrender.com/health

# Check Vercel headers (must include COOP + COEP)
curl -I https://your-app.vercel.app | grep -i "cross-origin"
```

---

## 💻 Local Development

```bash
npm install
npm run copy-ffmpeg   # only needed once (or after upgrading @ffmpeg/core)
npm run dev           # http://localhost:3000
```

No env vars needed locally — FFmpeg files are served from `public/ffmpeg/` by the Vite dev server.

---

## 🔧 Export Engines

| Engine | Icon | Speed | Format | Notes |
|--------|------|-------|--------|-------|
| **WebCodecs** | ⚡ (green) | 5–20× realtime | MP4 (H.264 + AAC) or WebM (VP9 + Opus) | Requires Chrome 94+ or Edge 94+. Uses GPU hardware acceleration. |
| **FFmpeg WASM** | 🖥 (amber) | 0.5–2× realtime | MP4 (H.264 + AAC) or WebM (VP9 + Opus) | Works in all modern browsers. Requires Render.com server in production. |

Toggle the engine with the bolt/CPU icon in the bottom dock. The app auto-selects WebCodecs if available, FFmpeg if not.

---

## 📁 Project Structure

```
sonic-visualizer/
├── src/
│   ├── App.tsx                        # Main app (dual engine export)
│   ├── components/ui/
│   │   ├── BottomDock.tsx             # Play/upload/export controls
│   │   ├── SettingsPanel.tsx          # Tabbed settings sidebar
│   │   ├── ExportModal.tsx            # Export progress modal
│   │   └── CropModal.tsx             # Profile photo crop
│   ├── utils/
│   │   ├── ffmpegExportEngine.ts      # FFmpeg WASM export (Render CDN)
│   │   └── exportEngine.ts           # WebCodecs GPU export
│   ├── visualizers/drawings.ts        # 12 visualizer renderers
│   └── types/index.ts
├── render-server/
│   ├── server.js                      # Express WASM file server → Render.com
│   ├── package.json
│   └── public/                        # ffmpeg-core.js + ffmpeg-core.wasm (git committed)
├── scripts/
│   └── copy-ffmpeg.js                 # Copies WASM files from node_modules
├── public/
│   └── ffmpeg/                        # Local dev WASM files
├── vercel.json                        # COOP/COEP headers + SPA rewrites
├── vite.config.ts                     # Build config + VITE_FFMPEG_BASE_URL
└── .env.example                       # Environment variable template
```

---

## 🛠 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local dev server on port 3000 |
| `npm run build` | Production build → `dist/` |
| `npm run copy-ffmpeg` | Copy FFmpeg core files from node_modules |
| `npm run lint` | TypeScript type check |

---

## 🧠 Tech Stack

- **React 19** + **TypeScript**
- **Vite 6** + **Tailwind CSS v4**
- **FFmpeg WASM** (`@ffmpeg/ffmpeg` + `@ffmpeg/core`) — CPU-based video encoding
- **WebCodecs API** — GPU-accelerated video encoding (Chrome/Edge)
- **mp4-muxer** + **webm-muxer** — in-browser MP4/WebM muxing
- **Framer Motion** — UI animations
- **Lucide React** — icons
