const fieldConfig = [
  {
    name: 'displayName',
    label: 'Name on the headstone',
    placeholder: 'Srinivas, The Guy Who Posted Through It',
  },
  {
    name: 'xHandle',
    label: 'X handle or URL',
    placeholder: '@example or https://x.com/example',
  },
  {
    name: 'linkedinHandle',
    label: 'LinkedIn handle or URL',
    placeholder: 'janedoe or linkedin.com/in/janedoe',
  },
  {
    name: 'instagramHandle',
    label: 'Instagram handle or URL',
    placeholder: '@example or instagram.com/example',
  },
];

export function FuneralForm({ form, loading, onSubmit, onChange }) {
  return (
    <form className="funeral-form" onSubmit={onSubmit}>
      <div className="section-copy">
        <p className="section-label">Summon The Mourners</p>
        <h2>Point the app at your public life.</h2>
        <p>
          Give it enough surface area for a funeral: X for inner monologue,
          LinkedIn for professional fiction, Instagram for curation crimes.
        </p>
      </div>

      <div className="field-grid">
        {fieldConfig.map((field) => (
          <label className="field" key={field.name}>
            <span>{field.label}</span>
            <input
              type="text"
              value={form[field.name]}
              placeholder={field.placeholder}
              onChange={(event) => onChange(field.name, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="toggle-grid">
        <label className="toggle">
          <input
            type="checkbox"
            checked={form.demoMode}
            onChange={(event) => onChange('demoMode', event.target.checked)}
          />
          <div>
            <strong>Demo mode</strong>
            <span>Use synthetic receipts so the UI works before keys exist.</span>
          </div>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={form.skipAudio}
            onChange={(event) => onChange('skipAudio', event.target.checked)}
          />
          <div>
            <strong>Skip audio generation</strong>
            <span>Useful when wiring the Firecrawl side before ElevenLabs.</span>
          </div>
        </label>
      </div>

      <button className="run-button" type="submit" disabled={loading}>
        {loading ? 'Preparing the service...' : 'Run My Funeral'}
      </button>
    </form>
  );
}
