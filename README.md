# ROAST

ROAST turns one public profile into a dark, theatrical AI funeral.

Paste a public X, LinkedIn, or Instagram profile. ROAST pulls the public version of that person from the web, writes a funeral script, and, if ElevenLabs is configured, plays it back in multiple voices.

## What It Does

ROAST is built to do one thing well:

1. Take one public profile as input.
2. Pull public information from the web.
3. Turn that into a sharp funeral-style roast.
4. Play the result back as audio when voice generation is available.

The product flow is intentionally simple:

1. Click `Start`.
2. Paste one public profile and click `Generate ROAST`.
3. Click `Play ROAST`.

That keeps the main goal achievable in no more than 3 clicks.

## How It Works

In plain English:

1. The frontend sends the pasted profile to `/api/funeral`.
2. The backend figures out which platform it belongs to.
3. Firecrawl searches and scrapes the public page.
4. Firecrawl Extract turns the raw page into structured signals.
5. The app writes a funeral script from those signals.
6. ElevenLabs turns that script into voiced audio if an API key is available.
7. The frontend shows a clean result screen with one action: play the roast.

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

3. Add your real API keys to `.env`.

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

## Environment Variables

Put these in:

- `.env` at the project root

Required:

- `FIRECRAWL_API_KEY`
- `ELEVENLABS_API_KEY`

Optional:

- `ELEVEN_VOICE_OFFICIANT_ID`
- `ELEVEN_VOICE_MOM_ID`
- `ELEVEN_VOICE_EX_ID`
- `ELEVEN_VOICE_BOSS_ID`
- `ELEVEN_VOICE_BEST_FRIEND_ID`
- `ELEVENLABS_TTS_MODEL_ID`
- `PORT`

If `FIRECRAWL_API_KEY` is missing, the backend falls back to mock data.
If `ELEVENLABS_API_KEY` is missing, the app still returns the written roast but without generated audio.

## Project Structure

- `src/` contains the frontend
- `server/` contains the backend logic
- `scripts/` contains Bun helper scripts
- `.env.example` shows the expected env vars

Important files:

- `src/App.jsx`
- `src/components/FuneralForm.jsx`
- `src/components/FuneralStage.jsx`
- `server/index.mjs`
- `server/lib/funeral-service.mjs`
- `server/lib/funeral-script.mjs`
- `server/lib/mock-data.mjs`

## Notes

- Use this on your own public profile, or with clear permission.
- The current UI is intentionally minimal to keep cognitive load low.
- The app now uses Bun's native HTML bundler for builds.

## References

- [Firecrawl Search docs](https://docs.firecrawl.dev/features/search)
- [Firecrawl Extract docs](https://docs.firecrawl.dev/features/extract)
- [ElevenLabs docs](https://elevenlabs.io/docs)
- [ElevenLabs Text to Dialogue quickstart](https://elevenlabs.io/docs/cookbooks/text-to-dialogue)
