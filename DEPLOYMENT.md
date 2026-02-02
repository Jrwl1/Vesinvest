# Deployment Guide

This guide covers deploying the Asset Maintenance app to Railway (backend) and Vercel (frontend).

## Prerequisites

- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- PostgreSQL database (Railway provides this)

---

## Backend Deployment (Railway)

### 1. Create Railway Project

```bash
# Install Railway CLI (optional, can also use web UI)
npm i -g @railway/cli
railway login
```

### 2. Create PostgreSQL Database

1. Go to Railway dashboard → New Project
2. Click "Add Service" → "Database" → "PostgreSQL"
3. Once created, copy the `DATABASE_URL` from the Variables tab

### 3. Deploy API

1. In the same project, click "Add Service" → "GitHub Repo"
2. Select your repository
3. Configure:
   - **Root Directory**: `apps/api`
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start:prod`

### 4. Set Environment Variables

In Railway dashboard → API service → Variables tab, add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | (auto-linked from PostgreSQL) | ✓ |
| `JWT_SECRET` | Random 32+ char string | ✓ |
| `NODE_ENV` | `production` | ✓ |
| `CORS_ORIGINS` | Your Vercel URL (e.g., `https://your-app.vercel.app`) | ✓ |
| `PORT` | (auto-set by Railway) | - |

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Deploy

Railway will auto-deploy on push. For manual deploy:
```bash
railway up
```

### 6. Get API URL

Once deployed, Railway provides a URL like:
```
https://your-api-production.up.railway.app
```

### 7. Seed Database (Optional)

For demo data, run the seed script:
```bash
# Connect to Railway shell
railway run pnpm prisma:seed
```

---

## Frontend Deployment (Vercel)

### 1. Import Project

1. Go to Vercel dashboard → "Add New" → "Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm install && pnpm build`
   - **Output Directory**: `dist`

### 2. Set Environment Variables

In Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_BASE_URL` | Your Railway API URL (e.g., `https://your-api.up.railway.app`) | ✓ |

### 3. Deploy

Vercel will auto-deploy on push. For manual deploy:
```bash
vercel --prod
```

### 4. Get Frontend URL

Once deployed, Vercel provides a URL like:
```
https://your-app.vercel.app
```

### 5. Update CORS

Go back to Railway and update `CORS_ORIGINS` to include your Vercel URL.

---

## Post-Deployment

### Create Admin User

The seed script creates a demo user. For production, create users via Prisma Studio or a custom script:

```bash
# On Railway
railway run pnpm prisma studio
```

Or create via API:
```bash
# Replace with your values
curl -X POST https://your-api.up.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"SecurePass123","orgId":"org-uuid"}'
```

### Verify Deployment

1. Open frontend URL
2. Login with seeded credentials:
   - Org ID: (from seed output)
   - Email: `admin@dev.local`
   - Password: `password123`

3. Test:
   - [ ] Assets page loads
   - [ ] Sites page loads
   - [ ] Projection page runs
   - [ ] Asset detail opens
   - [ ] Maintenance items create

---

## Demo URLs

After deployment, your URLs will be:

| Service | URL |
|---------|-----|
| **Frontend** | `https://your-app.vercel.app` |
| **API** | `https://your-api.up.railway.app` |
| **API Health** | `https://your-api.up.railway.app/` |

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` in Railway includes the exact Vercel URL (no trailing slash)
- Redeploy API after changing CORS settings

### Database Connection
- Check `DATABASE_URL` is correctly set
- Ensure PostgreSQL is running in Railway

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check browser console for token errors
- Clear localStorage and try again

### Build Failures
- Check Railway/Vercel build logs
- Ensure `pnpm` is available (Railway supports it)
- Verify `apps/api` or `apps/web` as root directory

---

## Local Development

```bash
# Start database (if using Docker)
docker-compose up -d postgres

# API
cd apps/api
cp .env.example .env
# Edit .env with local database URL
pnpm dev

# Frontend (separate terminal)
cd apps/web
pnpm dev
```
