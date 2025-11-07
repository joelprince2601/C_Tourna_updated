const ExportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="4" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    <path d="M11 6.5L14 5V11L11 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 12L8 4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 4L8 12M8 12L12 8M8 12L4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 4H13M5 4V3C5 2.5 5.5 2 6 2H10C10.5 2 11 2.5 11 3V4M6 7V11M10 7V11M4 4H12V13C12 13.5 11.5 14 11 14H5C4.5 14 4 13.5 4 13V4Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 2L14 8L4 14V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
  </svg>
);

export default function ClipsList({ clips, onDeleteClip, onMoveClip, onExport, onPreviewClip, isExporting }) {
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceColor = (source) => {
    const colors = {
      left: '#3b8bff',
      left_zoom: '#8b5cf6',
      right: '#10b981',
      right_zoom: '#f59e0b',
    };
    return colors[source] || '#666';
  };

  const getSourceLabel = (source) => {
    const labels = {
      left: 'Left Half',
      left_zoom: 'Left Zoom',
      right: 'Right Half',
      right_zoom: 'Right Zoom',
    };
    return labels[source] || source;
  };

  const totalDuration = clips.reduce((sum, clip) => sum + (clip.duration || 0), 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Clips Timeline</h2>
          <p style={styles.subtitle}>
            {clips.length} clip{clips.length !== 1 ? 's' : ''} • Total duration: {formatTime(totalDuration)}
          </p>
        </div>
        {clips.length > 0 && (
          <button
            style={{
              ...styles.button,
              ...styles.exportButton,
              ...(isExporting ? styles.exportButtonLoading : {})
            }}
            onClick={onExport}
            disabled={isExporting}
          >
            <ExportIcon />
            {isExporting ? 'Exporting...' : 'Export Highlight Video'}
          </button>
        )}
      </div>

      {clips.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="8" y="16" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <path d="M44 24L56 18V46L44 40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={styles.emptyText}>No clips yet</p>
          <p style={styles.emptySubtext}>
            Mark in and out points, then create a clip to get started
          </p>
        </div>
      ) : (
        <div style={styles.clipsList}>
          {clips.map((clip, index) => (
            <div key={clip.id} style={styles.clipCard}>
              <div style={styles.clipNumber}>{index + 1}</div>

              <div style={styles.clipContent}>
                <div style={styles.clipHeader}>
                  <div style={styles.clipInfo}>
                    <span
                      style={{
                        ...styles.sourceBadge,
                        background: getSourceColor(clip.source),
                      }}
                    >
                      {getSourceLabel(clip.source)}
                    </span>
                    <span style={styles.clipDuration}>
                      {formatTime(clip.duration)}
                    </span>
                    {!clip.backendClipId && (
                      <span style={styles.warningBadge} title="Not synced to backend - won't be exported">
                        ⚠️ Local only
                      </span>
                    )}
                  </div>
                </div>

                <div style={styles.clipTimeline}>
                  <span style={styles.timeLabel}>
                    {formatTime(clip.start)} → {formatTime(clip.end)}
                  </span>
                </div>
              </div>

              <div style={styles.clipActions}>
                <button
                  style={{ ...styles.button, ...styles.previewButton }}
                  onClick={() => onPreviewClip(clip)}
                  title="Preview clip"
                >
                  <PlayIcon />
                </button>
                <button
                  style={{ ...styles.button, ...styles.actionButton }}
                  onClick={() => onMoveClip(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ArrowUpIcon />
                </button>
                <button
                  style={{ ...styles.button, ...styles.actionButton }}
                  onClick={() => onMoveClip(index, 'down')}
                  disabled={index === clips.length - 1}
                  title="Move down"
                >
                  <ArrowDownIcon />
                </button>
                <button
                  style={{ ...styles.button, ...styles.deleteButton }}
                  onClick={() => onDeleteClip(clip.id)}
                  title="Delete clip"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: '#1a1a1a',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #2a2a2a',
    marginTop: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    gap: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  exportButton: {
    background: 'linear-gradient(135deg, #3b8bff, #1760ff)',
    color: 'white',
  },
  exportButtonLoading: {
    background: '#555',
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  buttonIcon: {
    fontSize: '16px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '64px 24px',
    color: '#666',
  },
  emptyIcon: {
    display: 'block',
    marginBottom: '16px',
    opacity: 0.3,
    color: '#666',
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#555',
  },
  clipsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  clipCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    transition: 'all 0.2s ease',
  },
  clipNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    flexShrink: 0,
  },
  clipContent: {
    flex: 1,
    minWidth: 0,
  },
  clipHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  clipInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sourceBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
  },
  clipDuration: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#888',
  },
  warningBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    background: '#f59e0b',
    color: '#000',
  },
  clipTimeline: {
    fontSize: '12px',
    color: '#666',
    fontFamily: 'monospace',
  },
  timeLabel: {
    padding: '4px 8px',
    background: '#1a1a1a',
    borderRadius: '4px',
    display: 'inline-block',
  },
  clipActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  previewButton: {
    background: '#3b8bff',
    color: 'white',
    padding: '8px 12px',
    fontSize: '16px',
  },
  actionButton: {
    background: '#2a2a2a',
    color: '#f5f5f5',
    padding: '8px 12px',
    fontSize: '16px',
  },
  deleteButton: {
    background: '#dc2626',
    color: 'white',
    padding: '8px 12px',
    fontSize: '16px',
  },
};
