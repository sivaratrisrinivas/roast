import { useConversation } from '@elevenlabs/react';
import { useEffect, useRef, useState } from 'react';
import logoSrc from '../assets/logo.png';

export function FuneralStage({ experience }) {
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [pendingKickoff, setPendingKickoff] = useState(false);
  const [funeralDone, setFuneralDone] = useState(false);
  const kickoffSentRef = useRef(false);
  const funeralDeliveredRef = useRef(false);
  const usesLiveAgent = Boolean(
    experience.type === 'agent' &&
      experience.liveAgent?.configured &&
      experience.agentConversation,
  );

  const conversation = useConversation({
    micMuted: true,
    onConnect: () => console.log('[DeathVoice] Connected'),
    onDisconnect: (details) => console.log('[DeathVoice] Disconnected', details),
    onMessage: (message) => {
      console.log('[DeathVoice] Message:', message);
      if (
        kickoffSentRef.current &&
        message.source === 'ai' &&
        message.message?.length > 200
      ) {
        funeralDeliveredRef.current = true;
      }
    },
    onModeChange: ({ mode }) => {
      console.log('[DeathVoice] Mode:', mode);
      if (mode === 'listening' && funeralDeliveredRef.current) {
        console.log('[DeathVoice] Funeral complete — ending session');
        setFuneralDone(true);
        conversationRef.current.endSession().catch(() => {});
      }
    },
    onError: (error) => {
      console.error('[DeathVoice] Error:', error);
      setAudioError(
        error?.message || 'Live ROAST failed to start. Try again in a moment.',
      );
    },
  });

  const agentStatusCopy =
    funeralDone
      ? 'The funeral has concluded.'
      : conversation.status === 'connected'
        ? conversation.isSpeaking
          ? 'The funeral is in session.'
          : 'DeathVoice is in the room.'
        : pendingKickoff || started
          ? 'Summoning DeathVoice…'
          : '';

  useEffect(() => {
    if (!usesLiveAgent || !pendingKickoff || conversation.status !== 'connected') return;
    conversation.sendContextualUpdate(experience.agentConversation.context);
    conversation.sendUserMessage(experience.agentConversation.kickoffMessage);
    kickoffSentRef.current = true;
    setPendingKickoff(false);
  }, [usesLiveAgent, pendingKickoff, conversation, experience.agentConversation]);

  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  useEffect(
    () => () => {
      conversationRef.current.endSession().catch(() => {});
    },
    [],
  );

  async function handleStart() {
    setStarted(true);
    setAudioError('');

    if (!usesLiveAgent) return;

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
            connectionType: 'websocket',
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
    <section className="screen screen-card funeral-screen screen-enter">
      <img src={logoSrc} alt="ROAST" className="hero-logo-small" />
      <h2 className="subject-name">{experience.subjectName}</h2>

      {!started ? (
        <>
          <div className="receipts-list">
            {experience.receipts.slice(0, 3).map((receipt, index) => (
              <article className="receipt-chip" key={`${receipt.heading}-${index}`}>
                <span className="receipt-heading">{receipt.heading}</span>
                <p className="receipt-detail">{receipt.detail}</p>
              </article>
            ))}
          </div>

          <button
            className="primary-action cta-pulse"
            type="button"
            onClick={handleStart}
          >
            {usesLiveAgent ? 'Unleash the Funeral' : 'Read the Eulogy'}
          </button>
        </>
      ) : (
        <>
          {usesLiveAgent ? (
            <div className="audio-shell agent-shell">
              <p className="micro-note">
                <span className="status-dot" />
                {agentStatusCopy}
              </p>
              {!funeralDone ? (
                <p className="agent-note">
                  Allow mic access once. ROAST performs from the script — you just listen.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="micro-note">
              Live agent not configured. The written eulogy is below.
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
