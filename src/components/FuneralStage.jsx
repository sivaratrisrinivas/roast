import { useConversation } from '@elevenlabs/react';
import { useEffect, useRef, useState } from 'react';

function buildTimelineStyle(segment, totalDuration) {
  const width = Math.max(
    ((segment.endTimeSeconds - segment.startTimeSeconds) / totalDuration) * 100,
    8,
  );
  const left = (segment.startTimeSeconds / totalDuration) * 100;

  return {
    width: `${width}%`,
    left: `${left}%`,
  };
}

export function FuneralStage({ experience }) {
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [pendingKickoff, setPendingKickoff] = useState(false);
  const audioRef = useRef(null);
  const hasAudio = Boolean(experience.audio?.base64);
  const usesLiveAgent = Boolean(
    experience.type === 'agent' &&
      experience.liveAgent?.configured &&
      experience.agentConversation,
  );
  const audioSrc = experience.audio?.base64
    ? `data:${experience.audio.mimeType};base64,${experience.audio.base64}`
    : '';
  const conversation = useConversation({
    micMuted: true,
    overrides: usesLiveAgent
      ? {
          agent: {
            prompt: {
              prompt: experience.agentConversation.prompt,
            },
          },
        }
      : undefined,
    onError: (error) => {
      setAudioError(
        error?.message || 'Live ROAST failed to start. Try again in a moment.',
      );
    },
  });
  const agentStatusCopy = !usesLiveAgent
    ? ''
    : conversation.status === 'connected'
      ? conversation.isSpeaking
        ? 'ROAST is performing live.'
        : 'ROAST is in the room.'
      : pendingKickoff || started
        ? 'Connecting to the live funeral director...'
        : '';

  const totalDuration =
    experience.audio?.segments?.reduce(
      (largest, segment) =>
        Math.max(largest, Number(segment.endTimeSeconds || 0)),
      0,
    ) || 0;

  useEffect(() => {
    if (!started || !hasAudio || !audioRef.current) {
      return;
    }

    audioRef.current.play().catch(() => {
      setAudioError('Press play in the audio bar if your browser blocks autoplay.');
    });
  }, [started, hasAudio]);

  useEffect(() => {
    if (!usesLiveAgent || !pendingKickoff || conversation.status !== 'connected') {
      return;
    }

    conversation.sendContextualUpdate(experience.agentConversation.context);
    conversation.sendUserMessage(experience.agentConversation.kickoffMessage);
    setPendingKickoff(false);
  }, [
    usesLiveAgent,
    pendingKickoff,
    conversation,
    experience.agentConversation,
  ]);

  useEffect(
    () => () => {
      if (usesLiveAgent && conversation.status !== 'disconnected') {
        conversation.endSession().catch(() => {});
      }
    },
    [usesLiveAgent, conversation],
  );

  async function handleStart() {
    setStarted(true);
    setAudioError('');

    if (!usesLiveAgent) {
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (conversation.status === 'disconnected') {
        if (experience.liveAgent.requiresAuth) {
          const response = await fetch('/api/eleven/signed-url');
          const data = await response.json().catch(() => ({}));

          if (!response.ok || !data.signedUrl) {
            throw new Error(data.error || 'Unable to start live ROAST.');
          }

          await conversation.startSession({
            signedUrl: data.signedUrl,
            connectionType: 'websocket',
            userId: experience.subjectName,
          });
        } else if (experience.liveAgent.agentId) {
          await conversation.startSession({
            agentId: experience.liveAgent.agentId,
            connectionType: 'webrtc',
            userId: experience.subjectName,
          });
        } else {
          throw new Error('ELEVENLABS_AGENT_ID is missing.');
        }
      }

      setPendingKickoff(true);
    } catch (error) {
      setAudioError(
        error?.message || 'Live ROAST failed to start. Check mic access and try again.',
      );
    }
  }

  return (
    <section className="screen screen-card result-screen">
      <p className="brand-mark">ROAST</p>
      <p className="result-kicker">
        {experience.mode === 'demo' ? 'DEMO SERVICE READY' : 'SERVICE READY'}
      </p>
      <h2 className="result-name">{experience.subjectName}</h2>
      <p className="result-summary">{experience.summary}</p>

      {!started ? (
        <>
          <div className="receipts-list">
            {experience.receipts.slice(0, 3).map((receipt, index) => (
              <article className="receipt-chip" key={`${receipt.heading}-${index}`}>
                <span>{receipt.heading}</span>
                <p>{receipt.detail}</p>
              </article>
            ))}
          </div>

          <button
            className="primary-action"
            type="button"
            onClick={handleStart}
          >
            {usesLiveAgent
              ? 'Start Live ROAST'
              : hasAudio
                ? 'Play ROAST'
                : 'Open ROAST'}
          </button>
        </>
      ) : (
        <>
          {usesLiveAgent ? (
            <div className="audio-shell agent-shell">
              <p className="micro-note">{agentStatusCopy}</p>
              <p className="agent-note">
                Allow mic access once. ROAST keeps the conversation one-way and
                performs from the script you generated.
              </p>
            </div>
          ) : hasAudio ? (
            <div className="audio-shell">
              <audio ref={audioRef} controls className="audio-player" src={audioSrc} />
              {experience.audio?.segments?.length && totalDuration ? (
                <div className="timeline" aria-hidden="true">
                  {experience.audio.segments.map((segment) => (
                    <span
                      className={`timeline-segment tone-${segment.speaker}`}
                      key={`${segment.speaker}-${segment.dialogueInputIndex}`}
                      style={buildTimelineStyle(segment, totalDuration)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="micro-note">
              Audio is not configured yet. The written ROAST is below.
            </p>
          )}

          {audioError ? <p className="error-copy">{audioError}</p> : null}

          <div className="script-list">
            {experience.script.map((segment) => (
              <article className={`script-card tone-${segment.speaker}`} key={segment.id}>
                <p className="script-label">{segment.label}</p>
                <p className="script-text">{segment.text}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
