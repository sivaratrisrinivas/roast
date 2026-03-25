import { buildFuneralScript } from './funeral-script.mjs';
import { getLiveAgentConfig } from './live-agent-config.mjs';

function normalizeEvidenceItems(input = {}) {
  return [
    ['bioText', 'Pasted bio or headline'],
    ['postText', 'Pasted post or thread'],
    ['extraReceiptText', 'Pasted extra receipt'],
  ]
    .map(([key, label]) => {
      const value = `${input[key] || ''}`.replace(/\s+/g, ' ').trim();

      if (!value) {
        return null;
      }

      return {
        id: `user-evidence:${key}`,
        label,
        quote: value,
      };
    })
    .filter(Boolean);
}

function cleanHandle(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value.replace(/^https?:\/\//, '').replace(/^@/, '').trim();
}

export function buildMockDossier(input = {}) {
  const alias = cleanHandle(
    input.profileInput || input.xHandle || input.linkedinHandle || input.instagramHandle,
    'main-character-dev',
  );
  const probableName = input.displayName || alias;
  const userEvidence = normalizeEvidenceItems(input);
  const suppliedQuotes = userEvidence.map((item) => ({
    quote: item.quote,
    sourceUrl: item.id,
    platform: 'user',
  }));

  return {
    subject: {
      probableName,
      profession: 'builder of things that should have been drafts',
      selfMythology:
        'Presented themselves as both exhausted and weirdly proud of that fact.',
    },
    highSignalQuotes: suppliedQuotes.length
      ? suppliedQuotes
      : [
          {
            quote: `I just shipped something slightly unhinged and now I need the internet to witness it. - @${alias}`,
            sourceUrl: 'https://example.com/mock/x-post',
            platform: 'x',
          },
          {
            quote:
              'Thrilled to share that I am doubling down on velocity, curiosity, and probably sleep deprivation.',
            sourceUrl: 'https://example.com/mock/linkedin-post',
            platform: 'linkedin',
          },
          {
            quote: 'Do not let this become my personality. Anyway, here is slide eight.',
            sourceUrl: 'https://example.com/mock/instagram-post',
            platform: 'instagram',
          },
        ],
    recurringThemes: [
      'turned every small milestone into a tiny public launch',
      'announced chaos with enough charm that people kept liking it',
    ],
    braggingPatterns: [
      'mistaking transparency for plausible deniability',
      'treating momentum like a personality trait',
    ],
    tenderness: [
      'still sounded deeply human whenever the joke stopped landing',
      'cared a little too much to ever be fully ironic',
    ],
    socialAbsences: [
      'was easier to reach on the timeline than by text',
      'sounded awake online at emotionally suspicious hours',
    ],
    relationshipRedFlags: [
      'kept romanticizing busyness right up to the point where it became avoidance',
      'turned vulnerability into a bit before anyone could hold them to it',
    ],
    workStyle: [
      'could absolutely ship under pressure, and occasionally confused that with emotional maturity',
      'made ambition look charismatic enough that people forgot to ask about recoverability',
    ],
    friendMaterial: [
      'the group chat is going to stay haunted for months',
      'if there is wifi in the afterlife, they are already building in public again',
    ],
    oneSentenceObituary:
      'They left us as they lived: over-committed, emotionally legible in flashes, and accidentally very quotable.',
  };
}

export function buildMockExperience(input = {}) {
  const dossier = buildMockDossier(input);
  const built = buildFuneralScript(dossier, {
    displayName: input.displayName,
  });
  const userEvidence = normalizeEvidenceItems(input);
  const exhibits = [
    ...userEvidence.map((item) => ({
      id: item.id,
      type: 'user_receipt',
      platform: 'user',
      title: item.label,
      sourceLabel: 'Pasted receipt',
      quote: item.quote,
    })),
    ...(built.receipts || []).map((receipt) => ({
      id: receipt.id,
      type: 'summary_receipt',
      platform: receipt.platform || 'web',
      title: receipt.heading,
      sourceLabel: receipt.platform || 'Receipt',
      quote: receipt.detail,
    })),
  ].slice(0, 3);

  return {
    mode: 'demo',
    generatedAt: new Date().toISOString(),
    subjectName: built.subjectName,
    summary: built.summary,
    profiles: [
      {
        platform: 'demo',
        url: 'https://example.com/mock-profile',
        display: cleanHandle(
          input.profileInput ||
            input.xHandle ||
            input.linkedinHandle ||
            input.instagramHandle,
          'synthetic-receipts',
        ),
      },
    ],
    exhibits,
    receipts: built.receipts,
    script: built.script,
    dossier,
    audio: null,
    liveAgent: getLiveAgentConfig(),
  };
}
