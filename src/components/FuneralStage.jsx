import { useConversation } from '@elevenlabs/react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import our Jony Ive-style cinematic generated portraits
import momPortrait from '../assets/portrait_officiant.png';
import bestFriendPortrait from '../assets/portrait_best_friend.png';

const speakerPortraits = {
  mom: momPortrait,
  best_friend: bestFriendPortrait,
};

function stripPerformanceTags(text) {
  return `${text || ''}`.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
}

function getMessageExcerpt(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function getCitationIds(segment) {
  return new Set(
    (segment?.citations || [])
      .map((citation) => citation.sourceUrl)
      .filter(Boolean),
  );
}

function stripOuterQuotes(text) {
  return `${text || ''}`
    .trim()
    .replace(/^[“"'`]+/, '')
    .replace(/[”"'`]+$/, '')
    .trim();
}

function estimateSegmentDurationMs(text) {
  const plainText = stripPerformanceTags(text);
  const words = plainText.split(/\s+/).filter(Boolean).length;
  const pauseTags = (text.match(/\[.*?\]/g) || []).length;
  const hardPauses = (plainText.match(/[.!?]/g) || []).length;
  const softPauses = (plainText.match(/[,:;]/g) || []).length;

  return Math.max(
    4500,
    Math.round(words * 185 + pauseTags * 220 + hardPauses * 130 + softPauses * 60 + 500),
  );
}

function buildEstimatedTimeline(script) {
  let cursorMs = 0;

  return script.map((segment, index) => {
    const durationMs = estimateSegmentDurationMs(segment.text);
    const item = {
      index,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
      durationMs,
    };
    cursorMs += durationMs;
    return item;
  });
}

async function buildSessionOptions(experience) {
  const baseOptions = {
    connectionType: 'websocket',
    userId: experience.subjectName,
  };

  if (experience.liveAgent?.requiresAuth) {
    const response = await fetch('/api/eleven/signed-url');
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.signedUrl) {
      throw new Error(data.error || 'Unable to start live ROAST.');
    }

    return {
      ...baseOptions,
      signedUrl: data.signedUrl,
    };
  }

  if (experience.liveAgent?.agentId) {
    return {
      ...baseOptions,
      agentId: experience.liveAgent.agentId,
    };
  }

  throw new Error('ELEVENLABS_AGENT_ID is missing.');
}

export function FuneralStage({
  experience,
  onReturnHome,
  onAmbientModeChange,
  ambientReady,
}) {
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [pendingKickoff, setPendingKickoff] = useState(false);
  const [funeralDone, setFuneralDone] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);
  const [copiedLine, setCopiedLine] = useState(false);

  const kickoffSentRef = useRef(false);
  const funeralDeliveredRef = useRef(false);
  const currentSpeakerIndexRef = useRef(0);
  const performanceScheduledRef = useRef(false);
  const performanceTimersRef = useRef([]);
  const activityIntervalRef = useRef(null);
  const completionTimerRef = useRef(null);
  const aiMessageSeenRef = useRef(false);

  useEffect(() => {
    currentSpeakerIndexRef.current = currentSpeakerIndex;
  }, [currentSpeakerIndex]);

  useEffect(() => {
    if (!copiedLine) {
      return undefined;
    }

    const timerId = setTimeout(() => {
      setCopiedLine(false);
    }, 1800);

    return () => clearTimeout(timerId);
  }, [copiedLine]);

  const estimatedTimeline = useMemo(() => {
    return buildEstimatedTimeline(experience.script);
  }, [experience.script]);
  const visualLeadMs = 1200;

  const totalEstimatedDurationMs =
    estimatedTimeline[estimatedTimeline.length - 1]?.endMs || 0;

  function clearPerformanceSchedule() {
    performanceTimersRef.current.forEach((timerId) => {
      clearTimeout(timerId);
    });
    performanceTimersRef.current = [];

    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }

    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }

  function schedulePerformanceTimeline() {
    clearPerformanceSchedule();
    performanceScheduledRef.current = true;

    console.log('[DeathVoice] Scheduling estimated performance timeline', {
      segments: estimatedTimeline,
      totalEstimatedDurationMs,
    });

    if (conversationRef.current.status === 'connected') {
      activityIntervalRef.current = setInterval(() => {
        if (
          conversationRef.current.status === 'connected' &&
          !funeralDeliveredRef.current
        ) {
          conversationRef.current.sendUserActivity?.();
        }
      }, 1500);
    }

    estimatedTimeline.forEach((entry) => {
      if (entry.index === 0) {
        return;
      }

      const timerId = setTimeout(() => {
        currentSpeakerIndexRef.current = entry.index;
        setCurrentSpeakerIndex(entry.index);
        console.log('[DeathVoice] Timeline speaker transition', {
          currentSpeakerIndex: entry.index,
          segmentId: experience.script[entry.index]?.id || null,
          speaker: experience.script[entry.index]?.speaker || null,
          label: experience.script[entry.index]?.label || null,
        });
      }, Math.max(0, entry.startMs - visualLeadMs));

      performanceTimersRef.current.push(timerId);
    });

  }

  useEffect(() => {
    console.log('[DeathVoice] Experience mounted', {
      subjectName: experience.subjectName,
      type: experience.type || experience.mode || 'unknown',
      scriptLength: experience.script.length,
      scriptSpeakers: experience.script.map((segment, index) => ({
        index,
        id: segment.id,
        speaker: segment.speaker,
        label: segment.label,
        estimatedDurationMs: estimatedTimeline[index]?.durationMs || null,
      })),
      hasAgentConversation: Boolean(experience.agentConversation),
      liveAgent: experience.liveAgent,
    });
  }, [estimatedTimeline, experience]);

  const conversation = useConversation({
    micMuted: true,
    onConnect: () => console.log('[DeathVoice] Connected'),
    onDisconnect: (details) => {
      clearPerformanceSchedule();
      console.log('[DeathVoice] Disconnected', details);
    },
    onStatusChange: ({ status }) => {
      console.log('[DeathVoice] Status:', status);
    },
    onInterruption: () => {
      console.log('[DeathVoice] User interruption detected while the agent was speaking');
    },
    onMessage: (message) => {
      const messageText =
        typeof message.message === 'string' ? message.message : '';

      console.log('[DeathVoice] Message received', {
        source: message.source || 'unknown',
        type: message.type || null,
        keys: Object.keys(message || {}),
        excerpt: getMessageExcerpt(messageText),
        capturedSpeakerIndex: currentSpeakerIndex,
        refSpeakerIndex: currentSpeakerIndexRef.current,
      });

      if (kickoffSentRef.current && message.source === 'ai' && messageText) {
        aiMessageSeenRef.current = true;
        if (completionTimerRef.current) {
          clearTimeout(completionTimerRef.current);
          completionTimerRef.current = null;
        }
        if (!performanceScheduledRef.current) {
          schedulePerformanceTimeline();
        }
      }
    },
    onModeChange: ({ mode }) => {
      console.log('[DeathVoice] Mode:', mode, {
        kickoffSent: kickoffSentRef.current,
        funeralDelivered: funeralDeliveredRef.current,
        currentSpeakerIndex: currentSpeakerIndexRef.current,
        isSpeaking: conversationRef.current?.isSpeaking ?? null,
        status: conversationRef.current?.status ?? null,
      });
      if (mode === 'speaking') {
        aiMessageSeenRef.current = true;
        onAmbientModeChange?.('ducked');
        if (completionTimerRef.current) {
          clearTimeout(completionTimerRef.current);
          completionTimerRef.current = null;
        }
      }
      if (mode === 'listening' && aiMessageSeenRef.current && kickoffSentRef.current) {
        onAmbientModeChange?.('idle');
        if (completionTimerRef.current) {
          clearTimeout(completionTimerRef.current);
        }
        completionTimerRef.current = setTimeout(() => {
          funeralDeliveredRef.current = true;
          setFuneralDone(true);
          console.log('[DeathVoice] Agent returned to listening; ending session');
          conversationRef.current.endSession().catch(() => {});
        }, 3200);
      }
    },
    onError: (error) => {
      console.error('[DeathVoice] Error:', error);
      setAudioError(error?.message || 'Live ROAST failed to start. Try again in a moment.');
    },
  });

  useEffect(() => {
    if (!pendingKickoff || conversation.status !== 'connected') return;
    console.log('[DeathVoice] Sending kickoff', {
      contextLength: experience.agentConversation?.context?.length || 0,
      kickoffMessage: experience.agentConversation?.kickoffMessage || null,
    });
    clearPerformanceSchedule();
    performanceScheduledRef.current = false;
    kickoffSentRef.current = false;
    funeralDeliveredRef.current = false;
    aiMessageSeenRef.current = false;
    setFuneralDone(false);
    currentSpeakerIndexRef.current = 0;
    setCurrentSpeakerIndex(0);
    conversation.sendContextualUpdate(experience.agentConversation.context);
    conversation.sendUserMessage(experience.agentConversation.kickoffMessage);
    kickoffSentRef.current = true;
    setPendingKickoff(false);
  }, [pendingKickoff, conversation, experience.agentConversation]);

  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  useEffect(() => {
    console.log('[DeathVoice] Active segment updated', {
      currentSpeakerIndex,
      segmentId: experience.script[currentSpeakerIndex]?.id || null,
      speaker: experience.script[currentSpeakerIndex]?.speaker || null,
      label: experience.script[currentSpeakerIndex]?.label || null,
    });
  }, [currentSpeakerIndex, experience.script]);

  useEffect(
    () => () => {
      clearPerformanceSchedule();
      conversationRef.current.endSession().catch(() => {});
    },
    []
  );

  useEffect(() => {
    if (!started) {
      return;
    }

    onAmbientModeChange?.(funeralDone ? 'tail' : 'idle');
  }, [funeralDone, onAmbientModeChange, started]);

  async function handleStart() {
    setStarted(true);
    setAudioError('');

    try {
      console.log('[DeathVoice] Starting session', {
        liveAgent: experience.liveAgent,
        hasAgentConversation: Boolean(experience.agentConversation),
        currentSpeakerIndex: currentSpeakerIndexRef.current,
      });
      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (conversation.status === 'disconnected') {
        await conversation.startSession(await buildSessionOptions(experience));
      }

      onAmbientModeChange?.('idle');
      setPendingKickoff(true);
    } catch (error) {
      setAudioError(error?.message || 'Live ROAST failed to start. Check mic access.');
    }
  }

  // Current speaker details
  const currentSegment = experience.script[currentSpeakerIndex] || experience.script[0];
  const portraitSrc = speakerPortraits[currentSegment.speaker] || momPortrait;
  const exhibits = Array.isArray(experience.exhibits) ? experience.exhibits : [];
  const activeExhibitId =
    currentSegment.exhibitId ||
    [...getCitationIds(currentSegment)][0] ||
    exhibits[currentSpeakerIndex]?.id ||
    exhibits[0]?.id ||
    null;
  const activeExhibit = exhibits.find((exhibit) => exhibit.id === activeExhibitId) ||
    exhibits[currentSpeakerIndex] ||
    exhibits[0] ||
    null;
  const remembranceExhibit =
    exhibits.find((exhibit) => exhibit.id === 'receipt-quote') ||
    exhibits.find((exhibit) => exhibit.type === 'summary_receipt') ||
    activeExhibit;
  const speakerSteps = experience.script.map((segment, index) => ({
    id: segment.id,
    label: segment.label,
    active: index === currentSpeakerIndex,
  }));

  // Display the authored script for the active role instead of the raw transcript tail.
  const displayLine = stripPerformanceTags(currentSegment.text) || '...';
  const remembranceLine = stripOuterQuotes(remembranceExhibit?.quote || '');

  async function handleCopyLine() {
    if (!remembranceLine) {
      return;
    }

    try {
      await navigator.clipboard.writeText(remembranceLine);
      setCopiedLine(true);
    } catch (_error) {
      setCopiedLine(false);
    }
  }

  if (audioError) {
    return (
      <div className="funeral-wrapper">
        <p className="micro-text" style={{ color: '#ff4d4d' }}>{audioError}</p>
      </div>
    );
  }

  return (
    <div className="funeral-wrapper">
      {!started ? (
        <motion.div
          className="service-ready"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          <p className="micro-text">Live performance ready</p>
          <motion.button
            className="summon-button cta-pulse"
            onClick={handleStart}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
          >
            Begin the Service
          </motion.button>
        </motion.div>
      ) : (
        <>
          <div className="speaker-track" aria-hidden="true">
            {speakerSteps.map((step) => (
              <div
                key={step.id}
                className={`speaker-track-step${
                  step.active ? ' speaker-track-step-active' : ''
                }`}
              >
                <span className="speaker-track-dot" />
                <span className="speaker-track-label">{step.label}</span>
              </div>
            ))}
          </div>

          {ambientReady ? (
            <div className="ambient-score-indicator" aria-hidden="true">
              <span className="ambient-score-dot" />
              <span className="ambient-score-label">Ambient score</span>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSegment.id}
              initial={{ opacity: 0, filter: 'blur(20px)', scale: 1.05 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
              transition={{ duration: 2.5, ease: 'easeInOut' }}
              className="portrait-container"
            >
              <img src={portraitSrc} alt={currentSegment.label} className="portrait-image" />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSegment.id + '-text'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <h3 className="speaker-name">{currentSegment.label}</h3>
              {started && !funeralDone ? (
                <motion.p
                  className="speaker-line"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  key={displayLine} // Forces re-animation on transcript update for a subtle pulse
                >
                  {displayLine}
                </motion.p>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {!funeralDone && activeExhibit ? (
              <motion.div
                key={`exhibit-${activeExhibit.id || currentSegment.id}`}
                className="exhibits-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              >
                <article className="exhibit-card exhibit-card-active">
                  <div className="exhibit-meta">
                    <span className="exhibit-platform">
                      {activeExhibit.sourceLabel}
                    </span>
                    <span className="exhibit-title">{activeExhibit.title}</span>
                  </div>
                  <p className="exhibit-quote">{stripOuterQuotes(activeExhibit.quote)}</p>
                </article>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {funeralDone ? (
              <motion.div
                key="service-finish"
                className="service-finish"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              >
                <p className="micro-text">The service is over</p>

                {remembranceLine ? (
                  <article className="memorial-card">
                    <div className="memorial-meta">
                      <span className="memorial-kicker">
                        {remembranceExhibit?.sourceLabel || 'Keepsake'}
                      </span>
                      <h4 className="memorial-title">
                        {remembranceExhibit?.title || 'The line that stays'}
                      </h4>
                    </div>
                    <p className="memorial-line">{remembranceLine}</p>
                  </article>
                ) : null}

                <div className="service-actions">
                  {remembranceLine ? (
                    <button
                      type="button"
                      className="service-action service-action-secondary"
                      onClick={handleCopyLine}
                    >
                      {copiedLine ? 'Copied' : 'Copy line'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="summon-button service-action service-action-primary"
                    onClick={onReturnHome}
                  >
                    Return Home
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
