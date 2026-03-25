import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FuneralForm } from './components/FuneralForm.jsx';
import { FuneralStage } from './components/FuneralStage.jsx';
import { createAmbientScore } from './lib/ambient-score.js';
import chapelBgSrc from './assets/dark_chapel_bg.png';

const initialForm = {
  profileInput: '',
};

const whisperLines = [
  'Gathering the public record...',
  'Reading the public page...',
  'Writing the eulogy...',
  'Lighting the room...',
];

function buildFuneralPayload(form) {
  return {
    profileInput: form.profileInput.trim(),
    consentConfirmed: true,
  };
}

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

function ConjuringScreen({ lineIndex }) {
  const progressIndex = lineIndex % whisperLines.length;

  return (
    <motion.div
      className="conjuring-wrapper"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <div className="conjuring-shell">
        <div className="conjuring-mark" />
        <p className="micro-text">Preparing the service</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            className="conjuring-log"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          >
            {whisperLines[progressIndex]}
          </motion.p>
        </AnimatePresence>
        <div className="conjuring-progress" aria-hidden="true">
          {whisperLines.map((line, index) => (
            <span
              key={line}
              className={`conjuring-progress-dot${index <= progressIndex ? ' conjuring-progress-dot-active' : ''
                }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [experience, setExperience] = useState(null);
  const [screen, setScreen] = useState('summon'); // 'summon', 'conjuring', 'funeral'
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [ambientReady, setAmbientReady] = useState(false);
  const [funeralAmbientMode, setFuneralAmbientMode] = useState(null);
  const ambientScoreRef = useRef(null);
  const ambientModeRef = useRef('landing');

  const ambientMode = useMemo(() => {
    if (screen === 'funeral' && funeralAmbientMode) {
      return funeralAmbientMode;
    }

    if (screen === 'conjuring') {
      return 'conjuring';
    }

    return 'landing';
  }, [funeralAmbientMode, screen]);

  useEffect(() => {
    ambientModeRef.current = ambientMode;
  }, [ambientMode]);

  async function resumeAmbientScore() {
    const score = ambientScoreRef.current;
    if (!score) {
      return;
    }

    try {
      await score.resume();
      score.setIntensity(ambientModeRef.current);
      setAmbientReady(true);
    } catch (_error) {
      // Browser may still require a user gesture before AudioContext runs.
    }
  }

  useEffect(() => {
    if (screen !== 'conjuring') return undefined;

    const timer = setInterval(() => {
      setLineIndex((i) => i + 1);
    }, 3500); // Slow, meditative pacing

    return () => clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    ambientScoreRef.current = createAmbientScore();

    let cancelled = false;

    async function attemptResume() {
      if (!ambientScoreRef.current || cancelled) {
        return;
      }

      try {
        await ambientScoreRef.current.resume();

        if (cancelled || !ambientScoreRef.current) {
          return;
        }

        setAmbientReady(true);
        ambientScoreRef.current.setIntensity(ambientModeRef.current);
      } catch (_error) {
        // Browser autoplay rules may require a user gesture first.
      }
    }

    function handleUserActivation() {
      attemptResume();
    }

    attemptResume();
    const captureOpts = { capture: true, passive: true };
    window.addEventListener('pointerdown', handleUserActivation, captureOpts);
    window.addEventListener('touchstart', handleUserActivation, captureOpts);
    window.addEventListener('keydown', handleUserActivation, true);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', handleUserActivation, true);
      window.removeEventListener('touchstart', handleUserActivation, true);
      window.removeEventListener('keydown', handleUserActivation, true);
      ambientScoreRef.current?.stop();
      ambientScoreRef.current = null;
      setAmbientReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ambientReady || !ambientScoreRef.current) {
      return;
    }

    ambientScoreRef.current.setIntensity(ambientMode);
  }, [ambientMode, ambientReady]);

  async function handleSubmit(event) {
    event.preventDefault();
    await resumeAmbientScore();
    setScreen('conjuring');
    setError('');
    setExperience(null);
    setLineIndex(0);
    setFuneralAmbientMode(null);

    try {
      const data = await postFuneralRequest(buildFuneralPayload(form));
      // Add artificial delay to guarantee the user feels the weight of the conjuring
      setTimeout(() => {
        startTransition(() => {
          setExperience(data);
          setScreen('funeral');
        });
      }, 2000);
    } catch (submitError) {
      setError(submitError.message);
      setScreen('summon');
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleReturnHome() {
    startTransition(() => {
      setExperience(null);
      setError('');
      setFuneralAmbientMode(null);
      setScreen('summon');
    });
  }

  return (
    <div className="app-container">
      <motion.img
        src={chapelBgSrc}
        className="chapel-bg"
        alt="Dark Chapel"
        initial={{ scale: 1.05 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 20, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
      />
      <div className="ambient-dust" />
      <div className="ambient-vignette" />

      <main className="content-layer">
        <AnimatePresence mode="wait">
          {screen === 'summon' && (
            <motion.div
              key="summon"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 1 }}
              style={{ width: '100%' }}
            >
              <FuneralForm
                ambientReady={ambientReady}
                form={form}
                onSubmit={handleSubmit}
                onChange={updateField}
                onEnableSound={resumeAmbientScore}
                error={error}
                loading={screen === 'conjuring'}
              />
            </motion.div>
          )}

          {screen === 'conjuring' && (
            <ConjuringScreen key="conjuring" lineIndex={lineIndex} />
          )}

          {screen === 'funeral' && experience && (
            <motion.div
              key="funeral"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              style={{ width: '100%' }}
            >
              <FuneralStage
                ambientReady={ambientReady}
                resumeAmbientScore={resumeAmbientScore}
                experience={experience}
                onAmbientModeChange={setFuneralAmbientMode}
                onReturnHome={handleReturnHome}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
