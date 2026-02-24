# ═══════════════════════════════════════════════════════════
# Railway + Vercel Deployment Guide for PUSO Spaze
# ═══════════════════════════════════════════════════════════

## 🚀 BACKEND DEPLOYMENT (Railway)

### Step 1: Create Railway Account
1. Go to: https://railway.app
2. Sign up with GitHub (recommended)
3. Create new project → "Deploy from GitHub"

### Step 2: Connect GitHub Repository
1. Select your `puso-spaze` repository
2. Select `/server` as the root directory
3. Click "Deploy"

### Step 3: Configure Environment Variables in Railway
In Railway dashboard, add these environment variables:

```
DATABASE_URL=postgresql://[user]:[pass]@[host]:[port]/[db]
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=your_openai_key_here
GMAIL_USER=your_gmail@gmail.com
GMAIL_PASS=your_app_password_here
```

**Note:** Railway provides DATABASE_URL automatically. Just add the others.

### Step 4: Custom Domain Setup
1. In Railway dashboard → Settings → Domains
2. Add custom domain: `api.puso-spaze.org`
3. Copy the provided CNAME record (Railway will give you)
4. Go to Squarespace DNS settings (see Step 5 below)

---

## 🌐 FRONTEND DEPLOYMENT (Vercel)

### Step 1: Create Vercel Account
1. Go to: https://vercel.com
2. Sign up with GitHub
3. Import your repository

### Step 2: Configure Build Settings in Vercel
- **Root Directory:** `apps/mobile`
- **Build Command:** `npm run build` or `npm run export`
- **Output Directory:** `.next` or `build` (depends on your setup)

**If Vercel asks for framework:** Select "React"

### Step 3: Add Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```
REACT_APP_API_URL=https://api.puso-spaze.org
```

### Step 4: Deploy
1. Click "Deploy"
2. Vercel automatically deploys on every GitHub push

### Step 5: Custom Domain
1. In Vercel dashboard → Settings → Domains
2. Add domain: `puso-spaze.org`
3. Vercel will provide DNS records (CNAME or A records)

---

## 🔗 DNS CONFIGURATION (Squarespace)

### Add DNS Records in Squarespace:

1. Go to: Squarespace → Domains → `puso-spaze.org` → DNS Settings

2. **For Vercel (Main Frontend):**
   - Add CNAME record from Vercel
   - Or use Vercel's nameservers (recommended)

3. **For Railway (Backend API):**
   - Add CNAME record: `api.puso-spaze.org` → Railway's provided CNAME
   - Or add A record if Railway provides one

**Typical DNS Setup:**
```
Record Type | Name | Value
-----------|------|-------
CNAME      | www  | cname.vercel-dns.com
A          | @    | 76.76.19.61 (example)
CNAME      | api  | [railway-provided-url]
```

---

## ✅ VERIFICATION

Once deployed, test:

```bash
# Backend API
curl https://api.puso-spaze.org/api/posts

# Frontend
Visit: https://puso-spaze.org
```

---

## 📝 IMPORTANT NOTES

1. **DNS Propagation:** Changes take 24-48 hours to fully propagate
2. **SSL/HTTPS:** Both Vercel and Railway provide free SSL certificates
3. **Database:** Railway includes managed PostgreSQL in their plans
4. **Cost:**
   - Railway: ~$5-20/month (depending on usage)
   - Vercel: Free tier available
   - Domain: ~$9-12/year

---

## 🆘 TROUBLESHOOTING

- **Deploy fails?** Check logs in Railway/Vercel dashboards
- **API not connecting?** Verify `REACT_APP_API_URL` env var
- **Domain not working?** Wait 24-48 hours for DNS propagation
- **Database errors?** Run migrations in Railway release phase

