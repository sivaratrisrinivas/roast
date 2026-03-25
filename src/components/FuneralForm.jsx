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
