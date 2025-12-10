export default function VideoPreview({
  videoSources,
  activeSource,
  onSourceSelect,
  currentTime,
  videoRefs,
  onTimeUpdate,
  onLoadedMetadata,
  onVideoUpload,
  showAllViews = false,
  allVideosUploaded = false,
  scoreboard = null
}) {
  // Show all 4 views if:
  // 1. Event is marked (showAllViews is true), OR
  // 2. Not all videos are uploaded yet (need to show upload slots)
  // Otherwise, show only 2 views (left and right) after upload
  const shouldShowAllViews = showAllViews || !allVideosUploaded;

  const leftSources = shouldShowAllViews
    ? [
        { id: 'left', label: 'Left Half', src: videoSources?.left },
        { id: 'left_zoom', label: 'Left Zoom', src: videoSources?.left_zoom },
      ]
    : [
        { id: 'left', label: 'Left Half', src: videoSources?.left },
      ];

  const rightSources = shouldShowAllViews
    ? [
        { id: 'right', label: 'Right Half', src: videoSources?.right },
        { id: 'right_zoom', label: 'Right Zoom', src: videoSources?.right_zoom },
      ]
    : [
        { id: 'right', label: 'Right Half', src: videoSources?.right },
      ];

  const handleCardClick = (source) => {
    if (source.src) {
      // If video exists, just select it
      onSourceSelect(source.id);
    } else {
      // If no video, trigger file upload
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          onVideoUpload(source.id, file);
        }
      };
      input.click();
    }
  };

  const handleRemoveVideo = (sourceId, e) => {
    e.stopPropagation();
    onVideoUpload(sourceId, null);
  };

  const renderVideoCard = (source) => (
    <div
      key={source.id}
      style={{
        ...styles.videoCard,
        ...(activeSource === source.id && source.src ? styles.activeCard : {}),
        ...(!source.src ? styles.emptyCard : {}),
      }}
      onClick={() => handleCardClick(source)}
    >
      {source.src && (
        <>
          {scoreboard && (
            <div style={styles.scoreboardOverlay}>
              <div style={styles.scoreboardRow}>
                <span style={styles.scoreboardTeam}>{scoreboard.teamAName}</span>
                <span style={styles.scoreboardScore}>{`${scoreboard.scoreA} - ${scoreboard.scoreB}`}</span>
                <span style={styles.scoreboardTeam}>{scoreboard.teamBName}</span>
              </div>
            </div>
          )}
        <button
          style={styles.removeButton}
          onClick={(e) => handleRemoveVideo(source.id, e)}
          title="Remove video"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        </>
      )}
      <div style={styles.videoWrapper}>
        {source.src ? (
          <video
            ref={(el) => (videoRefs.current[source.id] = el)}
            src={source.src}
            style={styles.video}
            muted
            playsInline
            preload="metadata"
            onTimeUpdate={() => onTimeUpdate(source.id)}
            onLoadedMetadata={() => onLoadedMetadata(source.id)}
            onLoadedData={() => {
              // Force video to seek to first frame to decode properly
              const video = videoRefs.current[source.id];
              if (video && video.currentTime === 0) {
                video.currentTime = 0.1;
              }
            }}
            onError={(e) => {
              console.error(`Failed to load video ${source.id}:`, e.target.error);
              const errorMessage = e.target.error
                ? `Error loading ${source.label}: ${e.target.error.message}`
                : `Failed to load ${source.label}`;
              alert(errorMessage);
            }}
          />
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.uploadIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M24 14V34M24 14L18 20M24 14L30 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 34V38C10 40 11 42 14 42H34C37 42 38 40 38 38V34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={styles.placeholderText}>Click to upload video</span>
          </div>
        )}
      </div>
      <div style={styles.label}>
        {source.label}
        {activeSource === source.id && (
          <span style={styles.activeBadge}>ACTIVE</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        <div style={styles.column}>
          {leftSources.map(renderVideoCard)}
        </div>
        <div style={styles.column}>
          {rightSources.map(renderVideoCard)}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    marginBottom: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  videoCard: {
    position: 'relative',
    background: '#1a1a1a',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '2px solid #2a2a2a',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  activeCard: {
    border: '2px solid #3b8bff',
    boxShadow: '0 0 20px rgba(59, 139, 255, 0.2)',
  },
  emptyCard: {
    border: '2px dashed #2a2a2a',
    background: '#0f0f0f',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    height: '280px',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    gap: '12px',
  },
  uploadIcon: {
    color: '#555',
  },
  placeholderText: {
    fontSize: '14px',
    color: '#777',
  },
  label: {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: '500',
    background: '#141414',
  },
  activeBadge: {
    padding: '3px 8px',
    background: '#3b8bff',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  removeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(220, 38, 38, 0.9)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    zIndex: 10,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  scoreboardOverlay: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    background: 'rgba(0, 0, 0, 0.65)',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f5f5f5',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 5,
  },
  scoreboardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  scoreboardTeam: {
    whiteSpace: 'nowrap',
  },
  scoreboardScore: {
    padding: '4px 8px',
    background: '#1f2937',
    borderRadius: '4px',
    fontVariantNumeric: 'tabular-nums',
  },
};
