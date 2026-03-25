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
  resumeAmbientScore,
  userGeminiApiKey,
}) {
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [pendingKickoff, setPendingKickoff] = useState(false);
  const [funeralDone, setFuneralDone] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);
  const [copiedLine, setCopiedLine] = useState(false);
  const [trailerStatus, setTrailerStatus] = useState('idle');
  const [trailerError, setTrailerError] = useState('');
  const [trailerScenes, setTrailerScenes] = useState([]);
  const [trailerJobId, setTrailerJobId] = useState('');
  const [trailerProgress, setTrailerProgress] = useState({
    sceneCount: 2,
    completedScenes: 0,
    currentSceneIndex: 1,
    currentSceneLabel: 'Mom',
  });
  const [trailerVisible, setTrailerVisible] = useState(false);

  const kickoffSentRef = useRef(false);
  const funeralDeliveredRef = useRef(false);
  const currentSpeakerIndexRef = useRef(0);
  const performanceScheduledRef = useRef(false);
  const performanceTimersRef = useRef([]);
  const activityIntervalRef = useRef(null);
  const completionTimerRef = useRef(null);
  const aiMessageSeenRef = useRef(false);
  const trailerAutostartedRef = useRef(false);

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
  const personalGeminiApiKey = `${userGeminiApiKey || ''}`.trim();
  const usingPersonalGeminiKey = Boolean(personalGeminiApiKey);
  const trailerAvailable = usingPersonalGeminiKey;

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
      }, Math.max(0, entry.startMs - visualLeadMs));

      performanceTimersRef.current.push(timerId);
    });

  }

  const conversation = useConversation({
    micMuted: true,
    onDisconnect: () => {
      clearPerformanceSchedule();
    },
    onMessage: (message) => {
      const messageText =
        typeof message.message === 'string' ? message.message : '';

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
          conversationRef.current.endSession().catch(() => { });
        }, 3200);
      }
    },
    onError: (error) => {
      setAudioError(error?.message || 'Live ROAST failed to start. Try again in a moment.');
    },
  });

  useEffect(() => {
    if (!pendingKickoff || conversation.status !== 'connected') return;
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

  useEffect(
    () => () => {
      clearPerformanceSchedule();
      conversationRef.current.endSession().catch(() => { });
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
      if (typeof resumeAmbientScore === 'function') {
        await resumeAmbientScore();
      }
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

  function buildTrailerPayload() {
    return {
      subjectName: experience.subjectName,
      summary: experience.summary,
      receipts: experience.receipts,
      geminiApiKey: personalGeminiApiKey || undefined,
      script: experience.script.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        label: segment.label,
        text: segment.text,
      })),
    };
  }

  function applyTrailerState(payload = {}) {
    setTrailerJobId(payload.jobId || '');
    setTrailerStatus(payload.status || 'idle');
    setTrailerError(payload.error || '');
    setTrailerScenes(Array.isArray(payload.scenes) ? payload.scenes : []);
    setTrailerProgress(
      payload.progress || {
        sceneCount: 2,
        completedScenes: 0,
        currentSceneIndex: 1,
        currentSceneLabel: 'Mom',
      },
    );
  }

  async function requestTrailerGeneration() {
    if (!trailerAvailable) {
      setTrailerStatus('error');
      setTrailerError('Add your Gemini API key to enable trailer video generation.');
      return null;
    }

    setTrailerStatus('loading');
    setTrailerError('');

    try {
      const response = await fetch('/api/trailer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildTrailerPayload()),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to generate the trailer.');
      }

      applyTrailerState(payload);
      return payload;
    } catch (error) {
      setTrailerError(
        error?.message || 'Unable to generate the trailer right now.',
      );
      setTrailerStatus('error');
      return null;
    }
  }

  async function handleGenerateTrailer() {
    if (trailerStatus === 'ready') {
      setTrailerVisible(true);
      return;
    }

    setTrailerVisible(true);

    if (!trailerJobId) {
      await requestTrailerGeneration();
    }
  }

  useEffect(() => {
    if (!usingPersonalGeminiKey || !trailerAvailable || trailerAutostartedRef.current) {
      return;
    }

    trailerAutostartedRef.current = true;
    requestTrailerGeneration();
  }, [trailerAvailable, usingPersonalGeminiKey]);

  useEffect(() => {
    if (!trailerJobId || !['queued', 'running', 'loading'].includes(trailerStatus)) {
      return undefined;
    }

    let cancelled = false;

    async function pollTrailerJob() {
      try {
        const response = await fetch(`/api/trailer/${trailerJobId}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load the trailer status.');
        }

        if (!cancelled) {
          applyTrailerState(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setTrailerError(
            error?.message || 'Unable to load the trailer status.',
          );
          setTrailerStatus('error');
        }
      }
    }

    pollTrailerJob();
    const intervalId = setInterval(pollTrailerJob, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [trailerJobId, trailerStatus]);

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
                className={`speaker-track-step${step.active ? ' speaker-track-step-active' : ''
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

                <div className="trailer-panel">
                  <div className="trailer-panel-copy">
                    <p className="micro-text">Trailer Mode</p>
                    <p className="trailer-panel-body">
                      Turn these eulogies into two animated 8-second teaser shots.
                    </p>
                  </div>

                  {!trailerVisible ? (
                    <div className="trailer-panel-actions">
                      <button
                        type="button"
                        className="service-action service-action-secondary"
                        onClick={handleGenerateTrailer}
                        disabled={!trailerAvailable}
                      >
                        {trailerStatus === 'ready'
                          ? 'Show Trailer'
                          : trailerStatus === 'loading' ||
                              trailerStatus === 'queued' ||
                              trailerStatus === 'running'
                            ? 'Open Trailer'
                            : trailerAvailable
                              ? 'Generate Trailer'
                              : 'Add Gemini Key'}
                      </button>
                      <p className="micro-text trailer-helper">
                        {trailerStatus === 'ready'
                          ? 'The clips are ready. Open them now.'
                          : trailerStatus === 'loading' ||
                              trailerStatus === 'queued' ||
                              trailerStatus === 'running'
                            ? funeralDone
                              ? 'The trailer has been rendering in the background. Open it to see live progress.'
                              : 'The trailer is already rendering in the background while the eulogies play.'
                          : usingPersonalGeminiKey
                            ? 'Your Gemini key is active, so trailer rendering can start before the service ends.'
                            : 'Trailer Mode is off until the user adds their own Gemini API key on the home screen.'}
                      </p>
                      {trailerError ? (
                        <p className="micro-text trailer-error">{trailerError}</p>
                      ) : null}
                    </div>
                  ) : trailerStatus === 'ready' ? (
                    <div className="trailer-grid">
                      {trailerScenes.map((scene) => (
                        <article key={scene.id} className="trailer-card">
                          <div className="trailer-card-copy">
                            <p className="micro-text">{scene.label}</p>
                            <p className="trailer-caption">{scene.caption}</p>
                          </div>
                          <video
                            className="trailer-video"
                            src={scene.videoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            controls
                            preload="metadata"
                          />
                          <a
                            className="service-action service-action-secondary trailer-download"
                            href={scene.videoUrl}
                            download={`${scene.id}.mp4`}
                          >
                            Download Clip
                          </a>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="trailer-panel-actions">
                      <div className="trailer-progress-card">
                        <p className="micro-text">
                          Rendering Scene {trailerProgress.currentSceneIndex} of{' '}
                          {trailerProgress.sceneCount}
                        </p>
                        <p className="trailer-panel-body">
                          {trailerProgress.currentSceneLabel || 'Preparing the next shot'}
                        </p>
                        <div className="trailer-progress-bar" aria-hidden="true">
                          <span
                            className="trailer-progress-fill"
                            style={{
                              width: `${Math.max(
                                12,
                                (trailerProgress.completedScenes /
                                  Math.max(trailerProgress.sceneCount, 1)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <p className="micro-text trailer-helper">
                        {funeralDone
                          ? 'The videos are still rendering. They should appear here automatically when ready.'
                          : 'Rendering continues while the service is still happening.'}
                      </p>
                      {trailerError ? (
                        <p className="micro-text trailer-error">{trailerError}</p>
                      ) : null}
                    </div>
                  )}
                </div>

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
