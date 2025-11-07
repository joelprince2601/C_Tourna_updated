const MarkInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 2L3 14M6 5L13 8L6 11L6 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
  </svg>
);

const MarkOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="4" width="10" height="8" stroke="currentColor" strokeWidth="1.5" rx="1" fill="currentColor"/>
  </svg>
);

const ScissorsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <path d="M5 4.5L10 8M5 11.5L10 8M10 8L14 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export default function ClipControls({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  markIn,
  markOut,
  onMarkIn,
  onMarkOut,
  onCreateClip,
  activeSource,
  playbackSpeed,
  onPlaybackSpeedChange,
}) {
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const canCreateClip = markIn !== null && markOut !== null && markOut > markIn;

  const sourceLabels = {
    left: 'Left Half',
    left_zoom: 'Left Zoom',
    right: 'Right Half',
    right_zoom: 'Right Zoom',
  };

  const speedOptions = [0.5, 1, 1.5, 2, 3];

  return (
    <div style={styles.container}>
      {/* Timeline Scrubber */}
      <div style={styles.scrubberContainer}>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime || 0}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          style={styles.scrubber}
        />
        {/* Mark indicators on timeline */}
        {markIn !== null && (
          <div
            style={{
              ...styles.markIndicator,
              left: `${(markIn / (duration || 100)) * 100}%`,
              background: "#4ade80",
            }}
          />
        )}
        {markOut !== null && (
          <div
            style={{
              ...styles.markIndicator,
              left: `${(markOut / (duration || 100)) * 100}%`,
              background: "#f87171",
            }}
          />
        )}
      </div>

      {/* Controls Row */}
      <div style={styles.controlsRow}>
        {/* Left Section: Playback Controls */}
        <div style={styles.section}>
          <button
            style={{ ...styles.button, ...styles.playButton }}
            onClick={onPlayPause}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <div style={styles.timeDisplay}>
            <span style={styles.currentTime}>{formatTime(currentTime)}</span>
            <span style={styles.timeSeparator}>/</span>
            <span style={styles.duration}>{formatTime(duration)}</span>
          </div>

          {/* Speed Selector */}
          <div style={styles.speedControls}>
            {speedOptions.map(speed => (
              <button
                key={speed}
                style={{
                  ...styles.speedButton,
                  ...(playbackSpeed === speed ? styles.speedButtonActive : {})
                }}
                onClick={() => onPlaybackSpeedChange(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Middle Section: Mark In/Out */}
        <div style={styles.section}>
          <button
            style={{ ...styles.button, ...styles.markButton }}
            onClick={onMarkIn}
          >
            <MarkInIcon />
            {markIn !== null && (
              <span style={styles.markTime}>{formatTime(markIn)}</span>
            )}
          </button>
          <button
            style={{ ...styles.button, ...styles.markButton }}
            onClick={onMarkOut}
          >
            <MarkOutIcon />
            {markOut !== null && (
              <span style={styles.markTime}>{formatTime(markOut)}</span>
            )}
          </button>
        </div>

        {/* Right Section: Active Source & Create Clip */}
        <div style={styles.section}>
          <div style={styles.activeSourceDisplay}>
            <span style={styles.activeSourceLabel}>Source:</span>
            <span style={styles.activeSourceName}>{sourceLabels[activeSource] || activeSource}</span>
          </div>
          <button
            style={{
              ...styles.button,
              ...styles.createButton,
              ...(canCreateClip ? {} : styles.buttonDisabled),
            }}
            onClick={onCreateClip}
            disabled={!canCreateClip}
          >
            <ScissorsIcon />
            Create Clip
            {canCreateClip && (
              <span style={styles.clipDuration}>
                ({formatTime(markOut - markIn)})
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#1a1a1a',
    borderTop: '2px solid #2a2a2a',
    padding: '12px 20px',
    zIndex: 1000,
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
  },
  scrubberContainer: {
    position: 'relative',
    width: '100%',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
  },
  scrubber: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: '#2a2a2a',
    appearance: 'none',
    outline: 'none',
    cursor: 'pointer',
  },
  markIndicator: {
    position: 'absolute',
    top: '0',
    width: '3px',
    height: '24px',
    borderRadius: '2px',
    pointerEvents: 'none',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  button: {
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  playButton: {
    background: '#3b8bff',
    color: 'white',
    fontSize: '16px',
    width: '40px',
    height: '40px',
    justifyContent: 'center',
    padding: '0',
  },
  timeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'monospace',
    fontSize: '15px',
  },
  currentTime: {
    color: '#f5f5f5',
    fontWeight: '600',
  },
  timeSeparator: {
    color: '#666',
  },
  duration: {
    color: '#888',
  },
  speedControls: {
    display: 'flex',
    gap: '4px',
    marginLeft: '8px',
  },
  speedButton: {
    padding: '6px 10px',
    background: '#2a2a2a',
    color: '#888',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  speedButtonActive: {
    background: '#3b8bff',
    color: 'white',
  },
  markButton: {
    background: '#2a2a2a',
    color: '#f5f5f5',
  },
  markTime: {
    marginLeft: '4px',
    padding: '2px 6px',
    background: '#1a1a1a',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  activeSourceDisplay: {
    padding: '8px 12px',
    background: '#0a0a0a',
    borderRadius: '6px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  activeSourceLabel: {
    color: '#888',
  },
  activeSourceName: {
    color: '#3b8bff',
    fontWeight: '600',
  },
  createButton: {
    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
    color: 'white',
    fontWeight: '600',
  },
  buttonDisabled: {
    background: '#2a2a2a',
    color: '#666',
    cursor: 'not-allowed',
  },
  clipDuration: {
    marginLeft: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
    opacity: 0.9,
  },
};
