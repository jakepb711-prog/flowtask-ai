# Deploy FlowTask AI to Vercel

## ⚡ Quick Deploy (5 minutes)

### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Use GitHub, GitLab, or Bitbucket account (recommended)

### Step 2: Push Code to GitHub
```bash
cd /home/claude/flowtask-rebuild

# Initialize git (if not done)
git init
git add .
git commit -m "Initial FlowTask AI commit"

# Create repo on GitHub first (github.com/new)
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/flowtask-ai.git
git push -u origin main
```

### Step 3: Import Project to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Paste: `https://github.com/YOUR_USERNAME/flowtask-ai`
4. Click "Import"

### Step 4: Configure Environment Variables
In Vercel dashboard, go to **Settings** → **Environment Variables**

Add:
```
ANTHROPIC_API_KEY = sk_your_actual_key_here
```

### Step 5: Deploy!
Click "Deploy"

**Done!** Your app is live at `https://flowtask-ai.vercel.app`

---

## 🔧 Configuration Details

### What Vercel Detects
- **Framework:** Vite (React)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **API Routes:** `/api/*` (serverless functions)

### File Structure Required
```
flowtask-ai/
├── api/
│   └── index.ts         ← Vercel serverless function
├── src/
│   ├── main.tsx         ← React entry
│   ├── App.tsx          ← Main component
│   ├── App.css
│   ├── index.css
│   └── components/      ← Task, Project components
├── index.html           ← HTML template
├── vite.config.ts       ← Frontend build config
├── tsconfig.json
├── package.json
├── vercel.json          ← Vercel settings
├── .env.example
└── .gitignore
```

### vercel.json Explained
```json
{
  "buildCommand": "npm run build",        // Vite build command
  "outputDirectory": "dist",              // Where build goes
  "framework": "vite",                    // Frontend framework
  "rewrites": [                           // API proxy
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ],
  "env": ["ANTHROPIC_API_KEY"]            // Required env vars
}
```

---

## 🌐 API Architecture on Vercel

### How It Works
1. **Frontend** (React + Vite) → deployed as static site to CDN
2. **Backend** (`/api/index.ts`) → deployed as serverless functions
3. **Database** → in-memory SQLite (resets on cold start)

### API Endpoint Structure
```
GET  https://flowtask-ai.vercel.app/api/health
POST https://flowtask-ai.vercel.app/api/tasks
GET  https://flowtask-ai.vercel.app/api/tasks
PUT  https://flowtask-ai.vercel.app/api/tasks/:id
DELETE https://flowtask-ai.vercel.app/api/tasks/:id
... (all endpoints work the same)
```

### Serverless Cold Starts
- **First request:** ~2-3 seconds (cold start)
- **Subsequent requests:** <500ms (warm)
- **AI analysis:** +1-3 seconds (Claude API latency)

---

## 💾 Data Persistence Issue

**Current Setup:** In-memory SQLite
- ✅ Works immediately
- ❌ Data lost when function cold-starts
- ❌ Not suitable for production

### Solution 1: Vercel Postgres (Recommended)
**Cost:** Free tier available, $15/month for production

1. In Vercel Dashboard:
   - Go to **Storage** tab
   - Click **Create Database**
   - Select **Postgres**
   - Name it `flowtask-postgres`

2. It auto-adds to `.env.local`:
   ```
   POSTGRES_PRISMA_URL=postgresql://...
   POSTGRES_URL_NON_POOLING=postgresql://...
   ```

3. Install Prisma:
   ```bash
   npm install @prisma/client
   npm install -D prisma
   ```

4. Init Prisma:
   ```bash
   npx prisma init
   ```

5. Update `schema.prisma` with your entities
6. Deploy: `git push` (Vercel handles migration)

### Solution 2: External Database
Use any PostgreSQL provider:
- **Supabase** (free tier)
- **Railway** (free trial)
- **AWS RDS** (free tier)
- **DigitalOcean** ($15/month)

Add connection string to Vercel env vars:
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### Solution 3: Accept In-Memory (Demo Only)
For MVP/demo purposes, in-memory is fine:
- Great for testing
- Perfect for demos
- Not for production

---

## 📝 Step-by-Step with Postgres

### 1. Set up Vercel Postgres
```bash
# In Vercel Dashboard → Storage → Create Postgres Database
# Copy connection strings to local .env
```

### 2. Install Prisma
```bash
npm install @prisma/client
npm install -D prisma
```

### 3. Create `prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Task {
  id                       String   @id @default(cuid())
  title                    String
  description              String?
  category                 String?
  task_type                String?
  urgency                  Int?
  importance               Int?
  status                   String   @default("dump")
  ai_confidence_score      Float?
  ai_detected_type         String?
  needs_clarification      Boolean  @default(false)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}

model Project {
  id                       String   @id @default(cuid())
  name                     String
  description              String?
  status                   String   @default("active")
  color_tag                String?
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}

model UserPreferences {
  id                       String   @id @default(cuid())
  work_hours_start         String   @default("09:00")
  work_hours_end           String   @default("17:00")
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}
```

### 4. Migrate Database
```bash
npx prisma migrate dev --name init
```

### 5. Use Prisma in API
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// In your API route:
const tasks = await prisma.task.findMany()
```

---

## 🔐 Environment Variables

### Required
```
ANTHROPIC_API_KEY=sk_your_key_here
```

### Optional (if using Postgres)
```
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
```

### How to Add in Vercel
1. Go to **Project Settings**
2. Click **Environment Variables**
3. Add each variable
4. Values are encrypted at rest
5. Redeply after adding (or just `git push`)

---

## 📊 Monitoring & Logs

### View Logs in Vercel
1. Go to **Deployments** tab
2. Click latest deployment
3. Scroll to **Function Logs** section
4. See real-time logs

### Common Issues

**"Build failed"**
- Check `npm run build` works locally
- Ensure all dependencies in package.json
- Check Node version (Vercel uses v18+)

**"API returns 500"**
- Check error logs in Vercel dashboard
- Verify ANTHROPIC_API_KEY is set
- Test locally with `npm run dev`

**"Database connection error"**
- Verify connection string is correct
- Check Vercel Postgres status
- Ensure firewall allows Vercel IPs

---

## 🚀 Advanced: Custom Domain

### Add Your Domain
1. In Vercel dashboard: **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `flowtask.yourdomain.com`)
4. Add DNS records Vercel provides
5. Wait 10-60 minutes for DNS propagation

### Free Option: Subdomain
- Use `flowtask.vercel.app` (automatic)
- Or upgrade to custom domain

---

## 📈 Performance Tips

### 1. Enable Caching
Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=60, s-maxage=120"
        }
      ]
    }
  ]
}
```

### 2. Use Edge Middleware (for premium)
Reduce cold starts with edge functions.

### 3. Optimize Frontend Bundle
```bash
npm run build
# Check dist/ size
```

### 4. Database Connection Pooling
If using Postgres, use connection pooling:
```typescript
const prisma = new PrismaClient({
  log: ['error'],
})
```

---

## 🧪 Test Your Deployment

### Test API Health
```bash
curl https://flowtask-ai.vercel.app/api/health
# Response: {"status":"ok"}
```

### Create Task
```bash
curl -X POST https://flowtask-ai.vercel.app/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","urgency":3,"importance":3}'
```

### Test Frontend
Open `https://flowtask-ai.vercel.app` in browser

---

## 🔄 Continuous Deployment

### Auto-Deploy on Git Push
1. Connected GitHub repo
2. Push to `main` branch
3. Vercel auto-deploys
4. Takes ~2-3 minutes

### Rollback
- Click **Deployments** tab
- Select previous deployment
- Click **Promote to Production**

---

## 💰 Cost Estimate

| Item | Cost |
|------|------|
| Vercel (frontend) | Free |
| Vercel Serverless API | Free (up to $150/month free credits) |
| Vercel Postgres | Free tier (shared) or $15/month |
| Anthropic API (Claude) | Pay-as-you-go (~$0.003 per task) |
| **Total Typical** | **Free - $15/month** |

---

## 🛠️ Troubleshooting Vercel Deployment

### Import Repository Failed
- [ ] Ensure GitHub repo is public
- [ ] Check GitHub personal access token
- [ ] Recreate connection

### Build Fails
- [ ] Run `npm run build` locally first
- [ ] Check Node version: `node -v` (18+ required)
- [ ] Clear node_modules: `rm -rf node_modules && npm install`
- [ ] Check for environment variable references

### API Returns 502 Bad Gateway
- [ ] Check `/api/index.ts` syntax
- [ ] Verify all imports available
- [ ] Check Vercel function logs
- [ ] Test locally with `npm run dev`

### Data Not Persisting
- [ ] Use Vercel Postgres or external DB
- [ ] In-memory SQLite resets on cold start
- [ ] Add `DATABASE_URL` env var

### Cold Start Too Slow
- [ ] Normal for serverless (1-2 sec)
- [ ] Use Edge Middleware (paid feature)
- [ ] Optimize bundle size
- [ ] Consider dedicated server

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported to Vercel
- [ ] ANTHROPIC_API_KEY added to env vars
- [ ] Build successful (`npm run build` locally)
- [ ] Site deployed and accessible
- [ ] API endpoints respond (`/api/health`)
- [ ] Created test task
- [ ] Frontend loads and shows tasks
- [ ] Custom domain configured (optional)
- [ ] Database set up (if using Postgres)

---

## 📞 Need Help?

**Vercel Docs:** https://vercel.com/docs  
**Vite Docs:** https://vitejs.dev/  
**React Docs:** https://react.dev/  
**Anthropic Docs:** https://docs.anthropic.com/

---

## 🎉 You're Live!

Your FlowTask AI app is now running on Vercel!

**URL:** `https://flowtask-ai.vercel.app`

Share it, test it, iterate on it. All updates via `git push` = auto-deployed.
