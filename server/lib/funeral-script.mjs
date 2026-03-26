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

function createSignalText(...groups) {
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : [group]))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function countMatches(haystack, patterns = []) {
  return patterns.reduce((score, pattern) => {
    return score + (haystack.includes(pattern) ? 1 : 0);
  }, 0);
}

function hashSkeletonSeed(value = '') {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 2147483647;
  }

  return hash;
}

function pickSkeletonVariant(dossier, subjectName, recurringTheme, friendLine) {
  const signalText = createSignalText(
    dossier.recurringThemes,
    dossier.braggingPatterns,
    dossier.tenderness,
    dossier.socialAbsences,
    dossier.relationshipRedFlags,
    dossier.workStyle,
    dossier.friendMaterial,
    dossier.oneSentenceObituary,
  );
  const workSignals = createSignalText(
    dossier.workStyle,
    dossier.tenderness,
    dossier.oneSentenceObituary,
  );
  const builderSignals = createSignalText(
    dossier.recurringThemes,
    dossier.braggingPatterns,
    dossier.friendMaterial,
  );
  const absenceSignals = createSignalText(
    dossier.socialAbsences,
    dossier.relationshipRedFlags,
    dossier.tenderness,
  );
  const performanceSignals = createSignalText(
    dossier.recurringThemes,
    dossier.braggingPatterns,
    dossier.friendMaterial,
    (dossier.highSignalQuotes || []).map((quote) => quote.quote),
  );

  const scores = {
    overworked_golden_child: countMatches(workSignals, [
        'work',
        'pressure',
        'rest',
        'busy',
        'admiration',
        'recoverability',
        'tired',
      ]) +
      countMatches(workSignals, ['soft', 'human']) +
      1,
    chaotic_builder: countMatches(builderSignals, [
        'build',
        'ship',
        'launch',
      'velocity',
        'momentum',
        'demo',
        'chaos',
        'workflow',
    ]),
    double_life: countMatches(absenceSignals, [
      'online',
      'offline',
      'reach',
      'text',
      'unavailable',
      'avoidance',
      'signal',
      'hours',
    ]),
    main_character_performer: countMatches(performanceSignals, [
      'content',
      'timeline',
      'personality',
      'watchable',
      'quote',
      'performance',
      'brand',
      'public',
      'lore',
    ]),
  };

  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const topScore = ranked[0]?.[1] || 0;

  if (topScore > 0 && ranked[0][1] !== ranked[1]?.[1]) {
    return ranked[0][0];
  }

  const variants = [
    'overworked_golden_child',
    'chaotic_builder',
    'double_life',
    'main_character_performer',
  ];
  const seed = hashSkeletonSeed(
    `${subjectName}|${recurringTheme}|${friendLine}|${signalText}`,
  );

  return variants[Math.abs(seed) % variants.length];
}

function buildSkeletonScript(variant, context) {
  const {
    speakerCatalog,
    momQuote,
    friendQuote,
    momExhibitId,
    friendExhibitId,
    tenderness,
    recurringTheme,
    absencePattern,
    redFlag,
    friendMaterial,
    workStyle,
    momLine,
    friendLine,
  } = context;

  const skeletons = {
    overworked_golden_child: [
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
    ],
    chaotic_builder: [
      buildSegment(
        speakerCatalog.mom,
        'mom-tribute',
        `[softly] You did not know how to do anything halfway. Every small idea had to become a launch. Every rough week had to become momentum. You ${toSecondPerson(
          workStyle,
          'worked hard enough that worry started sounding like praise',
        )}. You ${toSecondPerson(
          absencePattern,
          'were easier to find online than in real life',
        )}. Even your own words said it: "${momLine}" That line tells me more than the profile ever did. It tells me the engine was still running long after the person was tired. Under the shipping and the performance, there was someone who ${toClause(
          tenderness,
          'was still soft in the places nobody could see',
        )}. That is the one I came to mourn.`,
        momQuote ? [momQuote] : [],
        momExhibitId,
      ),
      buildSegment(
        speakerCatalog.best_friend,
        'best-friend-tribute',
        `[dryly] Your friends knew the pattern. You would ${toActionPhrase(
          recurringTheme,
          'turn ordinary life into content',
        )} and call it a workflow. You made chaos sound productive. Offline, the bit was even better: ${trimSentence(
          friendMaterial,
        )}. Then you left the kind of evidence no defence lawyer wants, like "${friendLine}" That is not a thought. That is a release note from a mildly unstable startup. The funny part is, it worked. People kept watching because you were charismatic enough to make exhaustion look like a feature.`,
        friendQuote ? [friendQuote] : [],
        friendExhibitId,
      ),
    ],
    double_life: [
      buildSegment(
        speakerCatalog.mom,
        'mom-tribute',
        `[softly] The public version of you looked composed. Capable. Maybe even sorted. But the private truth kept leaking through. You ${toSecondPerson(
          absencePattern,
          'were easier to reach online than in real life',
        )}. You ${toSecondPerson(
          redFlag,
          'were emotionally unavailable with very good signal strength',
        )}. And then there was that one honest line: "${momLine}" I held on to that because it sounded like the real person tapping on the glass. Under the polished internet self, there was someone who ${toClause(
          tenderness,
          'was still soft in the places nobody could see',
        )}. That is who I came to say goodbye to.`,
        momQuote ? [momQuote] : [],
        momExhibitId,
      ),
      buildSegment(
        speakerCatalog.best_friend,
        'best-friend-tribute',
        `[dryly] The funniest thing about you was the split screen. Online, very composed. Offline, a small administrative disaster. You could ${toActionPhrase(
          recurringTheme,
          'turn ordinary life into content',
        )} and still somehow miss three texts in a row. That is talent. Your own archive kept snitching, especially "${friendLine}" That is the kind of sentence that explains a whole phase of somebody's life. And yes, sometimes you came off like someone who ${toClause(
          redFlag,
          'was emotionally unavailable with excellent signal strength',
        )}. But the friends knew the trick: the chaos was real, the charm was also real, and the two were always working overtime.`,
        friendQuote ? [friendQuote] : [],
        friendExhibitId,
      ),
    ],
    main_character_performer: [
      buildSegment(
        speakerCatalog.mom,
        'mom-tribute',
        `[softly] You had a way of making even an ordinary week sound like a season finale. The internet liked that version of you. It was neat. Watchable. But I could hear the strain underneath. You ${toSecondPerson(
          workStyle,
          'worked hard enough that concern often arrived dressed up as admiration',
        )}. You ${toSecondPerson(
          absencePattern,
          'were easier to reach online than in real life',
        )}. Then came a line like "${momLine}" and suddenly the whole performance cracked open. That is when the real person appeared. The one who ${toClause(
          tenderness,
          'was still soft in the places nobody could see',
        )}.`,
        momQuote ? [momQuote] : [],
        momExhibitId,
      ),
      buildSegment(
        speakerCatalog.best_friend,
        'best-friend-tribute',
        `[dryly] To be fair, you were always going to become content eventually. You could ${toActionPhrase(
          recurringTheme,
          'turn ordinary life into content',
        )} before most people had even processed the moment. Offline, though, the lore was stronger: ${trimSentence(
          friendMaterial,
        )}. Then you handed the case to the prosecution with "${friendLine}" That is not just oversharing. That is world-building. And that was the danger. The bit got so good that sometimes it started swallowing the person.`,
        friendQuote ? [friendQuote] : [],
        friendExhibitId,
      ),
    ],
  };

  return skeletons[variant] || skeletons.overworked_golden_child;
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
  const variant = pickSkeletonVariant(
    dossier,
    subjectName,
    recurringTheme,
    friendLine,
  );
  const script = buildSkeletonScript(variant, {
    speakerCatalog,
    momQuote,
    friendQuote,
    momExhibitId,
    friendExhibitId,
    tenderness,
    recurringTheme,
    absencePattern,
    redFlag,
    friendMaterial,
    workStyle,
    momLine,
    friendLine,
  });

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
