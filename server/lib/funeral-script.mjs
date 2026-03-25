const DEFAULT_VOICE_IDS = {
  mom: process.env.ELEVEN_VOICE_MOM_ID || 'sMODRoS7rErmUpYjO37S',
  best_friend: process.env.ELEVEN_VOICE_BEST_FRIEND_ID || 'eObmv4Un78oMyVBCXSuY',
};

export function getSpeakerCatalog() {
  return {
    mom: {
      id: 'mom',
      label: 'Mom',
      voiceTag: 'Mom',
      mood: 'achingly honest',
      voiceId: DEFAULT_VOICE_IDS.mom,
    },
    best_friend: {
      id: 'best_friend',
      label: 'Best Friend',
      voiceTag: 'BestFriend',
      mood: 'laughing through tears',
      voiceId: DEFAULT_VOICE_IDS.best_friend,
    },
  };
}

function pickFirst(list, fallback) {
  if (Array.isArray(list) && list.length) {
    return list[0];
  }

  return fallback;
}

function pickQuote(quotes, preferredPlatforms = []) {
  if (!Array.isArray(quotes) || !quotes.length) {
    return null;
  }

  const preferred = quotes.find((quote) =>
    preferredPlatforms.includes((quote.platform || '').toLowerCase()),
  );

  return preferred || quotes[0];
}

function pickAlternateQuote(quotes, excludedQuote, fallbackQuote = null) {
  if (!Array.isArray(quotes) || !quotes.length) {
    return fallbackQuote;
  }

  const alternate = quotes.find((quote) => quote !== excludedQuote);

  return alternate || fallbackQuote || quotes[0];
}

function cleanPhrase(value, fallback) {
  if (!value || value === 'unknown') {
    return fallback;
  }

  return `${value}`.replace(/\s+/g, ' ').trim();
}

function trimSentence(value = '') {
  return value.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}

function trimSnippet(value = '', maxLength = 160) {
  const cleaned = `${value}`.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function cleanEvidenceText(value = '', fallback = '') {
  const withoutUrls = `${value}`
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutUrls || fallback;
}

function quoteSnippet(quote, fallback, maxLength = 150) {
  if (!quote?.quote) {
    return fallback;
  }

  return trimSnippet(
    cleanEvidenceText(quote.quote, fallback).replace(/^["']|["']$/g, ''),
    maxLength,
  );
}

function toSecondPerson(value, fallback) {
  return trimSentence(cleanPhrase(value, fallback))
    .replace(/^was\b/i, 'were')
    .replace(/^is\b/i, 'are');
}

function toActionPhrase(value, fallback) {
  return trimSentence(cleanPhrase(value, fallback))
    .replace(/^turned\b/i, 'turn')
    .replace(/^made\b/i, 'make')
    .replace(/^announced\b/i, 'announce');
}

function toClause(value, fallback) {
  return trimSentence(cleanPhrase(value, fallback))
    .replace(/^that\s+/i, '')
    .replace(/^(were|was|is|are)\s+/i, '');
}

function buildSegment(speaker, id, text, citations = [], exhibitId = null) {
  return {
    id,
    speaker: speaker.id,
    label: speaker.label,
    voiceTag: speaker.voiceTag,
    mood: speaker.mood,
    voiceId: speaker.voiceId,
    text,
    citations,
    exhibitId,
  };
}

function buildAgentSegmentLine(segment, index) {
  const taggedText = segment.voiceTag
    ? `<${segment.voiceTag}>${segment.text}</${segment.voiceTag}>`
    : segment.text;

  return `${index + 1}. ${segment.label}: ${taggedText}`;
}

function buildReceipts(dossier) {
  const quotes = dossier.highSignalQuotes || [];

  return [
    {
      id: 'receipt-identity',
      platform: 'Identity',
      heading: cleanPhrase(dossier.subject?.profession, 'Online Persona'),
      detail: cleanPhrase(
        dossier.subject?.selfMythology,
        'The public internet paints them as someone who worked hard to be perceived.',
      ),
    },
    {
      id: 'receipt-pattern',
      platform: 'Pattern',
      heading: 'Recurring Bits',
      detail: cleanPhrase(
        pickFirst(dossier.recurringThemes, 'Build in public, post through it, repeat.'),
        'Build in public, post through it, repeat.',
      ),
    },
    {
      id: 'receipt-quote',
      platform: 'Keepsake',
      heading: 'The line that stays',
      detail: quoteSnippet(
        pickQuote(quotes, ['x', 'linkedin', 'instagram']),
        'Even the receipts are still loading.',
      ),
    },
  ];
}

export function buildFuneralScript(dossier, options = {}) {
  const speakerCatalog = getSpeakerCatalog();
  const quotes = dossier.highSignalQuotes || [];
  const momQuote = pickQuote(quotes, ['linkedin', 'instagram', 'x']);
  const friendQuote = pickAlternateQuote(
    quotes,
    momQuote,
    pickQuote(quotes, ['instagram', 'x', 'linkedin']),
  );

  const subjectName = cleanPhrase(
    dossier.subject?.probableName || options.displayName,
    'the dearly over-shared',
  );
  const tenderness = cleanPhrase(
    pickFirst(dossier.tenderness, 'occasionally sounded like a soft person hiding inside a busy persona'),
    'occasionally sounded like a soft person hiding inside a busy persona',
  );
  const recurringTheme = cleanPhrase(
    pickFirst(dossier.recurringThemes, 'turning ordinary life into content'),
    'turning ordinary life into content',
  );
  const absencePattern = cleanPhrase(
    pickFirst(dossier.socialAbsences, 'sounded easier to reach online than in real life'),
    'sounded easier to reach online than in real life',
  );
  const redFlag = cleanPhrase(
    pickFirst(dossier.relationshipRedFlags, 'kept sounding emotionally unavailable with good wifi'),
    'kept sounding emotionally unavailable with good wifi',
  );
  const friendMaterial = cleanPhrase(
    pickFirst(dossier.friendMaterial, 'was funnier and more chaotic than any of this should probably admit'),
    'was funnier and more chaotic than any of this should probably admit',
  );
  const workStyle = cleanPhrase(
    pickFirst(dossier.workStyle, 'worked hard enough that concern often arrived dressed up as admiration'),
    'worked hard enough that concern often arrived dressed up as admiration',
  );
  const momLine = quoteSnippet(
    momQuote,
    'I am doing my best.',
  );
  const friendLine = quoteSnippet(
    friendQuote,
    'Please do not post this.',
  );
  const receipts = buildReceipts(dossier);
  const momExhibitId =
    momQuote?.platform === 'user' && momQuote?.sourceUrl
      ? momQuote.sourceUrl
      : 'receipt-pattern';
  const friendExhibitId =
    friendQuote?.platform === 'user' && friendQuote?.sourceUrl
      ? friendQuote.sourceUrl
      : 'receipt-quote';
  const script = [
    buildSegment(
      speakerCatalog.mom,
      'mom-tribute',
      `[softly] On paper, you looked sorted. Smart. Busy. Going somewhere. In real life, it was a lot more fragile than that. You ${toSecondPerson(
        absencePattern,
        'were easier to reach online than in real life',
      )}. You worked like somebody who thought momentum could replace rest. Even your own words said it: "${momLine}" That is not swagger. That is a person holding the whole week together with one brave sentence. And under all the public competence, there was someone who ${toClause(
        tenderness,
        'was still soft in the places nobody could see',
      )}. That is the one I came to mourn. Not the profile. Not the performance. The person.`,
      momQuote ? [momQuote] : [],
      momExhibitId,
    ),
    buildSegment(
      speakerCatalog.best_friend,
      'best-friend-tribute',
      `[dryly] Honestly, none of this shocked your friends. We watched you ${toActionPhrase(
        recurringTheme,
        'turn ordinary life into content',
      )} like it was a coping mechanism with good lighting. We watched you turn pressure into a personality trait. Offline, it was simpler and much funnier: ${trimSentence(
        friendMaterial,
      )}. Then you left evidence for the prosecution like "${friendLine}" That is not a private thought. That is a group-chat gift. And yes, sometimes you came off like someone who ${toClause(
        redFlag,
        'was emotionally unavailable with excellent signal strength',
      )}. But that was the trick. You were chaotic in a very watchable way, so people kept laughing right up until the bit became the whole character.`,
      friendQuote ? [friendQuote] : [],
      friendExhibitId,
    ),
  ];

  return {
    subjectName,
    summary: 'A short two-voice funeral from Mom and Best Friend.',
    receipts,
    script,
  };
}

export function buildFuneralAgentConversation(dossier, built) {
  const compactDossier = {
    subject: dossier.subject || {},
    highSignalQuotes: (dossier.highSignalQuotes || []).slice(0, 5),
    recurringThemes: (dossier.recurringThemes || []).slice(0, 5),
    braggingPatterns: (dossier.braggingPatterns || []).slice(0, 4),
    tenderness: (dossier.tenderness || []).slice(0, 3),
    socialAbsences: (dossier.socialAbsences || []).slice(0, 3),
    relationshipRedFlags: (dossier.relationshipRedFlags || []).slice(0, 3),
    workStyle: (dossier.workStyle || []).slice(0, 3),
    friendMaterial: (dossier.friendMaterial || []).slice(0, 3),
    oneSentenceObituary: dossier.oneSentenceObituary || '',
  };

  const prompt = [
    'You are ROAST.',
    'You perform a short two-voice eulogy for a consenting user based on their public web footprint.',
    'You are not here to chat. You are here to perform.',
    'When the conversation begins, wait for the user message "Run my funeral now." Then perform the funeral exactly as written.',
    'Never ask follow-up questions, never explain the setup, never mention tools, and never break character.',
    'Keep the exact order of speakers: Mom, Best Friend.',
    'Do not add any other speakers, introductions, transitions, or closing remarks.',
    'After the Best Friend segment, remain silent and wait for the client to close the session.',
    'Do not ask whether the user is still there, do not invite them to speak, and do not continue into open conversation.',
    'Read the provided script almost verbatim. Do not paraphrase unless needed for pronunciation.',
    'Do not restart, summarize, or repeat any line.',
    'Use plain colloquial English that anyone can understand.',
    'Prefer short clear sentences over poetic or dramatic wording.',
    'Make it feel like a short story being told by two people who knew the subject well.',
    'Dark humor should be dry, observational, and earned, not broad or cartoonish.',
    'Let the rhythm feel like a tight stand-up bit told in conversation: quick pivots, self-owning details, clean punchy phrasing.',
    'A light urban Indian-English cadence is welcome, but do not imitate any real comedian, actor, or public figure.',
    'Avoid generic AI grief language, avoid purple prose, and never say the subject name out loud unless the exact script text includes it.',
    'Sound like people who actually knew the subject.',
    'Preserve the emotional delivery tags already written into the script.',
    'If multi-voice support is configured, use exact XML voice tags with these labels: <Mom>...</Mom> and <BestFriend>...</BestFriend>.',
    'Do not say the XML tags out loud. They are only for voice switching.',
    'If multi-voice support is not configured, perform the full service in the default voice while still making Mom and Best Friend feel distinct.',
    'Once the script is done, stop speaking.',
  ].join(' ');

  const context = [
    'Funeral subject: use second person only.',
    `Summary: ${built.summary}`,
    'Receipts:',
    ...built.receipts.map(
      (receipt, index) =>
        `${index + 1}. ${receipt.heading}: ${receipt.detail}`,
    ),
    'Perform this exact two-part funeral script:',
    ...built.script.map(
      (segment, index) => buildAgentSegmentLine(segment, index),
    ),
    'Supporting dossier:',
    JSON.stringify(compactDossier, null, 2),
  ].join('\n');

  return {
    prompt,
    context,
    kickoffMessage: 'Run my funeral now.',
  };
}
