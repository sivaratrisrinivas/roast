import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateFuneralExperience,
  getLiveAgentConfig,
  getSignedUrlForAgent,
} from './lib/funeral-service.mjs';

const app = express();
const port = Number(process.env.PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY),
    elevenConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    liveAgent: getLiveAgentConfig(),
  });
});

app.post('/api/funeral', async (request, response) => {
  try {
    const experience = await generateFuneralExperience(request.body || {});
    response.json(experience);
  } catch (error) {
    response.status(500).json({
      error: error.message || 'Unable to prepare the funeral.',
    });
  }
});

app.get('/api/eleven/signed-url', async (_request, response) => {
  try {
    const signedUrl = await getSignedUrlForAgent();
    response.json({ signedUrl });
  } catch (error) {
    response.status(500).json({
      error: error.message || 'Failed to fetch ElevenLabs signed URL.',
    });
  }
});

app.use(express.static(distDir));

app.use((request, response, next) => {
  if (request.path.startsWith('/api')) {
    next();
    return;
  }

  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Roast server listening on http://localhost:${port}`);
});
