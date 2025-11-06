import { useRef, useEffect, useState } from 'react';

const LivePreview = ({ 
  event, 
  leftVideoRef, 
  rightVideoRef, 
  isPreviewing, 
  onStopPreview,
  onUpdateEvent
}) => {
  const leftPreviewRef = useRef(null);
  const rightPreviewRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [switchPlan, setSwitchPlan] = useState([]);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [totalDuration, setTotalDuration] = useState(10);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    if (!isPreviewing || !event) return;

    const leftVideo = leftVideoRef.current;
    const rightVideo = rightVideoRef.current;
    const leftPreview = leftPreviewRef.current;
    const rightPreview = rightPreviewRef.current;

    if (!leftVideo || !rightVideo) return;

    // Initialize switch plan based on event view
    if (event.view === 'total') {
      // Use the views array from the event to create the switch plan
      const plan = event.views ? event.views.map((viewItem, index) => {
        let cumulativeTime = 0;
        for (let i = 0; i <= index; i++) {
          cumulativeTime += event.views[i].duration;
        }
        return {
          view: viewItem.type,
          till: cumulativeTime
        };
      }) : [
        { view: 'left', till: 5 },
        { view: 'right', till: 10 }
      ];
      
      const totalDuration = plan[plan.length - 1]?.till || 10;
      console.log('Initial switch plan:', plan);
      setSwitchPlan(plan);
      setTotalDuration(totalDuration);
    }

    // Set up preview videos with proper sources and time ranges
    if (leftPreview && leftVideo.src) {
      leftPreview.src = leftVideo.src;
      leftPreview.currentTime = event.leftRange[0];
    }
    
    if (rightPreview && rightVideo.src) {
      rightPreview.src = rightVideo.src;
      rightPreview.currentTime = event.rightRange[0];
    }

    // Auto-play preview
    const playPreview = async () => {
      try {
        if (event.view === 'left' && leftPreview) {
          await leftPreview.play();
        } else if (event.view === 'right' && rightPreview) {
          await rightPreview.play();
        } else if (event.view === 'total' && switchPlan.length > 0) {
          // For total review mode, start with first segment
          setStartTime(Date.now());
          setCurrentSegment(0);
          
          const firstSegment = switchPlan[0];
          if (firstSegment.view === 'left' && leftPreview) {
            await leftPreview.play();
          } else if (firstSegment.view === 'right' && rightPreview) {
            await rightPreview.play();
          }
        }
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing preview:', error);
      }
    };

    playPreview();

    // Set up time update to stop at end of range
    const handleTimeUpdate = () => {
      const currentTime = event.view === 'left' ? 
        (leftPreview?.currentTime || 0) : 
        event.view === 'right' ? 
        (rightPreview?.currentTime || 0) : 
        Math.max(leftPreview?.currentTime || 0, rightPreview?.currentTime || 0);
      
      setCurrentTime(currentTime);

      let shouldStop = false;
      if (event.view === 'left' && leftPreview) {
        shouldStop = leftPreview.currentTime >= event.leftRange[1];
      } else if (event.view === 'right' && rightPreview) {
        shouldStop = rightPreview.currentTime >= event.rightRange[1];
      } else if (event.view === 'total' && switchPlan.length > 0) {
        // For switch mode, use a simpler approach with absolute time tracking
        if (!startTime) {
          setStartTime(Date.now());
          return;
        }
        
        const elapsedTime = (Date.now() - startTime) / 1000; // Convert to seconds
        console.log(`Elapsed time: ${elapsedTime}s, Current segment: ${currentSegment}`);
        
        // Check if we need to switch to next segment
        const currentSegmentData = switchPlan[currentSegment];
        if (currentSegmentData && elapsedTime >= currentSegmentData.till) {
          console.log(`Time to switch! Elapsed: ${elapsedTime}s, Segment till: ${currentSegmentData.till}s`);
          
          const nextSegment = currentSegment + 1;
          if (nextSegment < switchPlan.length) {
            // Switch to next segment
            console.log(`Switching to segment ${nextSegment}`);
            
            if (leftPreview) leftPreview.pause();
            if (rightPreview) rightPreview.pause();
            
            const nextSegmentData = switchPlan[nextSegment];
            const nextVideo = nextSegmentData.view;
            
            console.log(`Next segment view: ${nextVideo}`);
            
            // Set up next video
            if (nextVideo === 'left' && leftPreview) {
              leftPreview.currentTime = event.leftRange[0];
              leftPreview.play();
            } else if (nextVideo === 'right' && rightPreview) {
              rightPreview.currentTime = event.rightRange[0];
              rightPreview.play();
            } else if (nextVideo === 'split') {
              if (leftPreview) {
                leftPreview.currentTime = event.leftRange[0];
                leftPreview.play();
              }
              if (rightPreview) {
                rightPreview.currentTime = event.rightRange[0];
                rightPreview.play();
              }
            }
            
            setCurrentSegment(nextSegment);
          } else {
            shouldStop = true;
          }
        }
      }

      if (shouldStop) {
        if (leftPreview) leftPreview.pause();
        if (rightPreview) rightPreview.pause();
        setIsPlaying(false);
      }
    };

    // Add event listeners
    if (leftPreview) {
      leftPreview.addEventListener('timeupdate', handleTimeUpdate);
    }
    if (rightPreview) {
      rightPreview.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      if (leftPreview) {
        leftPreview.removeEventListener('timeupdate', handleTimeUpdate);
        leftPreview.pause();
      }
      if (rightPreview) {
        rightPreview.removeEventListener('timeupdate', handleTimeUpdate);
        rightPreview.pause();
      }
      setIsPlaying(false);
    };
  }, [isPreviewing, event, leftVideoRef, rightVideoRef]);

  // Handle switch plan changes - restart preview when plan changes
  useEffect(() => {
    if (!isPreviewing || !event || event.view !== 'split' || switchPlan.length === 0) return;

    const leftPreview = leftPreviewRef.current;
    const rightPreview = rightPreviewRef.current;

    if (!leftPreview || !rightPreview) return;

    // Stop current playback
    if (leftPreview) leftPreview.pause();
    if (rightPreview) rightPreview.pause();

    // Reset to first segment
    setCurrentSegment(0);

    // Start with first segment
    const firstSegment = switchPlan[0];
    if (firstSegment) {
      const startVideo = firstSegment.view === 'left' ? leftPreview : rightPreview;
      const startRange = firstSegment.view === 'left' ? event.leftRange : event.rightRange;
      
      if (startVideo) {
        startVideo.currentTime = startRange[0];
        startVideo.play().then(() => {
          setIsPlaying(true);
        }).catch(console.error);
      }
    }
  }, [switchPlan, isPreviewing, event]);

  const handlePlayPause = () => {
    const leftPreview = leftPreviewRef.current;
    const rightPreview = rightPreviewRef.current;

    if (isPlaying) {
      if (leftPreview) leftPreview.pause();
      if (rightPreview) rightPreview.pause();
      setIsPlaying(false);
    } else {
      const playVideos = async () => {
        try {
          if (event.view === 'left' && leftPreview) {
            await leftPreview.play();
          } else if (event.view === 'right' && rightPreview) {
            await rightPreview.play();
          } else if (event.view === 'total' && switchPlan.length > 0) {
            // For total review mode, start with first segment
            setStartTime(Date.now());
            setCurrentSegment(0);
            
            const firstSegment = switchPlan[0];
            if (firstSegment.view === 'left' && leftPreview) {
              await leftPreview.play();
            } else if (firstSegment.view === 'right' && rightPreview) {
              await rightPreview.play();
            }
          }
          setIsPlaying(true);
        } catch (error) {
          console.error('Error playing preview:', error);
        }
      };
      playVideos();
    }
  };


  const handleStop = () => {
    const leftPreview = leftPreviewRef.current;
    const rightPreview = rightPreviewRef.current;
    
    if (leftPreview) leftPreview.pause();
    if (rightPreview) rightPreview.pause();
    setIsPlaying(false);
    onStopPreview();
  };


  if (!isPreviewing || !event) {
    return null;
  }

  return (
    <div className="live-preview" style={{
      backgroundColor: '#1f2937',
      border: '2px solid #10b981',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ color: '#10b981', margin: 0 }}>
          🎬 Live Preview - Event {event.eventId}
        </h3>
        <div className="preview-controls">
          <button
            onClick={handlePlayPause}
            className={`preview-button ${isPlaying ? 'playing' : ''}`}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button
            onClick={handleStop}
            className="preview-button"
            style={{ backgroundColor: '#6b7280' }}
          >
            ⏹️ Stop
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        marginBottom: '1rem',
        fontSize: '12px',
        color: '#9ca3af',
        flexWrap: 'wrap'
      }}>
        <div>
          <strong>View:</strong> {event.view === 'total' ? 'Total Review' : event.view === 'left' ? 'Left Only' : 'Right Only'}
        </div>
        <div>
          <strong>Left Range:</strong> {Math.floor(event.leftRange[0])}s - {Math.floor(event.leftRange[1])}s
        </div>
        <div>
          <strong>Right Range:</strong> {Math.floor(event.rightRange[0])}s - {Math.floor(event.rightRange[1])}s
        </div>
        <div>
          <strong>Current Time:</strong> {Math.floor(currentTime)}s
        </div>
      </div>

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {event.view === 'total' ? (
          <div className="preview-video-container">
            <div style={{ position: 'relative', width: '100%' }}>
              <video
                ref={leftPreviewRef}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  display: switchPlan[currentSegment]?.view === 'left' ? 'block' : 'none'
                }}
                muted
                playsInline
              />
              <video
                ref={rightPreviewRef}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  display: switchPlan[currentSegment]?.view === 'right' ? 'block' : 'none'
                }}
                muted
                playsInline
              />
              <div className="preview-video-label">
                TOTAL REVIEW ({switchPlan[currentSegment]?.view === 'left' ? 'Left' : 'Right'}) - Segment {currentSegment + 1}
              </div>
            </div>
          </div>
        ) : event.view === 'left' ? (
          <div className="preview-video-container">
            <video
              ref={leftPreviewRef}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '6px'
              }}
              muted
              playsInline
            />
            <div className="preview-video-label">
              LEFT VIEW
            </div>
          </div>
        ) : (
          <div className="preview-video-container">
            <video
              ref={rightPreviewRef}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '6px'
              }}
              muted
              playsInline
            />
            <div className="preview-video-label">
              RIGHT VIEW
            </div>
          </div>
        )}
      </div>


      <div className="preview-info">
        <div className="preview-time-display">
          <strong>Preview Info:</strong>
          <span>Current Time: {Math.floor(currentTime)}s</span>
        </div>
        <div>• This shows how the final clip will look</div>
        <div>• {event.view === 'total' ? 'Videos play in sequence according to your view configuration' : 
              event.view === 'left' ? 'Only the left video plays' : 
              'Only the right video plays'}</div>
        <div>• Adjust ranges in the event editor to see changes</div>
        <div>• Click "Generate Clips" to export all events</div>
        {event.view === 'total' && (
          <div style={{ color: '#10b981', marginTop: '0.25rem' }}>
            💡 Total review shows videos in sequence: left first, then right, or as configured
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePreview;
