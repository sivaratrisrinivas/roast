import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function FuneralForm({
  form,
  loading,
  error,
  onSubmit,
  onChange,
  ambientReady,
  onEnableSound,
}) {
  const isReady = form.profileInput.trim().length > 3 && !loading;
  const [showGeminiKey, setShowGeminiKey] = useState(
    Boolean(form.geminiApiKey?.trim()),
  );

  useEffect(() => {
    if (form.geminiApiKey?.trim()) {
      setShowGeminiKey(true);
    }
  }, [form.geminiApiKey]);

  return (
    <div className="summon-wrapper">
      <motion.div
        className="summon-minimal"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      >
        <h1 className="cinematic-title">ROAST</h1>
        <p className="summon-tagline">
          A short funeral for your public internet self.
        </p>

        <form className="clean-form" onSubmit={onSubmit}>
          <label className="field-stack">
            <span className="field-label">Website or GitHub</span>
            <input
              className="summon-input"
              type="text"
              value={form.profileInput}
              placeholder="https://your-site.com or https://github.com/you"
              onChange={(event) => onChange('profileInput', event.target.value)}
              autoFocus
              disabled={loading}
              required
            />
          </label>

          <details
            className="optional-panel"
            open={showGeminiKey}
            onToggle={(event) => setShowGeminiKey(event.currentTarget.open)}
          >
            <summary className="optional-toggle">
              <span className="field-label">Optional</span>
              <span className="optional-toggle-copy">
                Use your own Gemini key for trailer video
              </span>
            </summary>

            <div className="optional-body">
              <label className="field-stack">
                <span className="field-label">Personal Gemini API Key</span>
                <input
                  className="summon-input"
                  type="password"
                  value={form.geminiApiKey}
                  placeholder="AIza..."
                  onChange={(event) => onChange('geminiApiKey', event.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  disabled={loading}
                />
              </label>
              <p className="optional-note">
                If you add your own key, trailer video generation uses your credits
                and can start rendering during the service. It is only kept in
                memory for that trailer job and is never shown back in the UI.
              </p>
            </div>
          </details>

          <div className="summon-actions">
            <div className="summon-audio-rail">
              <button
                type="button"
                className={`sound-toggle${ambientReady ? ' sound-toggle-active' : ''}`}
                onClick={onEnableSound}
                disabled={loading}
              >
                {ambientReady ? 'Score On' : 'Enable Score'}
              </button>
              <p className="micro-text">
                {ambientReady
                  ? 'Cinematic bed is live.'
                  : 'Most browsers wait for one tap before audio begins.'}
              </p>
            </div>

            <AnimatePresence>
              {isReady && (
                <motion.button
                  key="submit-btn"
                  className="summon-button"
                  type="submit"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  disabled={loading}
                >
                  Prepare the Service
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            className="micro-text"
            style={{ color: '#ff6b6b' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
