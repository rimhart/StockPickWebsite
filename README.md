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
5. Deploy.

## Important note

The RL governor currently keeps its learning state in memory when filesystem writes are unavailable.
That means the site will work on Vercel, but the learning history may reset on cold starts or new serverless instances.
For durable learning, connect the governor state to an external store such as Vercel KV, Supabase, or Postgres.
