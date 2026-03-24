import { startTransition, useEffect, useState } from 'react';
import { FuneralForm } from './components/FuneralForm.jsx';
import { FuneralStage } from './components/FuneralStage.jsx';
import orbSrc from './assets/orb.png';

const initialForm = { profileInput: '' };

const conjuringLines = [
  'Pulling the public version of you off the internet…',
  'Turning receipts into a funeral script…',
  'Summoning the mourners…',
  'Dimming the lights…',
];

async function postFuneralRequest(payload) {
  const response = await fetch('/api/funeral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || 'Funeral service failed to start.';
    throw new Error(
      data.requestId ? `${message} [request ${data.requestId}]` : message,
    );
  }

  return data;
}

function ConjuringScreen({ line }) {
  return (
    <section className="screen screen-card conjuring-screen screen-enter">
      <img src={orbSrc} alt="" className="conjuring-orb" />
      <p className="conjuring-text">{line}</p>
    </section>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [experience, setExperience] = useState(null);
  const [screen, setScreen] = useState('summon');
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const loading = screen === 'conjuring';

  useEffect(() => {
    if (!loading) return undefined;

    const timer = setInterval(() => {
      setLineIndex((i) => (i + 1) % conjuringLines.length);
    }, 2200);

    return () => clearInterval(timer);
  }, [loading]);

  async function handleSubmit(event) {
    event.preventDefault();
    setScreen('conjuring');
    setError('');
    setExperience(null);
    setLineIndex(0);

    try {
      const data = await postFuneralRequest({
        profileInput: form.profileInput.trim(),
      });
      startTransition(() => {
        setExperience(data);
        setScreen('funeral');
      });
    } catch (submitError) {
      setError(submitError.message);
      setScreen('summon');
    }
  }

  function updateField(value) {
    setForm({ profileInput: value });
  }

  return (
    <div className="app-shell">
      <div className="backdrop-glow" aria-hidden="true" />

      {screen === 'summon' ? (
        <main className="screen-wrap">
          <FuneralForm
            value={form.profileInput}
            onSubmit={handleSubmit}
            onChange={updateField}
            error={error}
            loading={loading}
          />
        </main>
      ) : null}

      {screen === 'conjuring' ? (
        <ConjuringScreen line={conjuringLines[lineIndex]} />
      ) : null}

      {screen === 'funeral' && experience ? (
        <main className="screen-wrap">
          <FuneralStage experience={experience} />
        </main>
      ) : null}
    </div>
  );
}
