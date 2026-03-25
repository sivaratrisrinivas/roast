import { startTransition, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FuneralForm } from './components/FuneralForm.jsx';
import { FuneralStage } from './components/FuneralStage.jsx';
import chapelBgSrc from './assets/dark_chapel_bg.png';

const initialForm = { profileInput: '' };

const whisperLines = [
  'Pulling the public version of you off the internet...',
  'Sifting through dead links and forgotten posts...',
  'Extracting the digital receipts...',
  'Drafting the final eulogy...',
  'Summoning the mourners...',
  'Dimming the lights...',
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

function ConjuringScreen({ lineIndex }) {
  return (
    <motion.div
      className="conjuring-wrapper"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={lineIndex}
          className="conjuring-log"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          {whisperLines[lineIndex % whisperLines.length]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [experience, setExperience] = useState(null);
  const [screen, setScreen] = useState('summon'); // 'summon', 'conjuring', 'funeral'
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (screen !== 'conjuring') return undefined;

    const timer = setInterval(() => {
      setLineIndex((i) => i + 1);
    }, 3500); // Slow, meditative pacing

    return () => clearInterval(timer);
  }, [screen]);

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
      console.log('[ROAST] Funeral payload received', {
        requestId: data.requestId,
        type: data.type || data.mode || 'unknown',
        subjectName: data.subjectName,
        scriptSpeakers: Array.isArray(data.script)
          ? data.script.map((segment) => ({
              id: segment.id,
              speaker: segment.speaker,
              label: segment.label,
            }))
          : [],
        hasAgentConversation: Boolean(data.agentConversation),
        liveAgent: data.liveAgent,
      });
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

  function updateField(value) {
    setForm({ profileInput: value });
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
                value={form.profileInput}
                onSubmit={handleSubmit}
                onChange={updateField}
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
              <FuneralStage experience={experience} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
