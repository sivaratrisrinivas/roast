import { buildFuneralScript } from './funeral-script.mjs';

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

  return {
    subject: {
      probableName,
      profession: 'builder of things that should have been drafts',
      selfMythology:
        'Presented themselves as both exhausted and weirdly proud of that fact.',
    },
    highSignalQuotes: [
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
    receipts: built.receipts,
    script: built.script,
    dossier,
    audio: null,
    liveAgent: {
      configured: Boolean(process.env.ELEVENLABS_AGENT_ID),
      requiresAuth: process.env.ELEVENLABS_AGENT_REQUIRES_AUTH !== 'false',
      agentId:
        process.env.ELEVENLABS_AGENT_REQUIRES_AUTH !== 'false'
          ? null
          : process.env.ELEVENLABS_AGENT_ID || null,
      officiantVoiceId:
        process.env.ELEVEN_VOICE_OFFICIANT_ID || 'JBFqnCBsd6RMkjVDRZzb',
    },
  };
}
