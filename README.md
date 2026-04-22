# StockPickWebsite

BSJP Meta-Governor for IHSG sector picks.

## Local run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to GitHub + Vercel

1. Create a GitHub repository.
2. In this folder, run:

```bash
git init
git add .
git commit -m "Initial deploy-ready version"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

3. Go to Vercel and import the GitHub repository.
4. Keep the default Next.js settings.
5. Add a `DATABASE_URL` environment variable in Vercel.
6. Deploy.

## Important note

The RL governor now persists its learning state in PostgreSQL when `DATABASE_URL` is set.
For Vercel, use a managed Postgres provider such as Neon or Vercel Postgres and point `DATABASE_URL` to it.
If `DATABASE_URL` is missing, the app still runs with an in-memory fallback, but learning will reset on cold starts.
