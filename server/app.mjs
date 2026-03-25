import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createLogger,
  getAvailableVoices,
  getConversationTokenForAgent,
  generateFuneralExperience,
  getLiveAgentConfig,
  getSignedUrlForAgent,
} from './lib/funeral-service.mjs';
import {
  createOrReuseTrailerJob,
  getTrailerJob,
  getTrailerGenerationConfig,
  proxyTrailerVideo,
} from './lib/trailer-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

export function createApp(options = {}) {
  const { serveClient = false } = options;
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY),
      elevenConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      liveAgent: getLiveAgentConfig(),
      trailer: getTrailerGenerationConfig(),
    });
  });

  app.get('/api/debug/voices', async (_request, response) => {
    try {
      const voices = await getAvailableVoices();
      response.json({
        ok: true,
        count: voices.length,
        voices: voices.map((voice) => ({
          name: voice.name,
          voiceId: voice.voice_id,
          category: voice.category,
        })),
      });
    } catch (error) {
      response.status(500).json({
        error: error.message || 'Unable to list ElevenLabs voices.',
      });
    }
  });

  app.post('/api/funeral', async (request, response) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const logger = createLogger(requestId);

    try {
      logger('request.received', {
        route: '/api/funeral',
      });
      const experience = await generateFuneralExperience(request.body || {}, {
        requestId,
        logger,
      });
      response.json({
        ...experience,
        trailer: getTrailerGenerationConfig(),
        requestId,
      });
    } catch (error) {
      logger('request.failed', {
        error: error.message || 'Unknown error',
      });
      response.status(500).json({
        error: error.message || 'Unable to prepare the funeral.',
        requestId,
      });
    }
  });

  app.post('/api/trailer', async (request, response) => {
    try {
      const trailerJob = createOrReuseTrailerJob(request.body || {});
      response.json(trailerJob);
    } catch (error) {
      const statusCode = /GEMINI_API_KEY/i.test(error.message || '') ? 503 : 500;
      response.status(statusCode).json({
        error: error.message || 'Unable to generate the trailer.',
      });
    }
  });

  app.get('/api/trailer/:jobId', async (request, response) => {
    try {
      const trailerJob = getTrailerJob(`${request.params.jobId || ''}`);
      response.json(trailerJob);
    } catch (error) {
      const statusCode = /not found/i.test(error.message || '') ? 404 : 500;
      response.status(statusCode).json({
        error: error.message || 'Unable to load the trailer job.',
      });
    }
  });

  app.get('/api/trailer/proxy', async (request, response) => {
    try {
      const asset = await proxyTrailerVideo(
        `${request.query.jobId || ''}`,
        `${request.query.uri || ''}`,
      );
      response.setHeader('Content-Type', asset.mimeType);
      response.setHeader('Cache-Control', 'private, max-age=3600');
      response.send(asset.buffer);
    } catch (error) {
      response.status(500).json({
        error: error.message || 'Unable to fetch the trailer video.',
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

  app.get('/api/eleven/conversation-token', async (_request, response) => {
    try {
      const token = await getConversationTokenForAgent();
      response.json({ token });
    } catch (error) {
      response.status(500).json({
        error: error.message || 'Failed to fetch ElevenLabs conversation token.',
      });
    }
  });

  if (serveClient) {
    app.use(express.static(distDir));

    app.use((request, response, next) => {
      if (request.path.startsWith('/api')) {
        next();
        return;
      }

      response.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

export default createApp();
