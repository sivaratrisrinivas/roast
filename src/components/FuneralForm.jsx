import { motion, AnimatePresence } from 'framer-motion';

export function FuneralForm({ value, loading, error, onSubmit, onChange }) {
  const isReady = value.trim().length > 3 && !loading;

  return (
    <div className="summon-wrapper">
      <motion.h1 
        className="cinematic-title"
        initial={{ opacity: 0, y: 10, letterSpacing: '0.2em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.05em' }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        ROAST
      </motion.h1>

      <form className="summon-wrapper" onSubmit={onSubmit}>
        <motion.div 
          className="summon-input-wrapper"
          initial={{ opacity: 0, width: '0%' }}
          animate={{ opacity: 1, width: '100%' }}
          transition={{ duration: 1.5, delay: 0.5, ease: 'easeInOut' }}
        >
          <input
            className="summon-input"
            type="text"
            value={value}
            placeholder="Summon using a public URL or handle..."
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            disabled={loading}
          />
        </motion.div>

        <AnimatePresence>
          {isReady && (
            <motion.button
              key="submit-btn"
              className="summon-button"
              type="submit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              disabled={loading}
            >
              Summon the Funeral
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      <AnimatePresence>
        {error && (
          <motion.p 
            className="micro-text"
            style={{ color: '#ff4d4d', marginTop: '1rem' }}
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
