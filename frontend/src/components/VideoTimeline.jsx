import { useRef, useEffect, useState } from 'react';

const VideoTimeline = ({ 
  duration, 
  events, 
  onAddEvent, 
  onSelectEvent, 
  currentTime, 
  onScrub,
  selectedEvent 
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeFromPosition = (clientX) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  const handleMouseDown = (e) => {
    if (e.target === canvasRef.current) {
      const time = getTimeFromPosition(e.clientX);
      onScrub(time);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const time = getTimeFromPosition(e.clientX);
      onScrub(time);
    } else {
      const time = getTimeFromPosition(e.clientX);
      setHoverTime(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e) => {
    if (e.target === canvasRef.current) {
      const time = getTimeFromPosition(e.clientX);
      onAddEvent(time);
    }
  };

  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // Draw timeline track
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, height / 2 - 2, width, 4);

    // Draw current time indicator
    const currentX = (currentTime / duration) * width;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(currentX - 1, 0, 2, height);

    // Draw hover time indicator
    if (hoverTime !== null) {
      const hoverX = (hoverTime / duration) * width;
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(hoverX - 1, 0, 2, height);
    }

    // Draw event markers
    events.forEach((event, index) => {
      const x = (event.timestamp / duration) * width;
      const isSelected = selectedEvent && selectedEvent.eventId === event.eventId;
      
      // Draw marker
      ctx.fillStyle = isSelected ? '#10b981' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, height / 2, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw event number
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(event.eventId.toString(), x, height / 2 - 10);
    });

    // Draw time labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    
    // Start time
    ctx.fillText('0:00', 5, height - 5);
    
    // End time
    ctx.fillText(formatTime(duration), width - 30, height - 5);
    
    // Current time
    if (currentTime > 0) {
      ctx.fillText(formatTime(currentTime), currentX + 5, 15);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = 60;
        drawTimeline();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [duration, events, currentTime, hoverTime, selectedEvent]);

  useEffect(() => {
    drawTimeline();
  }, [duration, events, currentTime, hoverTime, selectedEvent]);

  return (
    <div className="video-timeline-container" style={{ marginBottom: '1rem' }}>
      <div 
        ref={containerRef}
        style={{ 
          position: 'relative',
          width: '100%',
          height: '60px',
          backgroundColor: '#1f2937',
          borderRadius: '8px',
          border: '1px solid #374151',
          cursor: 'pointer'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoverTime(null)}
        onClick={handleClick}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px'
          }}
        />
        
        {/* Tooltip */}
        {hoverTime !== null && (
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              left: `${(hoverTime / duration) * 100}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none',
              zIndex: 10
            }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginTop: '0.5rem',
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        <span>Click timeline to add events</span>
        <span>{events.length} events</span>
      </div>
    </div>
  );
};

export default VideoTimeline;
