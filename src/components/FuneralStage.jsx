import { useEffect, useRef, useState } from 'react';

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

export function FuneralStage({ experience }) {
  const [started, setStarted] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioRef = useRef(null);
  const hasAudio = Boolean(experience.audio?.base64);
  const audioSrc = experience.audio?.base64
    ? `data:${experience.audio.mimeType};base64,${experience.audio.base64}`
    : '';

  const totalDuration =
    experience.audio?.segments?.reduce(
      (largest, segment) =>
        Math.max(largest, Number(segment.endTimeSeconds || 0)),
      0,
    ) || 0;

  useEffect(() => {
    if (!started || !hasAudio || !audioRef.current) {
      return;
    }

    audioRef.current.play().catch(() => {
      setAudioError('Press play in the audio bar if your browser blocks autoplay.');
    });
  }, [started, hasAudio]);

  return (
    <section className="screen screen-card result-screen">
      <p className="brand-mark">ROAST</p>
      <p className="result-kicker">
        {experience.mode === 'demo' ? 'DEMO SERVICE READY' : 'SERVICE READY'}
      </p>
      <h2 className="result-name">{experience.subjectName}</h2>
      <p className="result-summary">{experience.summary}</p>

      {!started ? (
        <>
          <div className="receipts-list">
            {experience.receipts.slice(0, 3).map((receipt, index) => (
              <article className="receipt-chip" key={`${receipt.heading}-${index}`}>
                <span>{receipt.heading}</span>
                <p>{receipt.detail}</p>
              </article>
            ))}
          </div>

          <button
            className="primary-action"
            type="button"
            onClick={() => setStarted(true)}
          >
            {hasAudio ? 'Play ROAST' : 'Open ROAST'}
          </button>
        </>
      ) : (
        <>
          {hasAudio ? (
            <div className="audio-shell">
              <audio ref={audioRef} controls className="audio-player" src={audioSrc} />
              {experience.audio?.segments?.length && totalDuration ? (
                <div className="timeline" aria-hidden="true">
                  {experience.audio.segments.map((segment) => (
                    <span
                      className={`timeline-segment tone-${segment.speaker}`}
                      key={`${segment.speaker}-${segment.dialogueInputIndex}`}
                      style={buildTimelineStyle(segment, totalDuration)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="micro-note">
              Audio is not configured yet. The written ROAST is below.
            </p>
          )}

          {audioError ? <p className="error-copy">{audioError}</p> : null}

          <div className="script-list">
            {experience.script.map((segment) => (
              <article className={`script-card tone-${segment.speaker}`} key={segment.id}>
                <p className="script-label">{segment.label}</p>
                <p className="script-text">{segment.text}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
