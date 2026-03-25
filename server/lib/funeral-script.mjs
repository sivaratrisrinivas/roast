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

function quoteText(quote, fallback) {
  if (!quote?.quote) {
    return fallback;
  }

  return quote.quote.replace(/\s+/g, ' ').trim();
}

function cleanPhrase(value, fallback) {
  if (!value || value === 'unknown') {
    return fallback;
  }

  return `${value}`.replace(/\s+/g, ' ').trim();
}

function trimSentence(value) {
  return value.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}

function adaptForSecondPerson(value, fallback) {
  const phrase = cleanPhrase(value, fallback);
  return phrase.replace(/^was\b/i, 'were');
}

function adaptWorkStyleForSecondPerson(value, fallback) {
  return cleanPhrase(value, fallback).replace(
    /,\s+and occasionally\b/i,
    ', but you occasionally',
  );
}

function buildSegment(speaker, id, text, citations = []) {
  return {
    id,
    speaker: speaker.id,
    label: speaker.label,
    voiceTag: speaker.voiceTag,
    mood: speaker.mood,
    voiceId: speaker.voiceId,
    text,
    citations,
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
      platform: 'Identity',
      heading: cleanPhrase(dossier.subject?.profession, 'Online Persona'),
      detail: cleanPhrase(
        dossier.subject?.selfMythology,
        'The public internet paints them as someone who worked hard to be perceived.',
      ),
    },
    {
      platform: 'Pattern',
      heading: 'Recurring Bits',
      detail: cleanPhrase(
        pickFirst(dossier.recurringThemes, 'Build in public, post through it, repeat.'),
        'Build in public, post through it, repeat.',
      ),
    },
    {
      platform: 'Quote',
      heading: 'The Line Everyone Remembers',
      detail: quoteText(
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
  const friendQuote = pickQuote(quotes, ['instagram', 'x', 'linkedin']);

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
  const script = [
    buildSegment(
      speakerCatalog.mom,
      'mom-tribute',
      `[softly] I knew you before any of this had an audience. Before the posts, there was just someone who ${tenderness}. What worried me was how often you ${adaptForSecondPerson(
        absencePattern,
        'were easier to reach online than in real life',
      )}. When I read "${quoteText(
        momQuote,
        'I am doing my best',
      )}", it did not sound impressive. It sounded tired and real. You ${adaptWorkStyleForSecondPerson(
        workStyle,
        'could work hard under pressure, but you sometimes treated that like proof that everything was fine',
      )}. That was the real story, not the performance.`,
      momQuote ? [momQuote] : [],
    ),
    buildSegment(
      speakerCatalog.best_friend,
      'best-friend-tribute',
      `[dryly] Being your friend meant watching how you ${recurringTheme}. Online it could look polished, but real life was simpler: ${friendMaterial}. And for the record, "${quoteText(
        friendQuote,
        'please do not post this',
      )}" was never going to work. You could sound like someone who ${redFlag}, but that was never the full picture.`,
      friendQuote ? [friendQuote] : [],
    ),
  ];

  return {
    subjectName,
    summary: `${subjectName} now gets a two-voice funeral from Mom and Best Friend, with no officiant framing and no extra speakers.`,
    receipts: buildReceipts(dossier),
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
    'When the conversation begins, wait for the user message "Run my funeral now." Then deliver the entire funeral service in one continuous performance.',
    'Never ask follow-up questions, never explain the setup, never mention tools, and never break character.',
    'Keep the exact order of speakers: Mom, Best Friend.',
    'Do not add any other speakers, introductions, transitions, or closing remarks.',
    'After the Best Friend segment, remain silent and wait for the client to close the session.',
    'Do not ask whether the user is still there, do not invite them to speak, and do not continue into open conversation.',
    'Stay extremely close to the provided funeral script and preserve its structure.',
    'Use plain colloquial English that anyone can understand.',
    'Prefer short clear sentences over poetic or dramatic wording.',
    'Dark humor should be dry and earned, not broad or cartoonish.',
    'Avoid generic AI grief language, avoid purple prose, and avoid repeating the subject name unless the script explicitly needs it.',
    'Sound like people who actually knew the subject.',
    'Preserve the emotional delivery tags already written into the script.',
    'If multi-voice support is configured, use exact XML voice tags with these labels: <Mom>...</Mom> and <BestFriend>...</BestFriend>.',
    'Do not say the XML tags out loud. They are only for voice switching.',
    'If multi-voice support is not configured, perform the full service in the default voice while still making Mom and Best Friend feel distinct.',
    `The funeral subject is ${built.subjectName}.`,
  ].join(' ');

  const context = [
    `Funeral subject: ${built.subjectName}`,
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
