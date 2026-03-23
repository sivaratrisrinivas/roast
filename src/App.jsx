import { startTransition, useEffect, useState } from 'react';
import { FuneralForm } from './components/FuneralForm.jsx';
import { FuneralStage } from './components/FuneralStage.jsx';
import { AgentWakePanel } from './components/AgentWakePanel.jsx';

const initialForm = {
  displayName: '',
  xHandle: '',
  linkedinHandle: '',
  instagramHandle: '',
  demoMode: false,
  skipAudio: false,
};

const loadingLines = [
  'Searching the open web for your public life.',
  'Distilling the humblebrags into digital remains.',
  'Casting a grieving mother, a bitter ex, a rigid boss, and one loyal menace.',
  'Drafting a eulogy with enough receipts to make it sting.',
  'Lighting the candles and waiting for the first voice crack.',
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

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingIndex, setLoadingIndex] = useState(0);

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
    setLoading(true);
    setError('');
    setExperience(null);
    setLoadingIndex(0);

    try {
      const data = await postFuneralRequest(form);
      startTransition(() => {
        setExperience(data);
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <div className="app-shell">
      <div className="backdrop-glow" aria-hidden="true" />
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Roast / DeathVoice</p>
          <h1>Run your own funeral before the internet does it for you.</h1>
          <p className="hero-text">
            Firecrawl pulls the public receipts. ElevenLabs gives the mourners a
            voice. You get a wake where your mom, ex, boss, and best friend all
            deliver the version of you that your timeline accidentally wrote.
          </p>
          <div className="hero-notes">
            <span>4 mourners</span>
            <span>real public quotes</span>
            <span>live-agent ready</span>
          </div>
        </div>

        <div className="hero-statement panel">
          <p className="statement-label">The Hook</p>
          <p className="statement-body">
            A theatrical funeral generated from your public digital footprint,
            performed by AI voices with just enough tenderness to make the roast
            worse.
          </p>
          <p className="statement-footer">
            Only use your own public profiles, or profiles you have explicit
            permission to roast.
          </p>
        </div>
      </header>

      <main className="main-grid">
        <section className="panel control-panel">
          <FuneralForm
            form={form}
            loading={loading}
            onSubmit={handleSubmit}
            onChange={updateField}
          />
          {error ? <p className="error-copy">{error}</p> : null}
          <div className="stacked-note">
            <p className="stacked-note-title">Demo flow</p>
            <p>
              Leave keys empty and switch on demo mode to dogfood the whole UI
              with synthetic receipts. Plug in Firecrawl and ElevenLabs later to
              turn it into the real thing.
            </p>
          </div>
        </section>

        <section className="experience-column">
          <FuneralStage
            experience={experience}
            loading={loading}
            loadingLine={loadingLines[loadingIndex]}
          />
          <AgentWakePanel experience={experience} />
        </section>
      </main>
    </div>
  );
}
