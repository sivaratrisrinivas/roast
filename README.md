# ROAST

ROAST turns a public profile into a live, interactive AI funeral.

Paste a public profile, handle, GitHub, or website. ROAST uses Firecrawl to scrape the public web for real signal, extracts a structured dossier, writes a multi-character roast script, and seamlessly hands it off to an ElevenLabs Conversational AI Agent (DeathVoice) to perform live in your browser.

## What It Does

ROAST is built to do one thing well:

1. Take one public profile URL or handle.
2. Find useful public web material.
3. Turn that material into a sharp funeral-style roast.
4. Perform it live via an ElevenLabs Agent.

The product flow stays simple:

1. Paste a public profile and click `Summon the Funeral`.
2. Wait while the AI reads the internet and extracts receipts (The Conjuring).
3. Connect your mic and listen to the agent deliver your eulogy (The Funeral).

## How It Works

In plain English:

1. The frontend sends the pasted profile to `/api/funeral`.
2. The backend figures out what kind of input it is (X, LinkedIn, GitHub, etc.).
3. Firecrawl Search runs multiple parallel queries to find public pages with real text.
4. The backend filters out thin or junk results and keeps the strongest sources.
5. Firecrawl AI extracts a structured dossier (quotes, bragging patterns, red flags).
6. A multi-part funeral script (Officiant, Ex, Best Friend) is drafted from the dossier.
7. The App initializes an ElevenLabs Conversational AI session via WebSocket.
8. The dossier and script are sent to the agent as real-time context.
9. The DeathVoice agent performs the funeral live in your browser.

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
3. The Express API is exposed through `api/[...path].mjs`, which mounts the existing backend as a Vercel Function.

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
- `api/[...path].mjs`
- `server/app.mjs`
- `server/index.mjs`
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
