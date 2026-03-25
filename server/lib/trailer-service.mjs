import crypto from 'node:crypto';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_VEO_MODEL =
  process.env.GEMINI_VEO_MODEL || 'veo-3.1-fast-generate-preview';
const DEFAULT_ASPECT_RATIO = '9:16';
const DEFAULT_DURATION_SECONDS = 8;
const DEFAULT_RESOLUTION = '720p';
const POLL_INTERVAL_MS = 8000;
const MAX_POLL_ATTEMPTS = 45;
const MAX_SCENE_ATTEMPTS = 2;
const DONE_POLL_INTERVAL_MS = 3000;
const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const trailerJobs = new Map();
const trailerJobKeys = new Map();

function requireGeminiApiKey(overrideApiKey = '') {
  const suppliedKey = `${overrideApiKey || ''}`.trim();

  if (suppliedKey) {
    return suppliedKey;
  }

  throw new Error(
    'Add your own GEMINI_API_KEY to generate trailer video.',
  );
}

function fingerprintApiKey(value = '') {
  return crypto
    .createHash('sha256')
    .update(`${value}`.trim())
    .digest('hex');
}

function stripPerformanceTags(text = '') {
  return `${text}`.replace(/\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function trimText(value = '', maxLength = 220) {
  const cleaned = `${value}`.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function hashSeed(value = '') {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }

  return hash || 7;
}

function extractInspirationLine(text = '') {
  const cleaned = stripPerformanceTags(text);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const quotedSentence = sentences.find((sentence) => /["“”]/.test(sentence));
  const selectedSentence = quotedSentence || sentences[0] || cleaned;

  return trimText(selectedSentence, 190);
}

function buildScenePrompt(scene, sharedContext) {
  const sameSetDirection =
    'Keep the same memorial-chapel world across both scenes: dark wood, candle glow, soft dust in the air, elegant but slightly absurd dark-comedy tone.';

  return [
    `Vertical 9:16 cinematic memorial trailer, scene ${scene.index + 1} of ${sharedContext.totalScenes}.`,
    sameSetDirection,
    `Primary speaker energy: ${scene.label}. Mood: ${scene.mood}.`,
    `The internet self being mourned is "${sharedContext.subjectName}".`,
    `Core emotional beat: ${scene.inspirationLine}.`,
    scene.receiptDetail
      ? `Visual motif to weave in: ${scene.receiptDetail}.`
      : '',
    scene.index === 0
      ? 'Shot design: intimate portrait framing, slow dolly-in, tender expression, phone and laptop glow suggesting a life lived online.'
      : 'Shot design: same chapel, camera gently circling, sly funny details, memorial objects that hint at online chaos and over-sharing.',
    'Style: realistic, polished, witty, emotionally grounded, not cartoonish, not horror, not grotesque.',
    'No subtitles, no on-screen text, no logos, no watermark, no title cards.',
    'Audio: soft chapel ambience only, room tone and subtle movement, no spoken dialogue.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildTrailerStoryboard(payload = {}) {
  const script = Array.isArray(payload.script) ? payload.script.slice(0, 2) : [];
  const receipts = Array.isArray(payload.receipts) ? payload.receipts : [];

  if (!script.length) {
    throw new Error('Trailer Mode needs at least one eulogy segment.');
  }

  const subjectName = trimText(
    payload.subjectName || 'the dearly over-shared',
    80,
  );
  const sharedContext = {
    subjectName,
    totalScenes: script.length,
  };
  const baseSeed = hashSeed(
    `${subjectName}:${payload.summary || ''}:${script.map((segment) => segment.id).join('|')}`,
  );

  return script.map((segment, index) => {
    const receipt = receipts[index] || receipts[0] || null;
    const mood =
      segment.speaker === 'mom'
        ? 'tender, bruised, affectionate, quietly funny'
        : 'dry, observant, darkly playful, lightly chaotic';

    const scene = {
      id: `scene-${index + 1}`,
      index,
      label: segment.label || `Scene ${index + 1}`,
      mood,
      inspirationLine: extractInspirationLine(segment.text),
      receiptDetail: receipt
        ? trimText(`${receipt.heading}: ${receipt.detail}`, 180)
        : '',
      seed: baseSeed + index * 97,
    };

    return {
      ...scene,
      prompt: buildScenePrompt(scene, sharedContext),
    };
  });
}

function cleanupExpiredJobs() {
  const now = Date.now();

  for (const [jobId, job] of trailerJobs.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) {
      trailerJobs.delete(jobId);
      if (job.key) {
        trailerJobKeys.delete(job.key);
      }
    }
  }
}

function buildTrailerKey(payload = {}, apiKey = '') {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        apiKeyFingerprint: fingerprintApiKey(apiKey),
        subjectName: payload.subjectName || '',
        summary: payload.summary || '',
        receipts: payload.receipts || [],
        script: payload.script || [],
      }),
    )
    .digest('hex');
}

async function geminiRequest(path, options = {}) {
  const apiKey = requireGeminiApiKey(options.apiKey);
  const response = await fetch(`${GEMINI_API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.error?.message ||
      payload.message ||
      `Gemini request failed with status ${response.status}.`,
    );
  }

  return response.json();
}

async function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function extractGeneratedVideo(payload = {}) {
  const video =
    payload.response?.generatedVideos?.[0]?.video ||
    payload.response?.generateVideoResponse?.generatedSamples?.[0]?.video ||
    payload.response?.generateVideoResponse?.generatedVideos?.[0]?.video ||
    null;

  const uri =
    video?.uri ||
    video?.downloadUri ||
    video?.fileUri ||
    null;

  if (!uri) {
    throw new Error('Gemini did not return a downloadable video URI.');
  }

  return {
    uri,
    mimeType: video.mimeType || 'video/mp4',
  };
}

function isMissingVideoError(error) {
  return /downloadable video uri/i.test(error?.message || '');
}

async function generateSceneVideoOnce(scene, apiKey) {
  const operation = await geminiRequest(
    `/models/${DEFAULT_VEO_MODEL}:predictLongRunning`,
    {
      method: 'POST',
      apiKey,
      body: {
        instances: [
          {
            prompt: scene.prompt,
          },
        ],
        parameters: {
          aspectRatio: DEFAULT_ASPECT_RATIO,
          durationSeconds: DEFAULT_DURATION_SECONDS,
          resolution: DEFAULT_RESOLUTION,
          personGeneration: 'allow_all',
          seed: scene.seed,
        },
      },
    },
  );

  if (!operation?.name) {
    throw new Error('Gemini did not return an operation name for video generation.');
  }

  let current = operation;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (current.done) {
      if (current.error) {
        throw new Error(
          current.error.message || 'Gemini trailer generation failed.',
        );
      }

      try {
        return extractGeneratedVideo(current);
      } catch (error) {
        if (!isMissingVideoError(error) || attempt === MAX_POLL_ATTEMPTS - 1) {
          throw error;
        }
      }
    }

    await sleep(current.done ? DONE_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
    current = await geminiRequest(`/${current.name}`, { apiKey });
  }

  throw new Error('Gemini trailer generation timed out.');
}

async function generateSceneVideo(scene, apiKey) {
  let lastError;

  for (let attempt = 0; attempt < MAX_SCENE_ATTEMPTS; attempt += 1) {
    try {
      return await generateSceneVideoOnce({
        ...scene,
        seed: scene.seed + attempt * 1009,
      }, apiKey);
    } catch (error) {
      lastError = error;

      if (!isMissingVideoError(error) || attempt === MAX_SCENE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Gemini trailer generation failed.');
}

function validateProxyUri(rawValue = '') {
  let uri;

  try {
    uri = new URL(rawValue);
  } catch (_error) {
    throw new Error('Invalid trailer video URL.');
  }

  if (uri.protocol !== 'https:') {
    throw new Error('Trailer video URL must use HTTPS.');
  }

  const hostname = uri.hostname.toLowerCase();
  const allowed =
    hostname === 'generativelanguage.googleapis.com' ||
    hostname.endsWith('.googleapis.com') ||
    hostname.endsWith('.googleusercontent.com');

  if (!allowed) {
    throw new Error('Trailer video URL is not from an allowed Gemini host.');
  }

  return uri.toString();
}

export function getTrailerGenerationConfig() {
  return {
    available: false,
    serverConfigured: Boolean(process.env.GEMINI_API_KEY),
    supportsUserProvidedKey: true,
    requiresUserProvidedKey: true,
    model: DEFAULT_VEO_MODEL,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    durationSeconds: DEFAULT_DURATION_SECONDS,
    resolution: DEFAULT_RESOLUTION,
  };
}

function serializeTrailerJob(job) {
  return {
    jobId: job.id,
    status: job.status,
    error: job.error || '',
    generatedAt: job.generatedAt || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    config: getTrailerGenerationConfig(),
    progress: {
      sceneCount: job.sceneCount,
      completedScenes: job.completedScenes,
      currentSceneIndex:
        job.status === 'ready'
          ? job.sceneCount
          : Math.min(job.completedScenes + 1, job.sceneCount),
      currentSceneLabel:
        job.currentSceneLabel ||
        (job.completedScenes < job.sceneCount
          ? job.sceneLabels[job.completedScenes] || ''
          : ''),
    },
    scenes: job.scenes.map((scene) => ({
      ...scene,
      videoUrl: `/api/trailer/proxy?jobId=${encodeURIComponent(job.id)}&uri=${encodeURIComponent(scene.videoUri)}`,
    })),
  };
}

async function runTrailerJob(job, payload = {}) {
  const scenes = buildTrailerStoryboard(payload);
  job.status = 'running';
  job.sceneCount = scenes.length;
  job.sceneLabels = scenes.map((scene) => scene.label);
  job.updatedAt = Date.now();

  for (const scene of scenes) {
    job.currentSceneLabel = scene.label;
    job.updatedAt = Date.now();
    const video = await generateSceneVideo(scene, job.apiKey);
    job.scenes.push({
      id: scene.id,
      label: scene.label,
      caption: scene.inspirationLine,
      prompt: scene.prompt,
      videoUri: video.uri,
      mimeType: video.mimeType,
    });
    job.completedScenes += 1;
    job.updatedAt = Date.now();
  }

  job.generatedAt = new Date().toISOString();
  job.status = 'ready';
  job.currentSceneLabel = '';
  job.updatedAt = Date.now();
}

function createTrailerJob(payload = {}) {
  cleanupExpiredJobs();
  const apiKey = requireGeminiApiKey(payload.geminiApiKey);

  const key = buildTrailerKey(payload, apiKey);
  const existingJobId = trailerJobKeys.get(key);

  if (existingJobId) {
    const existingJob = trailerJobs.get(existingJobId);

    if (existingJob) {
      return existingJob;
    }

    trailerJobKeys.delete(key);
  }

  const job = {
    id: crypto.randomUUID().slice(0, 8),
    key,
    status: 'queued',
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    generatedAt: null,
    completedScenes: 0,
    sceneCount: 0,
    currentSceneLabel: '',
    sceneLabels: [],
    scenes: [],
    promise: null,
    apiKey,
  };

  job.promise = runTrailerJob(job, payload).catch((error) => {
    job.status = 'error';
    job.error = error?.message || 'Unable to generate the trailer.';
    job.currentSceneLabel = '';
    job.updatedAt = Date.now();
  });

  trailerJobs.set(job.id, job);
  trailerJobKeys.set(key, job.id);

  return job;
}

export function createOrReuseTrailerJob(payload = {}) {
  const job = createTrailerJob(payload);
  return serializeTrailerJob(job);
}

export function getTrailerJob(jobId = '') {
  cleanupExpiredJobs();

  const job = trailerJobs.get(jobId);

  if (!job) {
    throw new Error('Trailer job not found.');
  }

  return serializeTrailerJob(job);
}

export async function generateFuneralTrailer(payload = {}) {
  const job = createTrailerJob(payload);
  await job.promise;

  if (job.status === 'error') {
    throw new Error(job.error || 'Unable to generate the trailer.');
  }

  return {
    generatedAt: job.generatedAt,
    config: getTrailerGenerationConfig(),
    scenes: job.scenes,
  };
}

export async function proxyTrailerVideo(jobId = '', rawUri = '') {
  cleanupExpiredJobs();
  const uri = validateProxyUri(rawUri);
  const job = trailerJobs.get(jobId);

  if (!job) {
    throw new Error('Trailer job not found.');
  }

  const apiKey = requireGeminiApiKey(job.apiKey);
  const response = await fetch(uri, {
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to download trailer video (${response.status}).`);
  }

  return {
    mimeType: response.headers.get('content-type') || 'video/mp4',
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}
