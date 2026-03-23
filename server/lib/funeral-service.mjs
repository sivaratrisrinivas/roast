import { buildFuneralScript, getSpeakerCatalog } from './funeral-script.mjs';
import { buildMockExperience } from './mock-data.mjs';

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v2';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function normalizeHandle(value = '') {
  return value
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?x\.com\//i, '')
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '');
}

function inferPlatformFromInput(rawValue = '') {
  const trimmed = rawValue.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.includes('linkedin.com') ||
    trimmed.startsWith('linkedin:')
  ) {
    return 'linkedin';
  }

  if (
    trimmed.includes('instagram.com') ||
    trimmed.startsWith('instagram:')
  ) {
    return 'instagram';
  }

  return 'x';
}

function collectRequestedProfiles(input = {}) {
  const rawProfiles = [];

  if (input.profileInput) {
    const inferredPlatform = inferPlatformFromInput(input.profileInput);

    if (inferredPlatform) {
      rawProfiles.push([inferredPlatform, input.profileInput]);
    }
  }

  rawProfiles.push(
    ['x', input.xHandle],
    ['linkedin', input.linkedinHandle],
    ['instagram', input.instagramHandle],
  );

  const seen = new Set();

  return rawProfiles.filter(([platform, value]) => {
    if (!value) {
      return false;
    }

    const key = `${platform}:${value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function trimText(value, maxLength = 280) {
  if (!value) {
    return '';
  }

  const cleaned = value.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function getLiveAgentConfig() {
  const configured = Boolean(process.env.ELEVENLABS_AGENT_ID);
  const requiresAuth = process.env.ELEVENLABS_AGENT_REQUIRES_AUTH !== 'false';

  return {
    configured,
    requiresAuth,
    agentId: configured && !requiresAuth ? process.env.ELEVENLABS_AGENT_ID : null,
    officiantVoiceId:
      process.env.ELEVEN_VOICE_OFFICIANT_ID || 'JBFqnCBsd6RMkjVDRZzb',
  };
}

async function firecrawlRequest(path, body, init = {}) {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is missing.');
  }

  const headers = {
    Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };

  const response = await fetch(`${FIRECRAWL_API_BASE}${path}`, {
    method: init.method || 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || 'Firecrawl request failed.');
  }

  return payload;
}

async function elevenlabsRequest(path, body) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is missing.');
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail?.message || payload.message || 'ElevenLabs request failed.');
  }

  return payload;
}

async function scrapeUrl(url) {
  const payload = await firecrawlRequest('/scrape', {
    url,
    formats: ['markdown'],
    onlyMainContent: true,
    timeout: 30000,
  });

  return {
    url,
    title: payload.data?.metadata?.title || payload.metadata?.title || url,
    description:
      payload.data?.metadata?.description || payload.metadata?.description || '',
    markdown: payload.data?.markdown || payload.markdown || '',
  };
}

async function searchProfile(platform, rawValue) {
  const value = normalizeHandle(rawValue);

  if (!value) {
    return null;
  }

  const directUrlByPlatform = {
    x: isUrl(rawValue) ? rawValue : `https://x.com/${value}`,
    linkedin: isUrl(rawValue) ? rawValue : `https://www.linkedin.com/in/${value}`,
    instagram: isUrl(rawValue)
      ? rawValue
      : `https://www.instagram.com/${value}/`,
  };

  if (platform === 'x' || platform === 'instagram') {
    const url = directUrlByPlatform[platform];

    try {
      const scraped = await scrapeUrl(url);
      return {
        platform,
        url,
        display: value,
        ...scraped,
      };
    } catch (_error) {
      const searchPayload = await firecrawlRequest('/search', {
        query: `"${value}" site:${platform === 'x' ? 'x.com' : 'instagram.com'}`,
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 30000,
        },
      });

      const results = searchPayload.data?.web || [];
      const firstMatch =
        results.find((result) => result.url?.includes(value)) || results[0];

      if (firstMatch) {
        return {
          platform,
          url: firstMatch.url,
          display: value,
          title: firstMatch.title || value,
          description: firstMatch.description || '',
          markdown: firstMatch.markdown || '',
        };
      }

      return {
        platform,
        url,
        display: value,
        title: value,
        description: '',
        markdown: '',
      };
    }
  }

  const searchQuery = isUrl(rawValue) ? rawValue : `"${value}" site:linkedin.com/in`;
  const payload = await firecrawlRequest('/search', {
    query: searchQuery,
    limit: 3,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30000,
    },
  });

  const results = payload.data?.web || [];
  const firstMatch =
    results.find((result) => result.url?.includes('linkedin.com/in')) || results[0];

  if (!firstMatch) {
    return {
      platform,
      url: directUrlByPlatform.linkedin,
      display: value,
      title: value,
      description: '',
      markdown: '',
    };
  }

  return {
    platform,
    url: firstMatch.url,
    display: value,
    title: firstMatch.title || value,
    description: firstMatch.description || '',
    markdown: firstMatch.markdown || '',
  };
}

function buildFallbackDossier(profiles, input = {}) {
  const combinedText = profiles
    .flatMap((profile) => [profile.title, profile.description, profile.markdown])
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  const excerpt = trimText(combinedText, 240);

  return {
    subject: {
      probableName:
        input.displayName ||
        normalizeHandle(
          input.profileInput ||
            input.xHandle ||
            input.linkedinHandle ||
            input.instagramHandle,
        ) ||
        'Unknown subject',
      profession: 'person discoverable through public profile breadcrumbs',
      selfMythology:
        excerpt || 'Presented an online self that was polished, busy, and occasionally too revealing.',
    },
    highSignalQuotes: profiles
      .filter((profile) => profile.description || profile.markdown)
      .slice(0, 3)
      .map((profile) => ({
        quote: trimText(profile.description || profile.markdown || profile.title, 180),
        sourceUrl: profile.url,
        platform: profile.platform,
      })),
    recurringThemes: [
      excerpt || 'Publicly documented ambition with more clarity than emotional boundaries.',
    ],
    braggingPatterns: [
      'let the profile itself do a lot of myth-building',
    ],
    tenderness: [
      'still sounded human in the spaces between the polish',
    ],
    socialAbsences: [
      'was easier to see online than to know directly',
    ],
    relationshipRedFlags: [
      'looked like they could accidentally turn real life into audience-facing content',
    ],
    workStyle: [
      'appeared relentlessly productive in every public-facing bio',
    ],
    friendMaterial: [
      'clearly left enough material for the group chat to stay active',
    ],
    oneSentenceObituary:
      'Their public presence was specific enough to be remembered and vague enough to be projected onto.',
  };
}

async function extractDossier(profiles, input = {}) {
  const schema = {
    type: 'object',
    properties: {
      subject: {
        type: 'object',
        properties: {
          probableName: { type: 'string' },
          profession: { type: 'string' },
          selfMythology: { type: 'string' },
        },
        required: ['probableName', 'profession', 'selfMythology'],
      },
      highSignalQuotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            quote: { type: 'string' },
            sourceUrl: { type: 'string' },
            platform: { type: 'string' },
          },
          required: ['quote', 'sourceUrl', 'platform'],
        },
      },
      recurringThemes: {
        type: 'array',
        items: { type: 'string' },
      },
      braggingPatterns: {
        type: 'array',
        items: { type: 'string' },
      },
      tenderness: {
        type: 'array',
        items: { type: 'string' },
      },
      socialAbsences: {
        type: 'array',
        items: { type: 'string' },
      },
      relationshipRedFlags: {
        type: 'array',
        items: { type: 'string' },
      },
      workStyle: {
        type: 'array',
        items: { type: 'string' },
      },
      friendMaterial: {
        type: 'array',
        items: { type: 'string' },
      },
      oneSentenceObituary: {
        type: 'string',
      },
    },
    required: [
      'subject',
      'highSignalQuotes',
      'recurringThemes',
      'braggingPatterns',
      'tenderness',
      'socialAbsences',
      'relationshipRedFlags',
      'workStyle',
      'friendMaterial',
      'oneSentenceObituary',
    ],
  };

  const prompt = [
    'You are preparing a darkly funny but evidence-backed funeral roast for a consenting user about themselves.',
    'Use only the supplied public URLs.',
    'Extract details that are specific, roastable, and still grounded in what is actually on the page.',
    'Prefer direct short quotes when they are vivid.',
    `If the user supplied a display name, treat "${input.displayName || ''}" as a hint, not a fact unless supported.`,
    'Do not invent relationships, jobs, or biographical details.',
  ].join(' ');

  const startPayload = await firecrawlRequest('/extract', {
    urls: profiles.map((profile) => profile.url),
    prompt,
    schema,
  });

  if (startPayload.status === 'completed' && startPayload.data) {
    return startPayload.data;
  }

  const jobId = startPayload.id || startPayload.jobId || startPayload.extractId;

  if (!jobId) {
    throw new Error('Firecrawl extract did not return a job id.');
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const statusPayload = await firecrawlRequest(
      `/extract/${jobId}`,
      null,
      { method: 'GET' },
    );

    if (statusPayload.status === 'completed') {
      return statusPayload.data;
    }

    if (statusPayload.status === 'failed' || statusPayload.status === 'cancelled') {
      throw new Error('Firecrawl extract failed before returning funeral data.');
    }

    await sleep(1500);
  }

  throw new Error('Firecrawl extract timed out.');
}

async function generateDialogueAudio(script) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return null;
  }

  const payload = await elevenlabsRequest(
    '/text-to-dialogue/with-timestamps?output_format=mp3_44100_128',
    {
      model_id: process.env.ELEVENLABS_TTS_MODEL_ID || 'eleven_v3',
      inputs: script.map((segment) => ({
        text: segment.text,
        voice_id: segment.voiceId,
      })),
    },
  );

  const speakerByInputIndex = script.reduce((map, segment, index) => {
    map.set(index, segment);
    return map;
  }, new Map());

  return {
    mimeType: 'audio/mpeg',
    base64: payload.audio_base64,
    alignment: payload.alignment || null,
    segments: (payload.voice_segments || []).map((segment) => {
      const sourceSegment = speakerByInputIndex.get(segment.dialogue_input_index);

      return {
        dialogueInputIndex: segment.dialogue_input_index,
        startTimeSeconds: segment.start_time_seconds,
        endTimeSeconds: segment.end_time_seconds,
        speaker: sourceSegment?.speaker || 'officiant',
        label: sourceSegment?.label || 'Speaker',
      };
    }),
  };
}

export async function getSignedUrlForAgent() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!agentId) {
    throw new Error('ELEVENLABS_AGENT_ID is missing.');
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required to mint a signed URL.');
  }

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/convai/conversation/get-signed-url?agent_id=${agentId}`,
    {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.signed_url) {
    throw new Error(payload.detail?.message || 'Failed to fetch ElevenLabs signed URL.');
  }

  return payload.signed_url;
}

export async function generateFuneralExperience(input = {}) {
  if (input.demoMode || !process.env.FIRECRAWL_API_KEY) {
    const demo = buildMockExperience(input);

    if (!input.skipAudio) {
      demo.audio = await generateDialogueAudio(demo.script);
    }

    return demo;
  }

  const requestedProfiles = collectRequestedProfiles(input);

  const profiles = (
    await Promise.all(
      requestedProfiles.map(([platform, value]) => searchProfile(platform, value)),
    )
  ).filter(Boolean);

  if (!profiles.length) {
    throw new Error('Add at least one public profile handle or URL.');
  }

  let dossier;

  try {
    dossier = await extractDossier(profiles, input);
  } catch (_error) {
    dossier = buildFallbackDossier(profiles, input);
  }

  const built = buildFuneralScript(dossier, {
    displayName: input.displayName,
  });

  return {
    mode: 'live',
    generatedAt: new Date().toISOString(),
    subjectName: built.subjectName,
    summary: built.summary,
    profiles: profiles.map((profile) => ({
      platform: profile.platform,
      url: profile.url,
      display: profile.display,
    })),
    receipts: built.receipts,
    script: built.script,
    dossier,
    audio: input.skipAudio ? null : await generateDialogueAudio(built.script),
    liveAgent: getLiveAgentConfig(),
    voices: getSpeakerCatalog(),
  };
}

export { getLiveAgentConfig };
