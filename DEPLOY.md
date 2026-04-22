# 🚀 Telegraph — Deployment Guide (Vercel + Render + MongoDB Atlas)

This guide deploys Telegraph so anyone on the internet can use it:
- **Backend** → Render (free tier)
- **Frontend** → Vercel (free tier)
- **Database** → MongoDB Atlas (free tier)
- **Media** → Cloudinary (free tier)

---

## Step 1 — MongoDB Atlas (free cloud database)

1. Go to https://cloud.mongodb.com and create a free account
2. Click **"Build a Database"** → choose **M0 Free**
3. Pick any region (closest to you)
4. Create a username + password (save these!)
5. Under **Network Access** → click **"Add IP Address"** → choose **"Allow Access From Anywhere"** (0.0.0.0/0)
6. Under **Database** → click **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://vovachka224:z9JK6or8mmu0m08m@cluster0.xxxxx.mongodb.net/telegraph?retryWrites=true&w=majority
   ```
   Replace `USERNAME` and `PASSWORD` with what you set in step 4.

---

## Step 2 — Cloudinary (free media hosting)

1. Sign up free at https://cloudinary.com
2. Go to **Dashboard** → copy:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

---

## Step 3 — Deploy Backend to Render

1. Push your project to GitHub (or GitLab)
2. Go to https://render.com → sign up free
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repo → select it
5. Configure:
   - **Name:** `telegraph-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Under **Environment Variables**, add these (click "Add Environment Variable" for each):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `MONGODB_URI` | your Atlas connection string from Step 1 |
   | `JWT_SECRET` | any long random string (e.g. `xK9mP2qL8nR5tY3wZ6vB1cD4fH7jN0s`) |
   | `CLOUDINARY_CLOUD_NAME` | from Step 2 |
   | `CLOUDINARY_API_KEY` | from Step 2 |
   | `CLOUDINARY_API_SECRET` | from Step 2 |
   | `CLIENT_URL` | leave blank for now — fill in after Step 4 |

7. Click **"Create Web Service"**
8. Wait ~3 minutes for the first deploy
9. Copy your Render URL: `https://telegraph-backend-xxxx.onrender.com`

---

## Step 4 — Deploy Frontend to Vercel

1. Go to https://vercel.com → sign up free (use GitHub)
2. Click **"Add New Project"** → import your repo
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Create React App
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `build` (auto-detected)
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | your Render URL from Step 3, e.g. `https://telegraph-backend-xxxx.onrender.com` |

5. Click **"Deploy"**
6. Wait ~2 minutes → copy your Vercel URL: `https://telegraph-xxxx.vercel.app`

---

## Step 5 — Connect Backend to Frontend (CORS)

1. Go back to your Render dashboard → your backend service
2. Under **Environment** → find `CLIENT_URL` → set it to your Vercel URL:
   ```
   https://telegraph-xxxx.vercel.app
   ```
3. Click **Save Changes** — Render will auto-redeploy

---

## Step 6 — Test It!

Open `https://telegraph-xxxx.vercel.app` on any device.

To test from multiple devices:
- Open the Vercel URL on your phone browser
- Open it on your laptop
- Register two accounts and chat!

---

## ⚠️ Free Tier Notes

| Service | Free Limits | Issue |
|---------|-------------|-------|
| Render | 750 hrs/month, **sleeps after 15 min idle** | First load after sleep takes ~30s |
| Vercel | 100GB bandwidth/month | Plenty for personal use |
| MongoDB Atlas | 512 MB storage | Fine for MVP |
| Cloudinary | 25 credits/month | ~25,000 image transforms |

**Render sleep fix:** The free tier spins down after 15 minutes of no traffic.
To keep it awake, use a free cron service like https://cron-job.org to ping
`https://telegraph-backend-xxxx.onrender.com/health` every 10 minutes.

---

## Local Development with LAN (your IP)

To test on devices on your local Wi-Fi:

```bash
# In frontend/.env.local
REACT_APP_API_URL=http://192.168.6.216:5000

# Start frontend bound to all interfaces
cd frontend && HOST=0.0.0.0 npm start

# Start backend (already binds to 0.0.0.0)
cd backend && npm run dev
```

In backend/.env, set:
```
CLIENT_URL=http://192.168.6.216:3000
```

Then access from any device on your Wi-Fi: `http://192.168.6.216:3000`

---

## Pushing to GitHub (required for Vercel + Render)

```bash
cd telegraph

# Initialize git
git init
git add .
git commit -m "Initial Telegraph MVP"

# Create a repo on https://github.com/new (don't init with README)
git remote add origin https://github.com/YOUR_USERNAME/telegraph.git
git branch -M main
git push -u origin main
```

Then import this repo in both Render and Vercel as described above.

---

## Re-deploying after changes

Both Render and Vercel auto-deploy when you push to GitHub:
```bash
git add .
git commit -m "your changes"
git push
```
