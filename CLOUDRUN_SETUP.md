# Google Cloud Run Setup — Sonic Visualizer Render Server

Google Cloud Run is the best free option for server-side video rendering:
- **Always-free tier:** 2M requests/month + 360,000 vCPU-seconds/month
- **Up to 8 vCPUs per instance** (much faster than Render.com's 0.1)
- **60-minute request timeout** (no proxy cutoff)
- **Scales to zero** when not in use (no idle cost)

---

## Prerequisites

1. [Google Cloud account](https://cloud.google.com) — free $300 credit for new users
2. [Install gcloud CLI](https://cloud.google.com/sdk/docs/install)
3. Run `gcloud auth login` and `gcloud auth configure-docker`

---

## Step 1 — Create a Project

```bash
gcloud projects create sonic-render-YOUR-NAME --name="Sonic Render"
gcloud config set project sonic-render-YOUR-NAME
```

Enable billing (required even for free tier — won't be charged within free limits):
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

---

## Step 2 — Copy FFmpeg WASM files (for the static server part)

```bash
npm run copy-ffmpeg
```

---

## Step 3 — Deploy to Cloud Run

Run from the **project root** (not inside render-server/):

```bash
gcloud run deploy sonic-render \
  --source render-server/ \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 2 \
  --port 3001
```

This uses **Cloud Build** to build the Docker image automatically (120 free build-minutes/day).

Wait ~3 minutes. You'll get a URL like:
```
https://sonic-render-XXXX-uc.a.run.app
```

---

## Step 4 — Set the URL in Vercel

Go to Vercel → your project → **Settings → Environment Variables** → update:

| Name | Value |
|------|-------|
| `VITE_FFMPEG_BASE_URL` | `https://sonic-render-XXXX-uc.a.run.app` |

Redeploy Vercel frontend.

---

## Step 5 — Verify

```bash
curl https://sonic-render-XXXX-uc.a.run.app/health
# Expected: {"status":"ok","renderApi":true}
```

---

## Expected Performance

| Resolution | Estimated Time (2 vCPU Cloud Run) |
|---|---|
| 1080p, 5 min song | ~3-5 minutes |
| 1080p, 23 min song | ~15-25 minutes |
| 4K, 5 min song | ~15-20 minutes |

---

## Auto-deploy on Push (Optional)

Link Cloud Run to your GitHub repo for auto-deploy:
```bash
gcloud run deploy sonic-render \
  --source render-server/ \
  --region us-central1 \
  --allow-unauthenticated
```

Or set up a Cloud Build trigger in the [Cloud Console](https://console.cloud.google.com/cloud-build/triggers).

---

## Free Tier Limits

| Resource | Free Amount | Your Usage (23-min 1080p) |
|---|---|---|
| vCPU-seconds | 180,000/month | ~1,500 per render |
| Memory GB-seconds | 360,000/month | ~3,000 per render |
| Requests | 2,000,000/month | 2 per render (submit + download) |

→ You can do **~120 full 23-minute renders per month** for free.
