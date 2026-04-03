Create or modify a Vercel serverless API route.

Rules:

- File goes in `api/` directory
- Export default async function handler(req, res)
- Check `req.method` for GET/POST routing
- Return JSON with `res.status(200).json({ ... })`
- Error responses: `res.status(4xx/5xx).json({ error: "中文錯誤訊息" })`
- Environment variables from `process.env` (defined in `.env`)
- FinMind API token: `process.env.FINMIND_TOKEN`
- Claude API key: `process.env.ANTHROPIC_API_KEY`
- Add the endpoint to `API_ENDPOINTS` in `src/constants.js` if it's new
- Vercel function timeout: default 10s, max 300s (set in vercel.json)
