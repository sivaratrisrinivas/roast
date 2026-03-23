# Roast (DeathVoice)

Roast is a dark, theatrical web app that lets someone run their own AI funeral using their public online footprint.

You enter your public X, LinkedIn, or Instagram profile. The app pulls public information, turns it into a structured profile of your "internet self," and stages a funeral where different voices speak about you. The final experience is part roast, part eulogy, and part performance.

## What This Project Is

This project is an MVP for a hackathon-style demo.

The app does four main things:

1. It collects public profile information from the web.
2. It turns that information into a short "digital remains" summary.
3. It writes a funeral script with multiple characters.
4. It optionally generates audio so each character can speak in a different voice.

The current version includes:

- A React frontend for entering profile handles and watching the funeral unfold.
- An Express backend for scraping, structuring, and scripting the funeral.
- Firecrawl integration for search, scrape, and extract workflows.
- ElevenLabs integration for voice generation.
- An optional ElevenAgents-based live officiant panel.
- A demo mode for testing the experience without real API keys.

## Why This Project Exists

The idea behind Roast is simple:

People leave behind a weird, accidental autobiography on the internet.

Their tweets, career posts, captions, and public updates all add up to a public version of who they are. This app turns that public version into a funeral service, where different people in your life seem to speak back to you using the story your own online behavior created.

Why this is interesting:

- It is funny, uncomfortable, and memorable.
- It makes public internet identity feel strangely human.
- It gives Firecrawl a strong "web data in, structured story out" use case.
- It gives ElevenLabs a strong "multiple emotional voices in one performance" use case.
- It is a great demo because people understand it instantly once they hear it.

## Who This Is For

Right now, this app is best used for:

- hackathon demos
- product demos
- internal experimentation
- creative AI showcases
- playful self-roasting

It should only be used with your own public profiles, or with clear permission from the person being roasted.

## How The User Experience Works

Here is the product flow in plain English:

1. The user opens the app.
2. The user enters a display name and one or more public profile handles or URLs.
3. The user clicks `Run My Funeral`.
4. The app gathers public information from those profiles.
5. The app turns that information into a summary of the person's public identity.
6. The app writes a funeral service with multiple characters:
   the officiant, the mom, the ex, the boss, and the best friend.
7. If ElevenLabs is configured, the script is turned into spoken audio.
8. The frontend shows the script, the profile receipts, and the generated audio player.
9. If a live ElevenAgent is configured, the user can keep talking to an officiant after the staged funeral is done.

## How The System Works

Here is the technical flow step by step:

1. The frontend sends a request to `/api/funeral`.
2. The backend reads the submitted profile handles.
3. The backend resolves those handles into public URLs.
4. Firecrawl searches and scrapes those pages.
5. Firecrawl Extract turns the raw page content into structured signals such as:
   likely identity, recurring themes, memorable quotes, work style, relationship red flags, and emotional tone.
6. The local script builder turns those signals into a funeral performance.
7. If ElevenLabs is available, the script is sent to Text to Dialogue so the characters can be voiced.
8. The backend returns the complete experience to the frontend.
9. The frontend renders the stage, receipts, script cards, and audio timeline.

## How To Run The Project

This repo now uses Bun as the main runtime and bundler.

### Step 1: Install dependencies

```bash
bun install
```

### Step 2: Create your environment file

```bash
cp .env.example .env
```

### Step 3: Add the API keys you want to use

At minimum:

- add `FIRECRAWL_API_KEY` if you want real public profile scraping
- add `ELEVENLABS_API_KEY` if you want generated funeral audio

### Step 4: Start the app

```bash
bun run dev
```

The app is served from:

- `http://localhost:3001`

### Step 5: Build for production

```bash
bun run build
bun run start
```

## Environment Variables

These are the variables used by the project.

### Required for real scraping

- `FIRECRAWL_API_KEY`

Without this, the app falls back to demo mode behavior unless you explicitly disable that path later.

### Required for generated audio

- `ELEVENLABS_API_KEY`

Without this, the app still works, but it returns script-only results with no generated voice audio.

### Optional for a live officiant

- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_AGENT_REQUIRES_AUTH`

If these are set, the live officiant panel can start a conversation after the prerecorded funeral finishes.

### Optional voice overrides

- `ELEVEN_VOICE_OFFICIANT_ID`
- `ELEVEN_VOICE_MOM_ID`
- `ELEVEN_VOICE_EX_ID`
- `ELEVEN_VOICE_BOSS_ID`
- `ELEVEN_VOICE_BEST_FRIEND_ID`

These let you swap the voices used for each speaker.

### Other optional values

- `ELEVENLABS_TTS_MODEL_ID`
- `PORT`

## Demo Mode

Demo mode is included so the app can still be shown even if the API setup is not finished.

When demo mode is turned on:

1. The app skips real scraping.
2. The backend creates synthetic profile receipts.
3. The script still gets generated.
4. If ElevenLabs is configured, you can still hear the staged voices.

This is useful when you want to:

- design the frontend
- test the flow quickly
- practice the demo
- show the product before wiring all production keys

## Project Structure

High-level layout:

- `src/`
  the frontend app
- `server/`
  the backend routes and funeral-generation logic
- `scripts/`
  Bun helper scripts for running and building the app
- `.env.example`
  sample environment variables

Important files:

- `src/App.jsx`
  main frontend shell
- `src/components/FuneralForm.jsx`
  profile input form
- `src/components/FuneralStage.jsx`
  main funeral stage UI
- `src/components/AgentWakePanel.jsx`
  optional live officiant panel
- `server/index.mjs`
  Express entrypoint
- `server/lib/funeral-service.mjs`
  main orchestration logic
- `server/lib/funeral-script.mjs`
  script-writing logic
- `server/lib/mock-data.mjs`
  demo mode data

## Important Notes

### Consent and safety

This project is meant for:

- your own public profiles
- public profiles you are clearly allowed to use

It should not be used as a harassment tool.

### What counts as "public"

The app only makes sense when the source data is already public on the web.
It is not built to access private messages, hidden profiles, or anything behind consent boundaries.

### Audio is optional

The product still works without ElevenLabs audio.
In that case, the user gets:

- the structured receipts
- the staged funeral script
- the visual funeral timeline without voice playback

### Live officiant is optional

The core product does not depend on the live officiant panel.
That panel is an extra layer for a more interactive demo.

### Bun-specific note

This project originally used Vite for the frontend build, but `vite build` hung under Bun in this environment.
The project now uses Bun's native HTML bundler instead, which has been verified locally in this repo.

## What Has Been Verified

These flows were verified in this workspace:

1. `bun install`
2. `bun run build`
3. `bun run start`
4. `bun run dev`

The Bun build now outputs a production bundle into `dist/`.

## If You Want To Demo This Live

A simple demo path:

1. Start the app.
2. Turn on demo mode if your keys are not ready.
3. Enter a display name and a sample handle.
4. Click `Run My Funeral`.
5. Play the audio if ElevenLabs is configured.
6. Open the officiant panel if an agent is configured.
7. Ask follow-up questions like:
   "Who should speak next?"
   "What was the saddest receipt?"
   "What would the boss never say out loud?"

## References

- [Firecrawl Search docs](https://docs.firecrawl.dev/features/search)
- [Firecrawl Extract docs](https://docs.firecrawl.dev/features/extract)
- [ElevenLabs ElevenAgents overview](https://elevenlabs.io/docs/eleven-agents/overview)
- [ElevenLabs React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [ElevenLabs Text to Dialogue quickstart](https://elevenlabs.io/docs/cookbooks/text-to-dialogue)
- [ElevenLabs signed URL endpoint](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url)
