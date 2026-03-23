import { useEffect, useState } from 'react';
import { useConversation } from '@elevenlabs/react';

function describeMessage(message) {
  if (typeof message === 'string') {
    return {
      role: 'agent',
      text: message,
    };
  }

  if (message?.message) {
    return {
      role: message.source || message.role || 'agent',
      text: message.message,
    };
  }

  if (message?.text) {
    return {
      role: message.source || message.role || 'agent',
      text: message.text,
    };
  }

  return {
    role: 'debug',
    text: JSON.stringify(message),
  };
}

function buildWakeOverrides(experience) {
  if (!experience) {
    return undefined;
  }

  const receipts = experience.receipts
    .slice(0, 3)
    .map((receipt) => `${receipt.platform}: ${receipt.detail}`)
    .join('\n');

  const systemPrompt = [
    'You are a funeral director hosting a darkly funny, emotionally intelligent memorial service.',
    `The subject is ${experience.subjectName}.`,
    'Stay theatrical, mournful, and a little cruel, but do not invent private facts.',
    'Use the provided public receipts when appropriate.',
    `Receipts:\n${receipts}`,
  ].join('\n');

  return {
    agent: {
      prompt: {
        prompt: systemPrompt,
      },
      firstMessage: `Welcome back. We are gathered to remember ${experience.subjectName}. Ask me who should speak next.`,
      language: 'en',
    },
    conversation: {
      textOnly: true,
    },
    ...(experience.liveAgent?.officiantVoiceId
      ? {
          tts: {
            voiceId: experience.liveAgent.officiantVoiceId,
          },
        }
      : {}),
  };
}

export function AgentWakePanel({ experience }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const conversation = useConversation({
    textOnly: true,
    overrides: buildWakeOverrides(experience),
    onConnect: () => {
      setError('');
    },
    onDisconnect: () => {
      setInput('');
    },
    onError: (nextError) => {
      setError(nextError?.message || 'The officiant lost the thread.');
    },
    onMessage: (message) => {
      setMessages((current) => [...current, describeMessage(message)]);
    },
  });

  useEffect(() => {
    setMessages([]);
    setInput('');
    setError('');
  }, [experience?.subjectName]);

  async function startWake() {
    if (!experience?.liveAgent?.configured) {
      return;
    }

    setMessages([]);
    setError('');

    try {
      if (experience.liveAgent.requiresAuth) {
        const response = await fetch('/api/eleven/signed-url');

        if (!response.ok) {
          throw new Error('Unable to mint a signed ElevenLabs URL.');
        }

        const body = await response.json();
        await conversation.startSession({
          signedUrl: body.signedUrl,
          connectionType: 'websocket',
          userId: experience.subjectName,
        });
        return;
      }

      await conversation.startSession({
        agentId: experience.liveAgent.agentId,
        connectionType: 'websocket',
        userId: experience.subjectName,
      });
    } catch (wakeError) {
      setError(wakeError.message);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();

    if (!input.trim()) {
      return;
    }

    const nextMessage = input.trim();
    setMessages((current) => [...current, { role: 'you', text: nextMessage }]);
    setInput('');

    try {
      await conversation.sendUserMessage(nextMessage);
    } catch (messageError) {
      setError(messageError.message);
    }
  }

  return (
    <section className="panel wake-panel">
      <div className="wake-header">
        <div>
          <p className="section-label">Live Officiant</p>
          <h2>Keep the wake going.</h2>
        </div>
        <p className="wake-status">
          {experience?.liveAgent?.configured
            ? conversation.status || 'ready'
            : 'not configured'}
        </p>
      </div>

      {!experience ? (
        <p className="wake-empty">
          Generate a funeral first. The officiant panel picks up that subject’s
          receipts and uses them as live conversation context.
        </p>
      ) : null}

      {experience && !experience.liveAgent?.configured ? (
        <div className="stacked-note">
          <p className="stacked-note-title">Agent wiring optional</p>
          <p>
            Set `ELEVENLABS_AGENT_ID` in the server env when you want a live
            officiant. The prerecorded funeral audio works independently.
          </p>
        </div>
      ) : null}

      {experience?.liveAgent?.configured ? (
        <>
          <div className="wake-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={startWake}
              disabled={
                conversation.status === 'connected' ||
                conversation.status === 'connecting'
              }
            >
              Start officiant
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => conversation.endSession()}
              disabled={conversation.status !== 'connected'}
            >
              End wake
            </button>
          </div>

          <div className="transcript">
            {messages.length ? (
              messages.map((message, index) => (
                <div className="transcript-line" key={`${message.role}-${index}`}>
                  <span>{message.role}</span>
                  <p>{message.text}</p>
                </div>
              ))
            ) : (
              <p className="wake-empty">
                Start the officiant and ask who should speak next, what the
                boss really thought, or which quote should close the service.
              </p>
            )}
          </div>

          <form className="wake-input-row" onSubmit={submitMessage}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask the officiant a question..."
              disabled={conversation.status !== 'connected'}
            />
            <button className="secondary-button" type="submit">
              Send
            </button>
          </form>
        </>
      ) : null}

      {error ? <p className="error-copy">{error}</p> : null}
    </section>
  );
}
