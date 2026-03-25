import { motion, AnimatePresence } from 'framer-motion';

export function FuneralForm({ form, loading, error, onSubmit, onChange, ambientReady }) {
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
        <p className="micro-text">
          {ambientReady ? 'Ambient score is on.' : 'Sound on. Music begins after your first tap.'}
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
            <p className="micro-text">One public page is enough.</p>

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
