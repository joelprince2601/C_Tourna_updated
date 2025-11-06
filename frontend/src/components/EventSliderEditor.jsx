import { useState, useEffect } from 'react';

const EventSliderEditor = ({ 
  event, 
  onUpdateEvent, 
  onDeleteEvent, 
  onPreviewEvent,
  onGenerateEvent,
  leftVideoRef,
  rightVideoRef,
  leftVideoSrc,
  rightVideoSrc,
  isGenerating = false
}) => {
  const [leftStart, setLeftStart] = useState(event.leftRange[0]);
  const [leftEnd, setLeftEnd] = useState(event.leftRange[1]);
  const [rightStart, setRightStart] = useState(event.rightRange[0]);
  const [rightEnd, setRightEnd] = useState(event.rightRange[1]);
  const [view, setView] = useState('total'); // Always use total view for switch mode interface
  const [eventType, setEventType] = useState(event.eventType || 'goal_a');
  // Initialize views with calculated durations from time ranges
  const getInitialViews = () => {
    if (event.views && event.views.length > 0) {
      return event.views;
    }
    const leftDuration = event.leftRange[1] - event.leftRange[0];
    const rightDuration = event.rightRange[1] - event.rightRange[0];
    const totalDuration = leftDuration + rightDuration;
    
    // Create a default switch sequence (split removed)
    return [
      { type: 'left', duration: Math.round(totalDuration * 0.5), order: 1 },
      { type: 'right', duration: Math.round(totalDuration * 0.5), order: 2 }
    ];
  };
  
  const [views, setViews] = useState(getInitialViews());

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateEvent = () => {
    onUpdateEvent({
      ...event,
      leftRange: [leftStart, leftEnd],
      rightRange: [rightStart, rightEnd],
      view,
      views,
      eventType
    });
  };

  useEffect(() => {
    updateEvent();
  }, [leftStart, leftEnd, rightStart, rightEnd, view, views]);

  // Auto-sync right video start when left video end changes
  useEffect(() => {
    if (view === 'total') {
      setRightStart(leftEnd);
    }
  }, [leftEnd, view]);

  // Auto-populate view sequence durations when switching to total review (only once)
  useEffect(() => {
    if (view === 'total') {
      const leftDuration = leftEnd - leftStart;
      const rightDuration = rightEnd - rightStart;
      
      // Only initialize views if they don't exist or are empty
      if (views.length === 0 || !views.some(v => v.type === 'left') || !views.some(v => v.type === 'right')) {
        setViews([
          { type: 'left', duration: Math.round(leftDuration), order: 1 },
          { type: 'right', duration: Math.round(rightDuration), order: 2 }
        ]);
      }
    }
  }, [view]); // Only trigger when view changes, not when ranges change

  const handlePreview = () => {
    onPreviewEvent(event);
  };

  const handleDelete = () => {
    onDeleteEvent(event.eventId);
  };

  const setViewType = (newView) => {
    setView(newView);
  };

  const addView = () => {
    // Determine the type based on existing views (alternate between left and right)
    const leftCount = views.filter(v => v.type === 'left').length;
    const rightCount = views.filter(v => v.type === 'right').length;
    
    let newType = 'left';
    if (leftCount > rightCount) {
      newType = 'right';
    }
    
    // Use a reasonable default duration (5 seconds)
    const newView = {
      type: newType,
      duration: 5,
      order: Math.max(...views.map(v => v.order), 0) + 1
    };
    const newViews = [...views, newView];
    setViews(newViews);
    
    // Manually update video ranges based on new view sequence
    updateVideoRanges(newViews);
  };

  const deleteView = (index) => {
    if (views.length > 1) {
      const newViews = views.filter((_, i) => i !== index);
      setViews(newViews);
      
      // Manually update video ranges based on new view sequence
      updateVideoRanges(newViews);
    }
  };

  const updateView = (index, field, value) => {
    const newViews = views.map((v, i) => 
      i === index ? { ...v, [field]: value } : v
    );
    setViews(newViews);
    
    // Manually update video ranges when duration changes
    if (field === 'duration') {
      updateVideoRanges(newViews);
    }
  };

  const updateVideoRanges = (newViews) => {
    if (view === 'total' && newViews.length > 0) {
      // Calculate total duration from all views
      const totalDuration = newViews.reduce((sum, viewItem) => sum + viewItem.duration, 0);
      
      // Calculate how much of the total duration uses left/right videos
      // by checking which segments use which view type
      let leftEndTime = leftStart;
      let rightStartTime = leftStart;
      let rightEndTime = leftStart;
      
      // Calculate cumulative positions
      let cumulativeTime = 0;
      for (const viewItem of newViews) {
        if (viewItem.type === 'left') {
          // Only left video is used in this segment
          leftEndTime = leftStart + cumulativeTime + viewItem.duration;
          rightStartTime = leftEndTime;
          rightEndTime = leftEndTime;
          cumulativeTime += viewItem.duration;
        } else if (viewItem.type === 'right') {
          // Only right video is used in this segment
          // Left video doesn't extend here
          if (leftEndTime === leftStart) {
            leftEndTime = leftStart;
          }
          rightStartTime = leftEndTime;
          rightEndTime = rightStartTime + viewItem.duration;
          cumulativeTime += viewItem.duration;
        }
      }
      
      setLeftEnd(leftEndTime);
      setRightStart(rightStartTime);
      setRightEnd(rightEndTime);
    }
  };

  // Calculate the start time for a specific segment based on cumulative duration
  const getSegmentStartTime = (segmentIndex) => {
    let cumulativeTime = event.timestamp;
    for (let i = 0; i < segmentIndex; i++) {
      cumulativeTime += views[i].duration;
    }
    return cumulativeTime;
  };

  // Calculate the end time for a specific segment based on cumulative duration
  const getSegmentEndTime = (segmentIndex) => {
    const startTime = getSegmentStartTime(segmentIndex);
    return startTime + views[segmentIndex].duration;
  };

  // Handle video preview click - play from segment start to end then pause
  const handlePreviewClick = (videoElement, segmentIndex) => {
    if (!videoElement) return;
    
    const segmentStartTime = getSegmentStartTime(segmentIndex);
    const segmentEndTime = getSegmentEndTime(segmentIndex);
    
    // Set current time to start of segment
    videoElement.currentTime = segmentStartTime;
    
    // Play the video
    videoElement.play().catch(console.error);
    
    // Set up interval to check if we've reached the end
    const checkInterval = setInterval(() => {
      if (videoElement.currentTime >= segmentEndTime) {
        videoElement.pause();
        videoElement.currentTime = segmentEndTime;
        clearInterval(checkInterval);
      }
    }, 100); // Check every 100ms
    
    // Also listen for timeupdate to be more precise
    const handleTimeUpdate = () => {
      if (videoElement.currentTime >= segmentEndTime) {
        videoElement.pause();
        videoElement.currentTime = segmentEndTime;
        videoElement.removeEventListener('timeupdate', handleTimeUpdate);
        clearInterval(checkInterval);
      }
    };
    
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
  };


  return (
    <div style={{
      backgroundColor: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h4 style={{ color: '#ffffff', margin: 0 }}>
          Event {event.eventId} - {formatTime(event.timestamp)}
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handlePreview}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🎬 Preview
          </button>
          <button
            onClick={handleDelete}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>


      {/* Event Type Selector */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '0.5rem', display: 'block' }}>
          Event Type:
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setEventType('goal_a')}
            style={{
              backgroundColor: eventType === 'goal_a' ? '#dc2626' : '#374151',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            ⚽ Team A Goal
          </button>
          <button
            onClick={() => setEventType('goal_b')}
            style={{
              backgroundColor: eventType === 'goal_b' ? '#2563eb' : '#374151',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            ⚽ Team B Goal
          </button>
          <button
            onClick={() => setEventType('switch')}
            style={{
              backgroundColor: eventType === 'switch' ? '#10b981' : '#374151',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            🔄 Switch
          </button>
          <button
            onClick={() => setEventType('highlight')}
            style={{
              backgroundColor: eventType === 'highlight' ? '#f59e0b' : '#374151',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            ⭐ Highlight
          </button>
        </div>
        <div style={{ color: '#10b981', fontSize: '12px', marginTop: '0.5rem' }}>
          💡 Select which team scored or choose other event type
        </div>
      </div>


      {/* Switch Mode Interface with Dynamic Camera Previews */}
      <div style={{ marginTop: '0.75rem', backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ color: '#9ca3af' }}>Total Duration (s):</label>
          <input type="number" min="1" value={Math.round(leftEnd - leftStart + rightEnd - rightStart)}
                 onChange={(e) => {
                   const totalDuration = Number(e.target.value) || 1;
                   const leftDuration = leftEnd - leftStart;
                   const rightDuration = rightEnd - rightStart;
                   const currentTotal = leftDuration + rightDuration;
                   
                   if (currentTotal > 0) {
                     const ratio = totalDuration / currentTotal;
                     const newLeftEnd = leftStart + (leftDuration * ratio);
                     const newRightStart = newLeftEnd;
                     const newRightEnd = newRightStart + (rightDuration * ratio);
                     setLeftEnd(newLeftEnd);
                     setRightStart(newRightStart);
                     setRightEnd(newRightEnd);
                   }
                 }}
                 className="file-input" style={{ width: '100px' }} />
        </div>
        
        <div style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>Switch Segments (view until cumulative second):</div>
        {views.map((seg, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 200px', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <select value={seg.type} onChange={(e) => {
              const v = e.target.value;
              updateView(idx, 'type', v);
            }} className="file-input">
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
            <div style={{ color: '#9ca3af' }}>till</div>
            <input type="number" min="0" value={seg.duration}
                   onChange={(e) => {
                     const v = Number(e.target.value) || 0;
                     updateView(idx, 'duration', v);
                   }} className="file-input" />
            
            {/* Dynamic Camera Preview based on selection */}
            <div style={{ 
                width: '100%',
              height: '60px', 
              backgroundColor: '#000', 
                borderRadius: '4px',
            display: 'flex', 
            alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #374151',
              position: 'relative',
              cursor: 'pointer'
            }}>
              {seg.type === 'left' && leftVideoSrc ? (
                <video
                  src={leftVideoSrc}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  muted
                  playsInline
                  onLoadedMetadata={(e) => {
                    const segmentStartTime = getSegmentStartTime(idx);
                    e.target.currentTime = segmentStartTime;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewClick(e.target, idx);
                  }}
                />
              ) : seg.type === 'right' && rightVideoSrc ? (
                <video
                  src={rightVideoSrc}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  muted
                  playsInline
                  onLoadedMetadata={(e) => {
                    const segmentStartTime = getSegmentStartTime(idx);
                    e.target.currentTime = segmentStartTime;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewClick(e.target, idx);
                  }}
                />
              ) : (
                <span style={{ color: '#6b7280', fontSize: '10px' }}>No video</span>
              )}
              <div style={{ 
                position: 'absolute', 
                top: '2px', 
                left: '2px', 
                backgroundColor: 'rgba(0,0,0,0.7)', 
                color: 'white', 
                padding: '2px 4px', 
                borderRadius: '2px', 
                fontSize: '10px' 
              }}>
                {seg.type}
              </div>
              <div style={{ 
                position: 'absolute', 
                top: '2px', 
                right: '2px', 
                backgroundColor: 'rgba(0,0,0,0.7)', 
                color: '#10b981', 
                padding: '2px 4px', 
                borderRadius: '2px', 
                fontSize: '9px',
                fontWeight: 'bold'
              }}>
                ▶️ Click to play
              </div>
            </div>
            
            <button onClick={() => deleteView(idx)}
                    className="btn" style={{ backgroundColor: '#7f1d1d', color: 'white', gridColumn: '1 / span 4' }}>Remove</button>
              </div>
            ))}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => addView()}
                  className="btn" style={{ backgroundColor: '#374151', color: 'white' }}>+ Add Segment</button>
          <button onClick={() => {
            setViews([
              { type: 'left', duration: 5, order: 1 },
              { type: 'right', duration: 5, order: 2 }
            ]);
          }}
                  className="btn" style={{ backgroundColor: '#374151', color: 'white' }}>Reset Example</button>
        </div>

        {/* Individual Event Generation Button */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #374151' }}>
          <button
            onClick={() => {
              if (onGenerateEvent && !isGenerating) {
                onGenerateEvent(event);
              }
            }}
            disabled={isGenerating}
            className="btn btn-success"
            style={{
              backgroundColor: isGenerating ? '#4b5563' : '#059669',
              color: 'white',
              fontSize: '14px',
              padding: '0.75rem 1.5rem',
              width: '100%',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.7 : 1
            }}
          >
            {isGenerating ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <svg className="spinner" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                  <circle
                    className="spinner-circle"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="spinner-path"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating Clip...
              </span>
            ) : (
              '🎬 Generate This Event Clip'
            )}
          </button>
          <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '0.5rem', textAlign: 'center' }}>
            {isGenerating ? 'Please wait while your clip is being generated...' : 'Generate a clip for this specific event'}
          </div>
        </div>
      </div>

      {/* Duration Info */}
      <div style={{
        backgroundColor: '#111827',
        padding: '0.5rem',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        <div>Left Duration: {formatTime(leftEnd - leftStart)}</div>
        <div>Right Duration: {formatTime(rightEnd - rightStart)}</div>
        <div>Total Duration: {formatTime((leftEnd - leftStart) + (rightEnd - rightStart))}</div>
        <div>Switch Segments: {views.map(v => `${v.type} (${v.duration}s)`).join(' → ')} ({views.length} segments)</div>
          <div style={{ color: '#10b981', marginTop: '0.25rem' }}>
          💡 Video ranges auto-adjust when you modify segments
          </div>
          <div style={{ color: '#f59e0b', marginTop: '0.25rem', fontSize: '11px' }}>
            📊 Left: {formatTime(leftStart)}-{formatTime(leftEnd)} | Right: {formatTime(rightStart)}-{formatTime(rightEnd)}
          </div>
      </div>
    </div>
  );
};

export default EventSliderEditor;
