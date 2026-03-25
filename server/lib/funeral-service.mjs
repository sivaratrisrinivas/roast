import {
  buildFuneralAgentConversation,
  buildFuneralScript,
  getSpeakerCatalog,
} from './funeral-script.mjs';
import { getLiveAgentConfig } from './live-agent-config.mjs';
import { buildMockExperience } from './mock-data.mjs';

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v2';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const VOICE_CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_SOURCE_TEXT_LENGTH = 140;
const MIN_RICH_SOURCE_TEXT_LENGTH = 700;
const MIN_TOTAL_SOURCE_TEXT_LENGTH = 900;
const MIN_USER_EVIDENCE_TEXT_LENGTH = 140;
const MAX_SELECTED_SOURCES = 6;
const SEARCH_LIMIT = 4;
const SEARCH_TIMEOUT_MS = 12000;
const USER_EVIDENCE_FIELDS = [
  {
    key: 'bioText',
    label: 'Pasted bio or headline',
    kind: 'bio',
  },
  {
    key: 'postText',
    label: 'Pasted post or thread',
    kind: 'post',
  },
  {
    key: 'extraReceiptText',
    label: 'Pasted extra receipt',
    kind: 'receipt',
  },
];

let voiceCache = {
  expiresAt: 0,
  voices: null,
};

function createLogger() {
  return () => {};
}

function redactInput(value = '') {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  if (trimmed.length <= 14) {
    return trimmed;
  }

  return `${trimmed.slice(0, 10)}...${trimmed.slice(-4)}`;
}

function formatPlatformLabel(platform = '') {
  return {
    x: 'X',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    github: 'GitHub',
    web: 'Web',
    user: 'User Receipt',
  }[platform] || 'Public Source';
}

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
    .replace(/^https?:\/\/(www\.)?twitter\.com\//i, '')
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\/+$/, '');
}

function parseXReference(value = '') {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!isUrl(trimmed)) {
    return {
      handle: normalizeHandle(trimmed),
      postId: '',
    };
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (hostname !== 'x.com' && hostname !== 'twitter.com') {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const handle = (parts[0] || '').replace(/^@/, '');
    const markerIndex = parts.findIndex((part) =>
      ['status', 'thread'].includes(part.toLowerCase()),
    );
    const postId =
      markerIndex >= 0 ? (parts[markerIndex + 1] || '').trim() : '';

    return {
      handle,
      postId,
    };
  } catch (_error) {
    return null;
  }
}

function inferPlatformFromInput(rawValue = '') {
  const trimmed = rawValue.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.includes('x.com') ||
    trimmed.includes('twitter.com') ||
    trimmed.startsWith('x:') ||
    trimmed.startsWith('twitter:')
  ) {
    return 'x';
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

  if (
    trimmed.includes('github.com') ||
    trimmed.startsWith('github:')
  ) {
    return 'github';
  }

  if (isUrl(trimmed)) {
    return 'web';
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
    ['github', input.githubHandle],
    ['web', input.websiteUrl],
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

function collectUserEvidence(input = {}) {
  return USER_EVIDENCE_FIELDS.flatMap((field) => {
    const text = trimText(input[field.key] || '', 2200);

    if (!text) {
      return [];
    }

    const id = `user-evidence:${field.key}`;

    return [
      {
        id,
        url: id,
        platform: 'user',
        title: field.label,
        description: 'User-submitted receipt',
        markdown: text,
        text,
        textLength: text.length,
        domain: 'user-submitted',
        score: 1200,
        display: field.label,
        discoveredBy: 'user-submitted',
        sourceType: 'user_submitted_text',
        sourceLabel: field.label,
        kind: field.kind,
      },
    ];
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

function getDomain(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_error) {
    return '';
  }
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value);
    url.hash = '';

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    return url.toString();
  } catch (_error) {
    return value.trim();
  }
}

function inferPlatformFromUrl(value = '') {
  const domain = getDomain(value);

  if (domain.endsWith('x.com')) {
    return 'x';
  }

  if (domain.endsWith('linkedin.com')) {
    return 'linkedin';
  }

  if (domain.endsWith('instagram.com')) {
    return 'instagram';
  }

  if (domain.endsWith('github.com')) {
    return 'github';
  }

  return 'web';
}

function getSourceText(source = {}) {
  return [source.title, source.description, source.markdown]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPlatformDomain(platform) {
  return {
    x: 'x.com',
    linkedin: 'linkedin.com',
    instagram: 'instagram.com',
    github: 'github.com',
  }[platform] || '';
}

function buildSearchPlans(platform, rawValue) {
  const trimmed = rawValue.trim();
  const normalized = normalizeHandle(rawValue);
  const quotedValue = normalized ? `"${normalized}"` : '';
  const plans = [];
  const primaryDomain = getPlatformDomain(platform);
  const normalizedUrl = isUrl(trimmed) ? normalizeUrl(trimmed) : '';
  const inputDomain = getDomain(trimmed);

  if (platform === 'x' && normalizedUrl) {
    const parsedX = parseXReference(trimmed);
    const canonicalStatusUrl =
      parsedX?.handle && parsedX?.postId
        ? `https://x.com/${parsedX.handle}/status/${parsedX.postId}`
        : normalizedUrl;

    plans.push({
      label: 'exact-url',
      query: normalizedUrl,
      preferredDomain: inputDomain,
      strictDomain: inputDomain,
      strictUrl: normalizedUrl,
      targetHandle: parsedX?.handle || '',
      targetPostId: parsedX?.postId || '',
    });

    if (parsedX?.handle && parsedX?.postId) {
      plans.push({
        label: 'x-thread',
        query: `"${parsedX.handle}" "${parsedX.postId}" site:x.com`,
        preferredDomain: 'x.com',
        targetHandle: parsedX.handle,
        targetPostId: parsedX.postId,
        tbs: 'sbd:1',
      });

      plans.push({
        label: 'x-post-id',
        query: `"${parsedX.postId}" site:x.com`,
        preferredDomain: 'x.com',
        targetHandle: parsedX.handle,
        targetPostId: parsedX.postId,
        tbs: 'sbd:1',
      });

      plans.push({
        label: 'x-thread-web',
        query: `"${parsedX.handle}" "${parsedX.postId}"`,
        preferredDomain: '',
        requiredTokensAll: [parsedX.postId],
        tbs: 'sbd:1',
      });

      plans.push({
        label: 'x-canonical-web',
        query: `"${canonicalStatusUrl}"`,
        preferredDomain: '',
        requiredTokensAll: [parsedX.postId],
      });
    }

    if (parsedX?.handle) {
      plans.push({
        label: 'x-handle',
        query: `"${parsedX.handle}" site:x.com`,
        preferredDomain: 'x.com',
        targetHandle: parsedX.handle,
        tbs: 'sbd:1',
      });
    }

    return plans.filter(
      (plan, index, list) =>
        plan.query &&
        list.findIndex((candidate) => candidate.query === plan.query) === index,
    );
  }

  if (normalizedUrl) {
    plans.push({
      label: 'exact-url',
      query: normalizedUrl,
      preferredDomain: inputDomain,
      strictDomain: inputDomain,
      strictUrl: normalizedUrl,
    });

    if (platform === 'web') {
      plans.push({
        label: 'github-footprint',
        query: `"${normalizedUrl}" site:github.com`,
        preferredDomain: 'github.com',
      });
    }

    return plans.filter(
      (plan, index, list) =>
        plan.query &&
        list.findIndex((candidate) => candidate.query === plan.query) === index,
    );
  }

  if (quotedValue && primaryDomain) {
    plans.push({
      label: `${platform}-profile`,
      query: `${quotedValue} site:${primaryDomain}`,
      preferredDomain: primaryDomain,
    });
  }

  if (quotedValue) {
    plans.push({
      label: 'general-web',
      query: quotedValue,
      preferredDomain: '',
    });
  }

  if (quotedValue && platform !== 'github') {
    plans.push({
      label: 'github-footprint',
      query: `${quotedValue} site:github.com`,
      preferredDomain: 'github.com',
    });
  }

  if (quotedValue && platform !== 'linkedin') {
    plans.push({
      label: 'linkedin-footprint',
      query: `${quotedValue} site:linkedin.com/in`,
      preferredDomain: 'linkedin.com',
    });
  }

  return plans.filter(
    (plan, index, list) =>
      plan.query &&
      list.findIndex((candidate) => candidate.query === plan.query) === index,
  );
}

function buildSourceCandidate(result, plan, seed) {
  const url = normalizeUrl(result.url || result.metadata?.url || '');

  if (!url) {
    return null;
  }

  const platform = inferPlatformFromUrl(url);
  const title = trimText(result.title || result.metadata?.title || url, 180);
  const description = trimText(
    result.description || result.metadata?.description || '',
    260,
  );
  const markdown = (result.markdown || '').trim();
  const text = getSourceText({ title, description, markdown });
  const domain = getDomain(url);
  const seedValue = seed.value.toLowerCase();
  const candidateUrlLower = url.toLowerCase();
  const contentHaystack = `${url} ${title} ${description} ${markdown}`.toLowerCase();

  let score = Math.min(text.length, 1200);

  if (plan.strictDomain && domain !== plan.strictDomain) {
    return null;
  }

  if (
    Array.isArray(plan.requiredTokensAll) &&
    !plan.requiredTokensAll.every((token) =>
      contentHaystack.includes(`${token}`.toLowerCase()),
    )
  ) {
    return null;
  }

  if (plan.strictUrl && !plan.targetPostId) {
    try {
      const strictPath = new URL(plan.strictUrl).pathname.replace(/\/+$/, '') || '/';
      const candidatePath = new URL(url).pathname.replace(/\/+$/, '') || '/';

      if (strictPath !== '/' && !candidatePath.startsWith(strictPath)) {
        return null;
      }
    } catch (_error) {
      // Ignore URL parsing errors here and fall back to the other guards.
    }
  }

  if (plan.preferredDomain && domain.endsWith(plan.preferredDomain)) {
    score += 220;
  }

  if (seed.inputUrl && normalizeUrl(seed.inputUrl) === url) {
    score += 260;
  }

  if (seed.primaryDomain && domain.endsWith(seed.primaryDomain)) {
    score += 120;
  }

  if (seedValue && `${title} ${description}`.toLowerCase().includes(seedValue)) {
    score += 90;
  }

  if (markdown.length >= MIN_RICH_SOURCE_TEXT_LENGTH) {
    score += 180;
  }

  if (platform === 'github' || platform === 'web') {
    score += 40;
  }

  if (
    plan.targetHandle &&
    domain === 'x.com' &&
    !candidateUrlLower.includes(`/${plan.targetHandle.toLowerCase()}`)
  ) {
    return null;
  }

  if (
    plan.targetPostId &&
    domain === 'x.com' &&
    !candidateUrlLower.includes(plan.targetPostId.toLowerCase())
  ) {
    return null;
  }

  if (
    seed.platform === 'x' &&
    seed.requestedPostId &&
    domain === 'x.com' &&
    (candidateUrlLower.includes('/status/') || candidateUrlLower.includes('/thread/')) &&
    !candidateUrlLower.includes(seed.requestedPostId.toLowerCase())
  ) {
    return null;
  }

  if (
    domain === 'x.com' &&
    (url.includes('/search?') ||
      (seed.platform === 'x' &&
        seed.value &&
        !url.toLowerCase().includes(seed.value.toLowerCase())))
  ) {
    return null;
  }

  return {
    url,
    platform,
    title,
    description,
    markdown,
    text,
    textLength: text.length,
    domain,
    score,
    discoveredBy: plan.label,
  };
}

function buildSourceContext(sources) {
  return sources
    .map(
      (source, index) =>
        `Source ${index + 1}\nURL: ${source.url}\nPlatform: ${source.platform}\nTitle: ${source.title}\nSnippet: ${trimText(
          source.text,
          900,
        )}`,
    )
    .join('\n\n');
}

function buildUserEvidenceContext(userEvidence) {
  return userEvidence
    .map(
      (evidence, index) =>
        `Receipt ${index + 1}\nID: ${evidence.id}\nLabel: ${evidence.title}\nType: ${evidence.kind}\nText: ${trimText(
          evidence.text,
          900,
        )}`,
    )
    .join('\n\n');
}

function buildExhibits(_dossier, _publicSources = [], userEvidence = [], built = null) {
  const evidenceCards = userEvidence.map((evidence) => ({
    id: evidence.id,
    type: 'user_receipt',
    platform: evidence.platform || 'user',
    title: evidence.title,
    sourceLabel: 'Pasted receipt',
    quote: trimText(evidence.text, 150),
  }));

  const summaryCards = (built?.receipts || []).map((receipt) => ({
    id: receipt.id,
    type: 'summary_receipt',
    platform: receipt.platform || 'web',
    title: receipt.heading,
    sourceLabel: receipt.platform || 'Receipt',
    quote: trimText(receipt.detail, 140),
  }));

  return [...evidenceCards, ...summaryCards].slice(0, 3);
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

async function listAvailableVoices(options = {}) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return [];
  }

  if (
    !options.forceRefresh &&
    voiceCache.voices &&
    Date.now() < voiceCache.expiresAt
  ) {
    return voiceCache.voices;
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !Array.isArray(payload.voices)) {
    throw new Error(
      payload.detail?.message || payload.message || 'Failed to list ElevenLabs voices.',
    );
  }

  voiceCache = {
    expiresAt: Date.now() + VOICE_CACHE_TTL_MS,
    voices: payload.voices,
  };

  return payload.voices;
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

async function gatherPublicSources(platform, rawValue, logger = () => { }) {
  const value = normalizeHandle(rawValue);
  const parsedX = platform === 'x' ? parseXReference(rawValue) : null;

  if (!value && !isUrl(rawValue)) {
    return [];
  }

  const seed = {
    platform,
    inputUrl: isUrl(rawValue) ? rawValue.trim() : '',
    primaryDomain: getPlatformDomain(platform) || getDomain(rawValue),
    requestedPostId: parsedX?.postId || '',
    value:
      platform === 'x' && parsedX?.handle
        ? parsedX.handle
        : value || rawValue.trim(),
  };
  const plans = buildSearchPlans(platform, rawValue);
  const candidates = [];

  if (
    seed.inputUrl &&
    !['x', 'linkedin', 'instagram'].includes(platform)
  ) {
    try {
      const scraped = await scrapeUrl(seed.inputUrl);
      const directCandidate = buildSourceCandidate(scraped, {
        label: 'direct-scrape',
        preferredDomain: getDomain(seed.inputUrl),
      }, seed);

      logger('firecrawl.scrape.success', {
        platform,
        url: seed.inputUrl,
        markdownLength: scraped.markdown.length,
      });

      if (directCandidate && directCandidate.textLength >= MIN_SOURCE_TEXT_LENGTH) {
        candidates.push(directCandidate);
      }
    } catch (error) {
      logger('firecrawl.scrape.skipped', {
        platform,
        url: seed.inputUrl,
        reason: error.message,
      });
    }
  }

  const searchResponses = await Promise.all(
    plans.map(async (plan) => {
      logger('firecrawl.search.started', {
        platform,
        label: plan.label,
        query: plan.query,
      });

      const payload = await firecrawlRequest('/search', {
        query: plan.query,
        limit: plan.limit || SEARCH_LIMIT,
        timeout: plan.timeout || SEARCH_TIMEOUT_MS,
        ...(plan.tbs ? { tbs: plan.tbs } : {}),
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 30000,
        },
      });

      const results = [
        ...(payload.data?.web || []),
        ...(payload.data?.news || []),
      ];

      logger('firecrawl.search.completed', {
        platform,
        label: plan.label,
        query: plan.query,
        resultCount: results.length,
      });

      return { plan, results };
    }),
  );

  for (const { plan, results } of searchResponses) {
    for (const result of results) {
      const candidate = buildSourceCandidate(result, plan, seed);

      if (!candidate) {
        continue;
      }

      if (candidate.textLength < MIN_SOURCE_TEXT_LENGTH) {
        logger('firecrawl.source.rejected', {
          url: candidate.url,
          domain: candidate.domain,
          discoveredBy: candidate.discoveredBy,
          textLength: candidate.textLength,
          reason: 'thin_content',
        });
        continue;
      }

      candidates.push(candidate);
    }
  }

  const dedupedSources = [...new Map(
    candidates
      .sort((left, right) => right.score - left.score)
      .map((candidate) => [candidate.url, candidate]),
  ).values()];

  const filteredSources =
    platform === 'x' && seed.requestedPostId
      ? dedupedSources.filter((source) => {
        const haystack = `${source.url} ${source.title} ${source.description} ${source.markdown}`.toLowerCase();
        return haystack.includes(seed.requestedPostId.toLowerCase());
      })
      : dedupedSources;

  if (platform === 'x' && seed.requestedPostId && !filteredSources.length) {
    logger('pipeline.x_thread_unresolved', {
      handle: seed.value,
      postId: seed.requestedPostId,
    });
  }

  const selectedSources = filteredSources.slice(0, MAX_SELECTED_SOURCES);
  const totalTextLength = selectedSources.reduce(
    (sum, source) => sum + source.textLength,
    0,
  );

  logger('pipeline.sources_selected', {
    platform,
    sourceCount: selectedSources.length,
    totalTextLength,
    sources: selectedSources.map((source) => ({
      url: source.url,
      domain: source.domain,
      platform: source.platform,
      textLength: source.textLength,
      discoveredBy: source.discoveredBy,
    })),
  });

  return selectedSources.map((source) => ({
    ...source,
    display: seed.value,
  }));
}

function ensureMinimumSourceData(sources, userEvidence = []) {
  const totalTextLength = sources.reduce((sum, source) => sum + source.textLength, 0);
  const richSourceCount = sources.filter(
    (source) => source.textLength >= MIN_RICH_SOURCE_TEXT_LENGTH,
  ).length;
  const userEvidenceTextLength = userEvidence.reduce(
    (sum, evidence) => sum + evidence.textLength,
    0,
  );

  if (!sources.length && !userEvidence.length) {
    throw new Error('ROAST could not find usable public text from that profile.');
  }

  if (!sources.length && userEvidenceTextLength >= MIN_USER_EVIDENCE_TEXT_LENGTH) {
    return;
  }

  if (
    richSourceCount >= 1 ||
    totalTextLength >= MIN_TOTAL_SOURCE_TEXT_LENGTH ||
    userEvidenceTextLength >= MIN_USER_EVIDENCE_TEXT_LENGTH
  ) {
    return;
  }

  throw new Error(
    'Need one more public link or a pasted receipt. ROAST found too little concrete text to make this good.',
  );
}

function buildFallbackDossier(sources, input = {}, userEvidence = []) {
  const combinedText = sources
    .flatMap((source) => [source.title, source.description, source.markdown])
    .concat(userEvidence.map((evidence) => evidence.text))
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
          input.instagramHandle ||
          input.githubHandle ||
          input.websiteUrl,
        ) ||
        'Unknown subject',
      profession: 'person discoverable through public profile breadcrumbs',
      selfMythology:
        excerpt || 'Presented an online self that was polished, busy, and occasionally too revealing.',
    },
    highSignalQuotes: [
      ...userEvidence.map((evidence) => ({
        quote: trimText(evidence.text, 180),
        sourceUrl: evidence.id,
        platform: evidence.platform,
      })),
      ...sources
        .filter((source) => source.description || source.markdown)
        .slice(0, 3)
        .map((source) => ({
          quote: trimText(source.markdown || source.description || source.title, 180),
          sourceUrl: source.url,
          platform: source.platform,
        })),
    ].slice(0, 4),
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

function getDossierSchema() {
  return {
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
}

function buildDossierPrompt(sources, input = {}, userEvidence = []) {
  const evidenceContext = userEvidence.length
    ? `Here are the user-submitted receipts. Treat them as explicit evidence, especially when social platforms are blocked:\n\n${buildUserEvidenceContext(
      userEvidence,
    )}`
    : 'No user-submitted receipts were provided.';

  return [
    'You are preparing a darkly funny but evidence-backed funeral roast for a consenting user about themselves.',
    'Use the provided source snippets and URLs as your source of truth.',
    'User-submitted receipts are also valid source material.',
    'Stay specific, surprising, and grounded in what the source material actually says.',
    'Prefer direct short quotes when they are vivid.',
    `If the user supplied a display name, treat "${input.displayName || ''}" as a hint, not a fact unless supported.`,
    'Do not invent relationships, jobs, or biographical details.',
    'Keep every field roastable but fair, and avoid generic filler.',
    evidenceContext,
    `Here are the public sources you already have:\n\n${buildSourceContext(sources)}`,
  ].join(' ');
}

async function extractDossierWithAgent(
  sources,
  input = {},
  userEvidence = [],
  logger = () => { },
) {
  const startPayload = await firecrawlRequest('/agent', {
    prompt: buildDossierPrompt(sources, input, userEvidence),
    urls: sources.map((source) => source.url),
    schema: getDossierSchema(),
    model: 'spark-1-mini',
  });

  logger('firecrawl.agent.started', {
    sourceCount: sources.length,
    initialStatus: startPayload.status || 'unknown',
    jobId: startPayload.id || startPayload.jobId || startPayload.agentId || null,
  });

  if (startPayload.status === 'completed' && startPayload.data) {
    logger('firecrawl.agent.completed_immediately', {
      quoteCount: startPayload.data.highSignalQuotes?.length || 0,
    });
    return startPayload.data;
  }

  const jobId = startPayload.id || startPayload.jobId || startPayload.agentId;

  if (!jobId) {
    throw new Error('Firecrawl agent did not return a job id.');
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const statusPayload = await firecrawlRequest(
      `/agent/${jobId}`,
      null,
      { method: 'GET' },
    );

    logger('firecrawl.agent.poll', {
      attempt: attempt + 1,
      status: statusPayload.status || 'unknown',
    });

    if (statusPayload.status === 'completed') {
      logger('firecrawl.agent.completed', {
        quoteCount: statusPayload.data?.highSignalQuotes?.length || 0,
      });
      return statusPayload.data;
    }

    if (statusPayload.status === 'failed' || statusPayload.status === 'cancelled') {
      throw new Error(statusPayload.error || 'Firecrawl agent failed before returning roast data.');
    }

    await sleep(1500);
  }

  throw new Error('Firecrawl agent timed out.');
}

async function extractDossierWithExtract(
  sources,
  input = {},
  userEvidence = [],
  logger = () => { },
) {
  const startPayload = await firecrawlRequest('/extract', {
    urls: sources.map((source) => source.url),
    prompt: buildDossierPrompt(sources, input, userEvidence),
    schema: getDossierSchema(),
  });

  logger('firecrawl.extract.started', {
    sourceCount: sources.length,
    initialStatus: startPayload.status || 'unknown',
  });

  if (startPayload.status === 'completed' && startPayload.data) {
    logger('firecrawl.extract.completed_immediately', {
      quoteCount: startPayload.data.highSignalQuotes?.length || 0,
    });
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

    logger('firecrawl.extract.poll', {
      attempt: attempt + 1,
      status: statusPayload.status || 'unknown',
    });

    if (statusPayload.status === 'completed') {
      logger('firecrawl.extract.completed', {
        quoteCount: statusPayload.data?.highSignalQuotes?.length || 0,
      });
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
        speaker: sourceSegment?.speaker || 'mom',
        label: sourceSegment?.label || 'Speaker',
      };
    }),
  };
}

async function validateVoiceAssignments(script, logger = () => { }) {
  if (!process.env.ELEVENLABS_API_KEY) {
    logger('elevenlabs.voice_validation.skipped', {
      reason: 'missing_api_key',
    });
    return [];
  }

  const availableVoices = await listAvailableVoices();
  const availableById = new Map(
    availableVoices.map((voice) => [voice.voice_id, voice]),
  );
  const requestedVoiceIds = [...new Set(script.map((segment) => segment.voiceId))];
  const missingVoiceIds = requestedVoiceIds.filter(
    (voiceId) => !availableById.has(voiceId),
  );

  logger('elevenlabs.voices.available', {
    count: availableVoices.length,
    voices: availableVoices.map((voice) => ({
      name: voice.name,
      voiceId: voice.voice_id,
      category: voice.category,
    })),
  });

  logger('elevenlabs.voices.requested', {
    speakers: script.map((segment) => ({
      speaker: segment.speaker,
      label: segment.label,
      voiceId: segment.voiceId,
      voiceName: availableById.get(segment.voiceId)?.name || null,
    })),
  });

  if (missingVoiceIds.length) {
    throw new Error(`Voice(s) not found: ${missingVoiceIds.join(', ')}`);
  }

  return availableVoices;
}

function getRequiredAgentCredentials() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!agentId) {
    throw new Error('ELEVENLABS_AGENT_ID is missing.');
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required for authenticated agent sessions.');
  }

  return {
    agentId,
    apiKey: process.env.ELEVENLABS_API_KEY,
  };
}

export async function getSignedUrlForAgent() {
  const { agentId, apiKey } = getRequiredAgentCredentials();

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/convai/conversation/get-signed-url?agent_id=${agentId}`,
    {
      headers: {
        'xi-api-key': apiKey,
      },
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.signed_url) {
    throw new Error(payload.detail?.message || 'Failed to fetch ElevenLabs signed URL.');
  }

  return payload.signed_url;
}

export async function getConversationTokenForAgent() {
  const { agentId, apiKey } = getRequiredAgentCredentials();

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/convai/conversation/token?agent_id=${agentId}`,
    {
      headers: {
        'xi-api-key': apiKey,
      },
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.token) {
    throw new Error(payload.detail?.message || 'Failed to fetch ElevenLabs conversation token.');
  }

  return payload.token;
}

export async function getAvailableVoices() {
  return listAvailableVoices({ forceRefresh: true });
}

export async function generateFuneralExperience(input = {}, options = {}) {
  const logger = options.logger || createLogger(options.requestId);
  const userEvidence = collectUserEvidence(input);

  logger('pipeline.started', {
    profileInput: redactInput(input.profileInput || ''),
    userEvidenceCount: userEvidence.length,
    firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY),
    elevenConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
  });

  if (!input.consentConfirmed) {
    throw new Error('Confirm consent before starting the service.');
  }

  if (input.demoMode || !process.env.FIRECRAWL_API_KEY) {
    logger('pipeline.mode', {
      mode: 'demo',
      reason: input.demoMode ? 'forced_demo' : 'missing_firecrawl_api_key',
    });
    const demo = buildMockExperience(input);
    await validateVoiceAssignments(demo.script, logger);
    logger('pipeline.audio_generation_started', {
      scriptSegments: demo.script.length,
    });
    demo.audio = await generateDialogueAudio(demo.script);
    logger('pipeline.completed', {
      mode: 'demo',
      profiles: demo.profiles.length,
      scriptSegments: demo.script.length,
      hasAudio: Boolean(demo.audio?.base64),
    });

    return demo;
  }

  const requestedProfiles = collectRequestedProfiles(input);
  logger('pipeline.profile_targets', {
    requestedProfiles: requestedProfiles.map(([platform, value]) => ({
      platform,
      input: redactInput(value),
    })),
  });

  const sources = (
    await Promise.all(
      requestedProfiles.map(([platform, value]) =>
        gatherPublicSources(platform, value, logger),
      ),
    )
  ).flat();
  const dedupedSources = [...new Map(
    sources.map((source) => [source.url, source]),
  ).values()];

  if (!dedupedSources.length && !userEvidence.length) {
    logger('pipeline.failed', {
      reason: 'no_evidence',
    });
    throw new Error('Add at least one public page or paste a few receipts.');
  }

  try {
    ensureMinimumSourceData(dedupedSources, userEvidence);
  } catch (error) {
    logger('pipeline.source_gate_failed', {
      sourceCount: dedupedSources.length,
      userEvidenceCount: userEvidence.length,
      totalTextLength: dedupedSources.reduce(
        (sum, source) => sum + source.textLength,
        0,
      ),
      reason: error.message,
    });
    throw error;
  }

  let dossier;

  if (dedupedSources.length) {
    try {
      dossier = await extractDossierWithExtract(
        dedupedSources,
        input,
        userEvidence,
        logger,
      );
    } catch (extractError) {
      logger('firecrawl.extract.fallback', {
        reason: extractError.message,
      });

      try {
        dossier = await extractDossierWithAgent(
          dedupedSources,
          input,
          userEvidence,
          logger,
        );
      } catch (agentError) {
        logger('firecrawl.agent.fallback', {
          reason: agentError.message,
        });
        dossier = buildFallbackDossier(dedupedSources, input, userEvidence);
      }
    }
  } else {
    dossier = buildFallbackDossier([], input, userEvidence);
  }

  if (!dossier) {
    logger('pipeline.failed', {
      reason: 'no_dossier',
    });
    throw new Error('ROAST could not build a funeral dossier from the public sources.');
  }

  const built = buildFuneralScript(dossier, {
    displayName: input.displayName,
  });
  const liveAgent = getLiveAgentConfig();
  const shouldUseLiveAgent =
    liveAgent.configured && !input.skipAudio && !input.forceStaticAudio;
  const agentConversation = shouldUseLiveAgent
    ? buildFuneralAgentConversation(dossier, built)
    : null;

  logger('pipeline.script_built', {
    subjectName: built.subjectName,
    scriptSegments: built.script.length,
    speakers: built.script.map((segment, index) => ({
      index,
      id: segment.id,
      speaker: segment.speaker,
      label: segment.label,
      voiceId: segment.voiceId,
    })),
  });

  let audio = null;

  if (shouldUseLiveAgent) {
    logger('pipeline.agent_session_ready', {
      configured: true,
      requiresAuth: liveAgent.requiresAuth,
    });
  } else {
    await validateVoiceAssignments(built.script, logger);
    logger('pipeline.audio_generation_started', {
      scriptSegments: built.script.length,
    });
    audio = input.skipAudio ? null : await generateDialogueAudio(built.script);
    logger('pipeline.audio_generated', {
      hasAudio: Boolean(audio?.base64),
      segmentCount: audio?.segments?.length || 0,
    });
  }

  const experience = {
    mode: 'live',
    type: shouldUseLiveAgent ? 'agent' : audio ? 'audio' : 'script',
    generatedAt: new Date().toISOString(),
    subjectName: built.subjectName,
    summary: built.summary,
    profiles: dedupedSources.map((source) => ({
      platform: source.platform,
      url: source.url,
      display: source.display,
    })),
    exhibits: buildExhibits(dossier, dedupedSources, userEvidence, built),
    receipts: built.receipts,
    script: built.script,
    dossier,
    audio,
    agentConversation,
    liveAgent,
    voices: getSpeakerCatalog(),
  };

  logger('pipeline.completed', {
    mode: 'live',
    type: experience.type,
    profiles: experience.profiles.length,
    scriptSegments: experience.script.length,
    hasAudio: Boolean(experience.audio?.base64),
  });

  return experience;
}

export { createLogger, getLiveAgentConfig };
