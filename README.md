# ROAST

ROAST turns one public profile into a dark, theatrical AI funeral.

Paste one public profile, handle, GitHub, or website. ROAST searches the public web for usable signals, turns them into a funeral-style roast, and performs it with ElevenLabs.

## What It Does

ROAST is built to do one thing well:

1. Take one public profile or handle.
2. Find useful public web material.
3. Turn that material into a sharp funeral-style roast.
4. Perform it as a staged funeral.

The product flow stays simple:

1. Click `Start`.
2. Paste one public profile and click `Generate ROAST`.
3. Click `Start Live ROAST` or `Play ROAST`.

That keeps the main goal achievable in no more than 3 clicks.

## How It Works

In plain English:

1. The frontend sends the pasted profile to `/api/funeral`.
2. The backend figures out what kind of input it is.
3. Firecrawl Search runs several queries to find public pages with real text.
4. The backend filters out thin or junk results and keeps the strongest sources.
5. Firecrawl Agent tries to turn those sources into a structured dossier.
6. If Firecrawl Agent is slow or fails, Firecrawl Extract is used as a fallback.
7. If both fail, the backend still builds a simpler local dossier.
8. The app writes a six-part funeral script: officiant, mom, ex, boss, best friend, officiant.
9. If an ElevenLabs agent is configured, ROAST starts a live ElevenAgent session and gives it the funeral prompt, context, and kickoff message.
10. If no ElevenLabs agent is configured, ROAST falls back to ElevenLabs text-to-dialogue and generates a multi-speaker audio file.
11. The result screen gives the user one action to start the performance.

## Tech Stack

- React
- Express
- Bun
- Firecrawl
- ElevenLabs

## Run It

1. Install dependencies:

```bash
bun install
```

2. Create your local env file:

```bash
cp .env.example .env
```

3. Add your real API keys and optional agent settings to `.env`.

4. Start the app:

```bash
bun run dev
```

Open:

- `http://localhost:3001`

For a production build:

```bash
bun run build
bun run start
```

## Deploy on Vercel

This repo is now set up for Vercel with Bun.

What changes for Vercel:

1. The frontend build goes to `public/` instead of `dist/`.
2. Vercel serves `public/` as static files.
3. The Express API is exported from `server.mjs` and runs as the backend function.

Deploy steps:

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. In Vercel project settings, add the same environment variables you use locally:
   - `FIRECRAWL_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID` if you want live ElevenAgent mode
   - any optional voice override IDs you use
4. Deploy.

Vercel uses:

- `bun install`
- `bun run build:vercel`
- Bun runtime via `bunVersion: "1.x"`

Local Bun dev still works the same:

```bash
bun run dev
```

## Environment Variables

Put these in:

- `.env` at the project root

Required:

- `FIRECRAWL_API_KEY`
- `ELEVENLABS_API_KEY`

Optional:

- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_AGENT_REQUIRES_AUTH`
- `ELEVEN_VOICE_OFFICIANT_ID`
- `ELEVEN_VOICE_MOM_ID`
- `ELEVEN_VOICE_EX_ID`
- `ELEVEN_VOICE_BOSS_ID`
- `ELEVEN_VOICE_BEST_FRIEND_ID`
- `ELEVENLABS_TTS_MODEL_ID`
- `PORT`

If `FIRECRAWL_API_KEY` is missing, the backend falls back to mock data.

If `ELEVENLABS_API_KEY` is missing, the app still returns the written roast but without performance audio.

If `ELEVENLABS_AGENT_ID` is set, ROAST prefers live ElevenAgent mode.

If `ELEVENLABS_AGENT_ID` is not set, ROAST falls back to pre-generated dialogue audio.

## Project Structure

- `src/` contains the frontend
- `server/` contains the backend logic
- `scripts/` contains Bun helper scripts
- `.env.example` shows the expected env vars

Important files:

- `src/App.jsx`
- `src/components/FuneralForm.jsx`
- `src/components/FuneralStage.jsx`
- `server/app.mjs`
- `server/index.mjs`
- `server.mjs`
- `server/lib/funeral-service.mjs`
- `server/lib/funeral-script.mjs`
- `server/lib/mock-data.mjs`

## Notes

- Use this on your own public profile, or with clear permission.
- The UI is intentionally minimal to keep cognitive load low.
- The app uses Bun's native HTML bundler for builds.
- GitHub and personal sites currently make the strongest demo inputs.
- Social links can still help, but ROAST does not depend on direct social scraping.

## References

- [Firecrawl Search docs](https://docs.firecrawl.dev/features/search)
- [Firecrawl Extract docs](https://docs.firecrawl.dev/features/extract)
- [Firecrawl Agent docs](https://docs.firecrawl.dev/features/agent)
- [ElevenLabs docs](https://elevenlabs.io/docs)
- [ElevenAgents React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [ElevenLabs Text to Dialogue quickstart](https://elevenlabs.io/docs/cookbooks/text-to-dialogue)
