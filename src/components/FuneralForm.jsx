import logoSrc from '../assets/logo.png';

export function FuneralForm({ value, loading, error, onSubmit, onChange }) {
  return (
    <section className="screen screen-card summon-screen screen-enter">
      <img src={logoSrc} alt="ROAST" className="hero-logo" />
      <h1 className="app-title">ROAST</h1>
      <p className="tagline">Paste a public profile. We'll write the eulogy.</p>

      <form className="summon-form" onSubmit={onSubmit}>
        <input
          className="profile-input"
          type="text"
          value={value}
          placeholder="github.com/handle, x.com/handle, any URL…"
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <button
          className="primary-action"
          type="submit"
          disabled={loading || !value.trim()}
        >
          Summon the Funeral
        </button>
      </form>

      {error ? <p className="error-copy">{error}</p> : null}
    </section>
  );
}
