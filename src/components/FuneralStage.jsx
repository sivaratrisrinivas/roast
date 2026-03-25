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

export function FuneralStage({ experience }) {
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [pendingKickoff, setPendingKickoff] = useState(false);
  const [funeralDone, setFuneralDone] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);

  const kickoffSentRef = useRef(false);
  const funeralDeliveredRef = useRef(false);
  const currentSpeakerIndexRef = useRef(0);
  const performanceScheduledRef = useRef(false);
  const performanceTimersRef = useRef([]);
  const activityIntervalRef = useRef(null);

  useEffect(() => {
    currentSpeakerIndexRef.current = currentSpeakerIndex;
  }, [currentSpeakerIndex]);

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

    if (totalEstimatedDurationMs > 0) {
      const completionTimerId = setTimeout(() => {
        funeralDeliveredRef.current = true;
        setFuneralDone(true);
        clearPerformanceSchedule();
        console.log('[DeathVoice] Estimated performance complete; ending session');
        conversationRef.current.endSession().catch(() => {});
      }, totalEstimatedDurationMs + 1500);

      performanceTimersRef.current.push(completionTimerId);
    }
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
      if (mode === 'listening' && funeralDeliveredRef.current) {
        setFuneralDone(true);
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

      setPendingKickoff(true);
    } catch (error) {
      setAudioError(error?.message || 'Live ROAST failed to start. Check mic access.');
    }
  }

  // Current speaker details
  const currentSegment = experience.script[currentSpeakerIndex] || experience.script[0];
  const portraitSrc = speakerPortraits[currentSegment.speaker] || momPortrait;

  // Display the authored script for the active role instead of the raw transcript tail.
  const displayLine = stripPerformanceTags(currentSegment.text) || '...';

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
        <motion.button
          className="summon-button cta-pulse"
          onClick={handleStart}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          Begin the Service
        </motion.button>
      ) : (
        <>
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
                  "{displayLine}"
                </motion.p>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {!funeralDone && (
            <p className="mic-instruction">
              {conversation.status === 'connected' 
                ? (conversation.isSpeaking ? 'The service is in progress' : 'Waiting on DeathVoice...') 
                : 'Connecting to the Chapel...'}
            </p>
          )}

          {funeralDone && (
            <motion.p 
              className="speaker-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 3 }}
              style={{ marginTop: '2rem' }}
            >
              The service is over.
            </motion.p>
          )}

          {/* Cinematic flare transition overlay */}
          <AnimatePresence>
            {!funeralDone && (
              <motion.div 
                className="flare-overlay"
                key={"flare-" + currentSegment.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.15, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
