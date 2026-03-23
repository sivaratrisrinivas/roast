function formatSpeakerMeta(segment) {
  if (segment.mood) {
    return `${segment.label} / ${segment.mood}`;
  }

  return segment.label;
}

function buildTimelineStyle(segment, totalDuration) {
  const width = Math.max(
    ((segment.endTimeSeconds - segment.startTimeSeconds) / totalDuration) * 100,
    8,
  );
  const left = (segment.startTimeSeconds / totalDuration) * 100;

  return {
    width: `${width}%`,
    left: `${left}%`,
  };
}

function EmptyState() {
  return (
    <div className="panel stage-shell empty-stage">
      <div className="casket-graphic" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="section-label">Preview</p>
      <h2>The service has not started yet.</h2>
      <p>
        When you submit a profile, this stage turns into a live memorial with
        receipts, scripted mourners, and optional ElevenLabs audio.
      </p>
    </div>
  );
}

function LoadingState({ line }) {
  return (
    <div className="panel stage-shell loading-stage">
      <div className="pulse-ring" aria-hidden="true" />
      <p className="section-label">Preparing The Chapel</p>
      <h2>{line}</h2>
      <p>
        The app is resolving public profiles, shaping the roast, and assigning
        each mourner a voice.
      </p>
    </div>
  );
}

export function FuneralStage({ experience, loading, loadingLine }) {
  if (loading) {
    return <LoadingState line={loadingLine} />;
  }

  if (!experience) {
    return <EmptyState />;
  }

  const audioSrc = experience.audio?.base64
    ? `data:${experience.audio.mimeType};base64,${experience.audio.base64}`
    : '';

  const totalDuration =
    experience.audio?.segments?.reduce(
      (largest, segment) =>
        Math.max(largest, Number(segment.endTimeSeconds || 0)),
      0,
    ) || 0;

  return (
    <section className="panel stage-shell">
      <div className="stage-header">
        <div>
          <p className="section-label">
            {experience.mode === 'demo' ? 'Synthetic Wake' : 'Live Public Wake'}
          </p>
          <h2>{experience.subjectName}</h2>
          <p className="lede">{experience.summary}</p>
        </div>

        <div className="headstone-stats">
          <span>{experience.profiles.length} profile sources</span>
          <span>{experience.script.length} speaking parts</span>
          <span>{experience.audio ? 'audio ready' : 'script only'}</span>
        </div>
      </div>

      {experience.audio ? (
        <div className="audio-block">
          <audio controls className="audio-player" src={audioSrc} />
          {experience.audio?.segments?.length && totalDuration ? (
            <div className="timeline" aria-hidden="true">
              {experience.audio.segments.map((segment) => (
                <span
                  className={`timeline-segment tone-${segment.speaker}`}
                  key={`${segment.speaker}-${segment.dialogueInputIndex}`}
                  style={buildTimelineStyle(segment, totalDuration)}
                  title={`${segment.label} (${segment.startTimeSeconds}s - ${segment.endTimeSeconds}s)`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="stacked-note script-only-note">
          <p className="stacked-note-title">Script ready, audio skipped</p>
          <p>
            The funeral copy is staged below. Add ElevenLabs credentials or
            disable the skip toggle when you want the voices rendered.
          </p>
        </div>
      )}

      <div className="profile-list">
        {experience.profiles.map((profile) => (
          <a
            className="profile-pill"
            href={profile.url}
            key={`${profile.platform}-${profile.url}`}
            target="_blank"
            rel="noreferrer"
          >
            <span>{profile.platform}</span>
            <strong>{profile.display}</strong>
          </a>
        ))}
      </div>

      <div className="mourner-grid">
        {experience.script.map((segment) => (
          <article className={`mourner-card tone-${segment.speaker}`} key={segment.id}>
            <p className="mourner-label">{formatSpeakerMeta(segment)}</p>
            <p className="mourner-text">{segment.text}</p>
            {segment.citations?.length ? (
              <div className="citation-list">
                {segment.citations.map((citation, index) => (
                  <a
                    href={citation.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={`${segment.id}-${index}`}
                  >
                    “{citation.quote}”
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="receipts-grid">
        {experience.receipts.map((receipt, index) => (
          <article className="receipt-card" key={`${receipt.platform}-${index}`}>
            <p className="receipt-platform">{receipt.platform}</p>
            <h3>{receipt.heading}</h3>
            <p>{receipt.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
