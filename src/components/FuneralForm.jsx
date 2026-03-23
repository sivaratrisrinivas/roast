export function FuneralForm({ value, loading, error, onSubmit, onChange }) {
  return (
    <section className="screen screen-card capture-screen">
      <p className="brand-mark">ROAST</p>
      <h2 className="screen-title">Paste one public profile.</h2>
      <p className="screen-copy">
        Use a public profile URL or type an X handle.
      </p>

      <form className="single-input-form" onSubmit={onSubmit}>
        <input
          className="profile-input"
          type="text"
          value={value}
          placeholder="@handle or linkedin.com/in/name"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="primary-action"
          type="submit"
          disabled={loading || !value.trim()}
        >
          Generate ROAST
        </button>
      </form>

      <p className="micro-note">
        Examples: `@name`, `https://x.com/name`, `linkedin.com/in/name`,
        `instagram.com/name`
      </p>

      {error ? <p className="error-copy">{error}</p> : null}
    </section>
  );
}
