# Render.com Setup Guide — Sonic Visualizer Server v2

This server does two things:
1. **Serves FFmpeg WASM files** with security headers (SharedArrayBuffer support)
2. **POST `/render` API** — server-side video rendering with native FFmpeg (no browser memory limits)

---

## What Changed in v2

The server now has a **`POST /render`** endpoint:
- Accepts your audio file + visualizer settings
- Renders frames using `node-canvas` on the server
- Encodes with **native FFmpeg** (multi-threaded, 5-10× faster than browser WASM)
- Streams back a finished MP4

**In the app**: click the engine icon (⚡/🖥) twice to reach **☁ Cloud** mode (sky-blue icon).

---

## Important: Update Build Command on Render.com

Go to your Render.com service → **Settings → Build & Deploy** and update:

| Field | Old Value | New Value |
|-------|-----------|-----------|
| **Build Command** | `cd render-server && npm install` | `cd render-server && npm install` *(same)* |
| **Start Command** | `cd render-server && node server.js` | `cd render-server && node server.js` *(same)* |
| **Instance Type** | Free | **Starter ($7/mo) recommended** for video rendering |

> [!IMPORTANT]
> The **Free tier** has 0.1 CPU and 512 MB RAM. Video rendering is CPU-intensive.
> Upgrade to **Starter** ($7/mo, 0.5 CPU) for usable render speeds.
> **Standard** ($25/mo, 1 CPU) is best for 1080p.

---

## Deploy Steps

### 1. Push to GitHub
```bash
git add render-server/
git add src/utils/serverExportEngine.ts
git add src/components/ui/BottomDock.tsx
git add src/App.tsx
git commit -m "feat: add server-side render API + Cloud export engine"
git push
```

Render.com auto-deploys on push. Vercel auto-deploys too.

---

### 2. Verify the New Endpoint

```bash
# Health check — should now show renderApi: true
curl https://YOUR-RENDER-URL/health
# Expected: {"status":"ok","files":{...},"renderApi":true}
```

---

### 3. Test a Render

```bash
curl -X POST https://YOUR-RENDER-URL/render \
  -F "audio=@test.mp3" \
  -F 'settings={"type":"bars","primaryColor":"#00ff88","secondaryColor":"#00aaff","radius":150,"sensitivity":1.5,"barWidth":3,"rotationSpeed":0,"glowEnabled":true,"trailEnabled":false,"pulseEnabled":false,"colorCycle":false,"echoEnabled":false,"invertColors":false,"shakeEnabled":false,"bgParticlesEnabled":false,"centerMode":"text","centerText":"TEST","centerTextSize":20,"centerColor":"#000000","logoScale":0.5,"bgBlur":10,"bgOpacity":0.5,"mirror":true}' \
  -F "quality=1080p" \
  --output test-output.mp4
```

Should produce a valid MP4 file in ~1-2 minutes for a 3-minute song.

---

## Using the Cloud Engine in the App

1. Open the deployed Vercel app
2. Upload your audio
3. Click the **engine icon** in the bottom dock (⚡ = GPU, 🖥 = CPU)
4. Click it again → **☁ icon turns sky-blue** = Cloud mode
5. Click **Export** → progress bar shows upload (0-40%) then server render (40-95%)
6. MP4 auto-downloads when done

---

## Troubleshooting

### `/render` returns 500 "FFmpeg exited …"
FFmpeg binary isn't available. Render.com's Linux instances have FFmpeg pre-installed.
Check service logs: `Render Dashboard → your service → Logs`.

### Render is slow
Upgrade to Starter or Standard instance. Free tier has only 0.1 CPU.

### "VITE_FFMPEG_BASE_URL is not configured" error
Set `VITE_FFMPEG_BASE_URL` in Vercel → Environment Variables → your Render.com URL.

### Canvas fails to install (`node-canvas`)
The `canvas` npm package requires native build tools. Render.com's build environment has these.
If it fails, check build logs for missing `libcairo` — add a `render.yaml` apt package.
