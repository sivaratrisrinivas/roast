const DEFAULT_VOICE_IDS = {
  officiant: process.env.ELEVEN_VOICE_OFFICIANT_ID || 'JBFqnCBsd6RMkjVDRZzb',
  mom: process.env.ELEVEN_VOICE_MOM_ID || 'EXAVITQu4vr4xnSDxMaL',
  ex: process.env.ELEVEN_VOICE_EX_ID || 'Xb7hH8MSUJpSbSDYk0k2',
  boss: process.env.ELEVEN_VOICE_BOSS_ID || 'IKne3meq5aSn9XLyUdCD',
  best_friend: process.env.ELEVEN_VOICE_BEST_FRIEND_ID || '29vD33N1CtxCmqQRPOHJ',
};

export function getSpeakerCatalog() {
  return {
    officiant: {
      id: 'officiant',
      label: 'Officiant',
      mood: 'somber',
      voiceId: DEFAULT_VOICE_IDS.officiant,
    },
    mom: {
      id: 'mom',
      label: 'Mom',
      mood: 'crying',
      voiceId: DEFAULT_VOICE_IDS.mom,
    },
    ex: {
      id: 'ex',
      label: 'Ex',
      mood: 'bitter',
      voiceId: DEFAULT_VOICE_IDS.ex,
    },
    boss: {
      id: 'boss',
      label: 'Boss',
      mood: 'awkward corporate grief',
      voiceId: DEFAULT_VOICE_IDS.boss,
    },
    best_friend: {
      id: 'best_friend',
      label: 'Best Friend',
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
  const momQuote = pickQuote(quotes, ['instagram', 'x']);
  const exQuote = pickQuote(quotes, ['x']);
  const bossQuote = pickQuote(quotes, ['linkedin']);
  const friendQuote = pickQuote(quotes, ['instagram', 'x', 'linkedin']);

  const subjectName = cleanPhrase(
    dossier.subject?.probableName || options.displayName,
    'the dearly over-shared',
  );
  const obituary = trimSentence(
    cleanPhrase(
      dossier.oneSentenceObituary,
      'they left us exactly how they lived: online, self-aware, and one post away from being too honest',
    ),
  );
  const tenderness = cleanPhrase(
    pickFirst(dossier.tenderness, 'occasionally sounded like a soft person hiding inside a busy persona'),
    'occasionally sounded like a soft person hiding inside a busy persona',
  );
  const recurringTheme = cleanPhrase(
    pickFirst(dossier.recurringThemes, 'turning ordinary life into content'),
    'turning ordinary life into content',
  );
  const braggingPattern = cleanPhrase(
    pickFirst(dossier.braggingPatterns, 'mistaking public updates for inner peace'),
    'mistaking public updates for inner peace',
  );
  const absencePattern = cleanPhrase(
    pickFirst(dossier.socialAbsences, 'sounded easier to reach online than in real life'),
    'sounded easier to reach online than in real life',
  );
  const redFlag = cleanPhrase(
    pickFirst(dossier.relationshipRedFlags, 'kept sounding emotionally unavailable with good wifi'),
    'kept sounding emotionally unavailable with good wifi',
  );
  const workStyle = cleanPhrase(
    pickFirst(dossier.workStyle, 'was loyal to shipping, if not always to inboxes'),
    'was loyal to shipping, if not always to inboxes',
  );
  const friendMaterial = cleanPhrase(
    pickFirst(dossier.friendMaterial, 'was funnier and more chaotic than any of this should probably admit'),
    'was funnier and more chaotic than any of this should probably admit',
  );

  const script = [
    {
      id: 'officiant-open',
      speaker: speakerCatalog.officiant.id,
      label: speakerCatalog.officiant.label,
      mood: speakerCatalog.officiant.mood,
      voiceId: speakerCatalog.officiant.voiceId,
      text: `[somber][measured] We are gathered here today to remember ${subjectName}. ${obituary}. The internet arrived early, carrying screenshots.`,
      citations: momQuote ? [momQuote] : [],
    },
    {
      id: 'mom-tribute',
      speaker: speakerCatalog.mom.id,
      label: speakerCatalog.mom.label,
      mood: speakerCatalog.mom.mood,
      voiceId: speakerCatalog.mom.voiceId,
      text: `[crying][voice breaks] He was such a bright child, and yet somehow ${absencePattern}. I kept seeing ${recurringTheme}, but not enough evidence of sleep. Even now I hear him saying, "${quoteText(
        momQuote,
        'I am still figuring it out',
      )}", and I want to ask whether he ever figured out how to call his mother back.`,
      citations: momQuote ? [momQuote] : [],
    },
    {
      id: 'ex-tribute',
      speaker: speakerCatalog.ex.id,
      label: speakerCatalog.ex.label,
      mood: speakerCatalog.ex.mood,
      voiceId: speakerCatalog.ex.voiceId,
      text: `[bitter laugh][sharp] I loved the version of ${subjectName} that existed between posts. The rest of the time, ${redFlag}. You can actually see it in the public record. He typed, "${quoteText(
        exQuote,
        'another late night, another beautifully avoidant sentence',
      )}", like a man subtweeting the relationship while he was still inside it.`,
      citations: exQuote ? [exQuote] : [],
    },
    {
      id: 'boss-tribute',
      speaker: speakerCatalog.boss.id,
      label: speakerCatalog.boss.label,
      mood: speakerCatalog.boss.mood,
      voiceId: speakerCatalog.boss.voiceId,
      text: `[formal][careful pause] On behalf of leadership, we appreciated that ${subjectName} ${workStyle}. Their LinkedIn confirmed the same thing with unusual confidence: "${quoteText(
        bossQuote,
        'shipping is my love language',
      )}". We lost a builder today, and possibly the only person who could turn a humblebrag into an operational update.`,
      citations: bossQuote ? [bossQuote] : [],
    },
    {
      id: 'friend-tribute',
      speaker: speakerCatalog.best_friend.id,
      label: speakerCatalog.best_friend.label,
      mood: speakerCatalog.best_friend.mood,
      voiceId: speakerCatalog.best_friend.voiceId,
      text: `[soft laugh][trying not to cry] Honestly, this is the most ${subjectName} ending possible. A beautiful room, a strange amount of self-awareness, and receipts projected on the wall. Underneath the ${braggingPattern}, there was someone who ${tenderness}. Also, for the record, "${quoteText(
        friendQuote,
        'please do not post this',
      )}" is now a terrible final wish because obviously we posted all of this.`,
      citations: friendQuote ? [friendQuote] : [],
    },
    {
      id: 'officiant-close',
      speaker: speakerCatalog.officiant.id,
      label: speakerCatalog.officiant.label,
      mood: 'final blessing',
      voiceId: speakerCatalog.officiant.voiceId,
      text: `[whisper][long pause] Let the record show that ${subjectName} was adored, observed, and occasionally outperformed by their own timeline. May the algorithm rest in silence. ${friendMaterial}.`,
      citations: [],
    },
  ];

  return {
    subjectName,
    summary: `${subjectName} lived online in a voice that made grief and secondhand embarrassment feel adjacent.`,
    receipts: buildReceipts(dossier),
    script,
  };
}
