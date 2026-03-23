import { startTransition, useEffect, useState } from 'react';
import { FuneralForm } from './components/FuneralForm.jsx';
import { FuneralStage } from './components/FuneralStage.jsx';

const initialForm = {
  profileInput: '',
};

const loadingLines = [
  'Pulling the public version of you off the internet.',
  'Turning that version into a funeral script.',
  'Handing each mourner a voice.',
  'Setting the room and dimming the lights.',
];

async function postFuneralRequest(payload) {
  const response = await fetch('/api/funeral', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Funeral service failed to start.');
  }

  return data;
}

function IntroScreen({ onBegin }) {
  return (
    <section className="screen screen-card intro-screen">
      <p className="brand-mark">ROAST</p>
      <h1 className="welcome-title">One public profile. One funeral.</h1>
      <p className="screen-copy">
        Give ROAST a public profile and it will turn that internet version of
        you into a staged funeral.
      </p>
      <button className="primary-action" type="button" onClick={onBegin}>
        Start
      </button>
    </section>
  );
}

function LoadingScreen({ line }) {
  return (
    <section className="screen screen-card loading-screen">
      <div className="status-orb" aria-hidden="true" />
      <p className="brand-mark">ROAST</p>
      <h2 className="screen-title">{line}</h2>
    </section>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [experience, setExperience] = useState(null);
  const [screen, setScreen] = useState('intro');
  const [error, setError] = useState('');
  const [loadingIndex, setLoadingIndex] = useState(0);
  const loading = screen === 'loading';

  useEffect(() => {
    if (!loading) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingLines.length);
    }, 1900);

    return () => window.clearInterval(timer);
  }, [loading]);

  async function handleSubmit(event) {
    event.preventDefault();
    setScreen('loading');
    setError('');
    setExperience(null);
    setLoadingIndex(0);

    try {
      const data = await postFuneralRequest({
        profileInput: form.profileInput.trim(),
      });
      startTransition(() => {
        setExperience(data);
        setScreen('result');
      });
    } catch (submitError) {
      setError(submitError.message);
      setScreen('capture');
    }
  }

  function updateField(value) {
    setForm({ profileInput: value });
  }

  return (
    <div className="app-shell">
      <div className="backdrop-glow" aria-hidden="true" />
      {screen === 'intro' ? <IntroScreen onBegin={() => setScreen('capture')} /> : null}

      {screen === 'capture' ? (
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

      {screen === 'loading' ? <LoadingScreen line={loadingLines[loadingIndex]} /> : null}

      {screen === 'result' && experience ? (
        <main className="screen-wrap">
          <FuneralStage experience={experience} />
        </main>
      ) : null}
    </div>
  );
}
