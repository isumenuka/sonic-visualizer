# Render.com Setup Guide — Sonic Visualizer FFmpeg Server

This guide walks you through deploying the `render-server/` as a Web Service on Render.com so that FFmpeg WASM files (`ffmpeg-core.js` and `ffmpeg-core.wasm`) are served with all the required security headers.

---

## Why Render.com?

FFmpeg WASM requires **SharedArrayBuffer**, which browsers only allow when:

| Header | Required Value |
|--------|---------------|
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Cross-Origin-Resource-Policy` | `cross-origin` |
| `Access-Control-Allow-Origin` | `*` |

Vercel sets the first two for the frontend, but the WASM files must be fetched from an origin that also sets `CORP: cross-origin` and CORS headers. The `render-server/` Express app does exactly this.

---

## Step 1 — Copy & Commit FFmpeg Files

Run this from the project root (only needed once, or after upgrading `@ffmpeg/core`):

```bash
npm install
npm run copy-ffmpeg
```

This copies `ffmpeg-core.js` and `ffmpeg-core.wasm` into `render-server/public/`.

**Commit these files to git** so Render can access them during deployment:

```bash
git add render-server/public/ffmpeg-core.js render-server/public/ffmpeg-core.wasm
git commit -m "chore: add ffmpeg core wasm files for render server"
git push
```

> ⚠️ The `.wasm` file is ~30 MB. Make sure it's **not** in your `.gitignore`.

---

## Step 2 — Create a Render.com Account

1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub (recommended — lets Render auto-deploy on push)

---

## Step 3 — Create a New Web Service

1. Click **New +** in the top-right corner
2. Select **Web Service**
3. Choose **Build and deploy from a Git repository**
4. Click **Connect GitHub** and authorize Render
5. Select your `sonic-visualizer` repository

---

## Step 4 — Configure the Service

Fill in the settings exactly as shown:

| Field | Value |
|-------|-------|
| **Name** | `sonic-ffmpeg` *(or any name you like)* |
| **Region** | Choose the closest to your users |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | `Node` |
| **Build Command** | `cd render-server && npm install` |
| **Start Command** | `cd render-server && node server.js` |
| **Instance Type** | `Free` *(works fine for this)* |

Click **Create Web Service**.

---

## Step 5 — Wait for First Deploy

Render will:
1. Clone your repo
2. Run `cd render-server && npm install`
3. Start the server with `node server.js`

This takes ~2–3 minutes on first deploy.

---

## Step 6 — Verify It's Working

Once deployed, Render gives you a URL like:
```
https://sonic-ffmpeg.onrender.com
```

Test it:

```bash
# Health check — should return JSON with file status
curl https://sonic-ffmpeg.onrender.com/health

# Expected response:
# {"status":"ok","files":{"ffmpeg-core.js":true,"ffmpeg-core.wasm":true}}
```

Also test file access:
```bash
curl -I https://sonic-ffmpeg.onrender.com/ffmpeg-core.js
# Should include:
# Cross-Origin-Resource-Policy: cross-origin
# Access-Control-Allow-Origin: *
```

---

## Step 7 — Add the URL to Vercel

Copy your Render service URL and set it as an environment variable in Vercel:

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add:

| Name | Value |
|------|-------|
| `VITE_FFMPEG_BASE_URL` | `https://sonic-ffmpeg.onrender.com` |

3. Click **Save**, then redeploy your Vercel project.

---

## Auto-Deploy on Push

By default, Render auto-deploys whenever you push to `main`. If you upgrade `@ffmpeg/core`, just:

```bash
npm run copy-ffmpeg
git add render-server/public/
git commit -m "chore: update ffmpeg core"
git push
```

Both Render and Vercel will auto-redeploy.

---

## Troubleshooting

### "status: missing-files" on `/health`
The WASM files weren't committed. Run `npm run copy-ffmpeg`, commit the files, and push.

### Service sleeps after inactivity (Free tier)
Render's free tier sleeps services after 15 minutes of inactivity. The first request after sleep takes ~30 seconds (FFmpeg cold start). To avoid this:
- Use a **Starter** plan ($7/mo), or
- Use a free uptime monitoring service like [UptimeRobot](https://uptimerobot.com) to ping `/health` every 10 minutes.

### CORS errors in browser console
Check that `Access-Control-Allow-Origin: *` is present in the response headers. Verify via:
```bash
curl -I https://sonic-ffmpeg.onrender.com/ffmpeg-core.wasm
```

### FFmpeg fails to load in the app
1. Check the browser console for the exact error
2. Verify `VITE_FFMPEG_BASE_URL` is set correctly in Vercel (no trailing slash)
3. Ensure the Render service passed its health check
4. Try the FFmpeg engine toggle (🖥 CPU icon in the dock) — if it errors, the issue is the server; if it works, try re-deploying Vercel

---

## Summary

```
GitHub push → Render auto-deploys FFmpeg server
           → Vercel auto-deploys frontend

User visits Vercel URL
  ├── Downloads frontend JS from Vercel (COOP/COEP headers ✓)
  └── When exporting: fetches ffmpeg-core.wasm from Render (CORP + CORS headers ✓)
```
