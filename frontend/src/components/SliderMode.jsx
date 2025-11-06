import { useState, useRef, useEffect } from 'react';
import { extractSlider, apiGetJson } from '../lib/api.js';
import VideoTimeline from './VideoTimeline';
import EventSliderEditor from './EventSliderEditor';
import LivePreview from './LivePreview';

const SliderMode = ({ sessionId, onClipsGenerated }) => {
  const [leftVideoFile, setLeftVideoFile] = useState(null);
  const [rightVideoFile, setRightVideoFile] = useState(null);
  const [leftPreviewURL, setLeftPreviewURL] = useState(null);
  const [rightPreviewURL, setRightPreviewURL] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewEvent, setPreviewEvent] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [generatedClips, setGeneratedClips] = useState([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);
  const [generatingEvents, setGeneratingEvents] = useState(new Set()); // Track which events are being generated

  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);
  const isSyncingRef = useRef(false);

  // Load generated clips when component mounts
  useEffect(() => {
    loadGeneratedClips();
  }, []);

  const syncPlay = () => {
    if (!leftVideoRef.current || !rightVideoRef.current) return;
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      rightVideoRef.current.currentTime = leftVideoRef.current.currentTime;
      rightVideoRef.current.play();
    } catch (_) {}
    finally { isSyncingRef.current = false; }
  };

  const syncPause = () => {
    if (!leftVideoRef.current || !rightVideoRef.current) return;
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      rightVideoRef.current.pause();
    } catch (_) {}
    finally { isSyncingRef.current = false; }
  };

  const syncSeek = () => {
    if (!leftVideoRef.current || !rightVideoRef.current) return;
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      const t = leftVideoRef.current.currentTime;
      if (typeof rightVideoRef.current.fastSeek === 'function') {
        rightVideoRef.current.fastSeek(t);
      } else {
        rightVideoRef.current.currentTime = t;
      }
    } catch (_) {}
    finally { isSyncingRef.current = false; }
  };

  const handleLeftFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLeftVideoFile(file);
      setLeftPreviewURL(URL.createObjectURL(file));
    }
  };

  const handleRightFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRightVideoFile(file);
      setRightPreviewURL(URL.createObjectURL(file));
    }
  };

  const handleTimeUpdate = () => {
    if (leftVideoRef.current) {
      setCurrentTime(leftVideoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (leftVideoRef.current) {
      setDuration(leftVideoRef.current.duration);
    }
  };

  const calculateCumulativeScores = (events) => {
    let teamA = 0;
    let teamB = 0;
    
    events.forEach(event => {
      if (event.eventType === 'goal_a') teamA++;
      if (event.eventType === 'goal_b') teamB++;
    });
    
    return { teamA, teamB };
  };

  const handleAddEvent = (timestamp) => {
    // Show team selection prompt
    const teamChoice = window.confirm(
      `⚽ GOAL SCORED!\n\n` +
      `Click OK for Team A Goal\n` +
      `Click Cancel for Team B Goal\n\n` +
      `Or select a different event type in the editor.`
    );
    
    const eventType = teamChoice ? 'goal_a' : 'goal_b';
    
    const newEvent = {
      eventId: events.length + 1,
      timestamp: timestamp,
      leftRange: [Math.max(0, timestamp - 5), timestamp + 5],
      rightRange: [Math.max(0, timestamp - 5), timestamp + 5],
      view: 'total',
      eventType: eventType
    };
    
    setEvents(prev => {
      const updatedEvents = [...prev, newEvent];
      const scores = calculateCumulativeScores(updatedEvents);
      setTeamAScore(scores.teamA);
      setTeamBScore(scores.teamB);
      return updatedEvents;
    });
    setSelectedEvent(newEvent);
  };

  const handleUpdateEvent = (updatedEvent) => {
    setEvents(prev => {
      const updatedEvents = prev.map(event => 
        event.eventId === updatedEvent.eventId ? updatedEvent : event
      );
      const scores = calculateCumulativeScores(updatedEvents);
      setTeamAScore(scores.teamA);
      setTeamBScore(scores.teamB);
      return updatedEvents;
    });
    if (selectedEvent && selectedEvent.eventId === updatedEvent.eventId) {
      setSelectedEvent(updatedEvent);
    }
  };

  const handleDeleteEvent = (eventId) => {
    setEvents(prev => {
      const updatedEvents = prev.filter(event => event.eventId !== eventId);
      const scores = calculateCumulativeScores(updatedEvents);
      setTeamAScore(scores.teamA);
      setTeamBScore(scores.teamB);
      return updatedEvents;
    });
    if (selectedEvent && selectedEvent.eventId === eventId) {
      setSelectedEvent(null);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
  };

  const handleScrub = (time) => {
    if (leftVideoRef.current) {
      leftVideoRef.current.currentTime = time;
    }
    if (rightVideoRef.current) {
      rightVideoRef.current.currentTime = time;
    }
  };

  const handlePreviewEvent = (event) => {
    setPreviewEvent(event);
    setIsPreviewing(true);
  };

  const handleStopPreview = () => {
    setIsPreviewing(false);
    setPreviewEvent(null);
  };

  const loadGeneratedClips = async () => {
    setIsLoadingClips(true);
    try {
      console.log('[LOAD_CLIPS] Using session ID:', sessionId);
      const data = await apiGetJson('/clips', {
        headers: {
          'X-Session-Id': sessionId
        }
      });
      console.log('[LOAD_CLIPS] Received clips:', data.clips);
      setGeneratedClips(data.clips || []);
    } catch (error) {
      console.error('Error loading clips:', error);
      setGeneratedClips([]);
    } finally {
      setIsLoadingClips(false);
    }
  };

  const handleGenerateEvent = async (event) => {
    if (!leftVideoFile || !rightVideoFile) {
      alert('Please upload both left and right videos!');
      return;
    }

    // Check duration limit before generating
    const eventDuration = calculateEventDuration(event);
    if (!checkDurationLimit(eventDuration)) {
      return;
    }

    // Add event to generating set
    setGeneratingEvents(prev => new Set(prev).add(event.eventId));

    try {
      // Transform single event to match backend format
      const transformedEvent = {
        eventId: event.eventId,
        left_start: event.leftRange[0],
        left_end: event.leftRange[1],
        right_start: event.rightRange[0],
        right_end: event.rightRange[1],
        view: event.view,
        views: event.views || [],
        eventType: event.eventType || 'goal_a'
      };

      const formData = new FormData();
      formData.append('video_left', leftVideoFile);
      formData.append('video_right', rightVideoFile);
      formData.append('events', JSON.stringify([transformedEvent])); // Single event in array

      console.log('[GENERATE_SINGLE_EVENT] Using session ID:', sessionId);
      const response = await fetch('http://127.0.0.1:8001/extract_slider', {
        method: 'POST',
        headers: {
          'X-Session-Id': sessionId
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.status === 'ok') {
        alert(`🎉 Successfully generated clip for event ${event.eventId}!`);
        // Load the generated clips to display them
        await loadGeneratedClips();
        if (onClipsGenerated) {
          onClipsGenerated();
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error generating single event clip:', error);
      alert(`❌ Error generating clip: ${error.message}`);
    } finally {
      // Remove event from generating set
      setGeneratingEvents(prev => {
        const newSet = new Set(prev);
        newSet.delete(event.eventId);
        return newSet;
      });
    }
  };

  const handleGenerateClips = async () => {
    if (events.length === 0) {
      alert('No events to generate clips from!');
      return;
    }

    if (!leftVideoFile || !rightVideoFile) {
      alert('Please upload both left and right videos!');
      return;
    }

    // Check duration limit before generating all clips
    const totalNewDuration = events.reduce((sum, event) => {
      return sum + calculateEventDuration(event);
    }, 0);
    
    if (!checkDurationLimit(totalNewDuration)) {
      return;
    }

    setIsGenerating(true);

    try {
      // Transform events to match backend format
      const transformedEvents = events.map(event => ({
        eventId: event.eventId,
        left_start: event.leftRange[0],
        left_end: event.leftRange[1],
        right_start: event.rightRange[0],
        right_end: event.rightRange[1],
        view: event.view,
        views: event.views || [], // Include views array for total review mode
        eventType: event.eventType || 'goal_a' // Include event type for scorecard
      }));

      const formData = new FormData();
      formData.append('video_left', leftVideoFile);
      formData.append('video_right', rightVideoFile);
      formData.append('events', JSON.stringify(transformedEvents));

      console.log('[GENERATE_CLIPS] Using session ID:', sessionId);
      const response = await fetch('http://127.0.0.1:8001/extract_slider', {
        method: 'POST',
        headers: {
          'X-Session-Id': sessionId
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.status === 'ok') {
        alert(`🎉 Successfully generated ${result.clips.length} clips!`);
        // Load the generated clips to display them
        await loadGeneratedClips();
        if (onClipsGenerated) {
          onClipsGenerated();
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error generating clips:', error);
      alert(`❌ Error generating clips: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate duration of an event (considers views for total review mode)
  const calculateEventDuration = (event) => {
    if (event.view === 'total' && event.views && event.views.length > 0) {
      // Sum up all segment durations
      return event.views.reduce((sum, view) => sum + (view.duration || 0), 0);
    } else {
      // Calculate from video ranges
      const leftDuration = (event.leftRange[1] || 0) - (event.leftRange[0] || 0);
      const rightDuration = (event.rightRange[1] || 0) - (event.rightRange[0] || 0);
      return Math.max(leftDuration, rightDuration);
    }
  };

  // Check if total duration exceeds 15 minutes (900 seconds)
  const checkDurationLimit = (additionalDuration = 0) => {
    const MAX_DURATION_SECONDS = 15 * 60; // 15 minutes
    
    // Calculate total duration from existing clips
    const existingDuration = generatedClips.reduce((sum, clip) => {
      const clipDuration = (clip.end_time || 0) - (clip.start_time || 0);
      return sum + clipDuration;
    }, 0);
    
    const totalDuration = existingDuration + additionalDuration;
    
    if (totalDuration > MAX_DURATION_SECONDS) {
      const minutes = Math.floor(totalDuration / 60);
      const seconds = Math.round(totalDuration % 60);
      const maxMinutes = Math.floor(MAX_DURATION_SECONDS / 60);
      const maxSeconds = MAX_DURATION_SECONDS % 60;
      
      alert(
        `❌ Highlight video duration exceeds 15-minute limit!\n\n` +
        `Current total duration: ${minutes}:${seconds.toString().padStart(2, '0')}\n` +
        `Maximum allowed: ${maxMinutes}:${maxSeconds.toString().padStart(2, '0')}\n\n` +
        `Please remove some clips or reduce their durations to stay within the limit.`
      );
      return false;
    }
    return true;
  };

  return (
    <div className="slider-mode">
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#10b981' }}>
        🎬 Slider Mode - Visual Timeline Editing
      </h2>

      {/* File Upload */}
      <div className="upload-section" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'white' }}>
          📁 Upload Videos
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', color: '#9ca3af' }}>
              Upload Left Camera
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleLeftFileChange}
              className="file-input"
              style={{ opacity: 1, cursor: 'pointer' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', color: '#9ca3af' }}>
              Upload Right Camera
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleRightFileChange}
              className="file-input"
              style={{ opacity: 1, cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Video Players */}
      {leftPreviewURL && rightPreviewURL && (
        <div className="video-section" style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'white' }}>
            🎥 Synchronized Video Players
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="video-container">
              <video
                ref={leftVideoRef}
                src={leftPreviewURL}
                controls
                preload="metadata"
                playsInline
                disablePictureInPicture
                className="video-player"
                onPlay={syncPlay}
                onPause={syncPause}
                onSeeking={syncSeek}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />
            </div>
            <div className="video-container">
              <video
                ref={rightVideoRef}
                src={rightPreviewURL}
                controls={false}
                preload="metadata"
                playsInline
                disablePictureInPicture
                className="video-player"
              />
            </div>
          </div>
        </div>
      )}

      {/* Scorecard Display */}
      {events.length > 0 && (
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: 'white' }}>
            ⚽ Match Scorecard
          </h3>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '2rem',
            fontSize: '2rem',
            fontWeight: 'bold',
            color: 'white'
          }}>
            <div style={{
              backgroundColor: '#dc2626',
              padding: '1rem 2rem',
              borderRadius: '8px',
              border: '2px solid #ef4444'
            }}>
              Team A: {teamAScore}
            </div>
            <div style={{ color: '#9ca3af', fontSize: '1.5rem' }}>VS</div>
            <div style={{
              backgroundColor: '#2563eb',
              padding: '1rem 2rem',
              borderRadius: '8px',
              border: '2px solid #3b82f6'
            }}>
              Team B: {teamBScore}
            </div>
          </div>
          <div style={{ color: '#9ca3af', fontSize: '14px', marginTop: '0.5rem' }}>
            {events.length} event{events.length !== 1 ? 's' : ''} marked
            {events.length > 0 && (
              <div style={{ marginTop: '0.25rem', color: '#10b981' }}>
                Last event: {events[events.length - 1]?.eventType === 'goal_a' ? '⚽ Team A Goal' : 
                           events[events.length - 1]?.eventType === 'goal_b' ? '⚽ Team B Goal' :
                           events[events.length - 1]?.eventType === 'switch' ? '🔄 Switch' : '⭐ Highlight'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Timeline */}
      {duration > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'white' }}>
            📍 Interactive Timeline
          </h3>
          <VideoTimeline
            duration={duration}
            events={events}
            onAddEvent={handleAddEvent}
            onSelectEvent={handleSelectEvent}
            currentTime={currentTime}
            onScrub={handleScrub}
            selectedEvent={selectedEvent}
          />
        </div>
      )}

      {/* Live Preview */}
      {isPreviewing && previewEvent && (
        <LivePreview
          event={previewEvent}
          leftVideoRef={leftVideoRef}
          rightVideoRef={rightVideoRef}
          isPreviewing={isPreviewing}
          onStopPreview={handleStopPreview}
          onUpdateEvent={handleUpdateEvent}
        />
      )}

      {/* Event Editors */}
      {events.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'white' }}>
            ✏️ Event Editors ({events.length} events)
          </h3>
          {events.map((event) => (
            <EventSliderEditor
              key={event.eventId}
              event={event}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onPreviewEvent={handlePreviewEvent}
              onGenerateEvent={handleGenerateEvent}
              leftVideoRef={leftVideoRef}
              rightVideoRef={rightVideoRef}
              leftVideoSrc={leftPreviewURL}
              rightVideoSrc={rightPreviewURL}
              isGenerating={generatingEvents.has(event.eventId)}
            />
          ))}
        </div>
      )}

      {/* Generate Clips */}
      {events.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={handleGenerateClips}
            disabled={isGenerating || !leftVideoFile || !rightVideoFile}
            className="btn btn-success"
            style={{
              backgroundColor: isGenerating ? '#4b5563' : '#059669',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: '1.1rem',
              padding: '0.75rem 2rem'
            }}
          >
            {isGenerating ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg className="spinner" viewBox="0 0 24 24">
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
                Generating Clips...
              </span>
            ) : (
              '🎬 Generate All Clips'
            )}
          </button>
          
          <div style={{ marginTop: '1rem', color: '#9ca3af', fontSize: '14px' }}>
            <p>This will create {events.length} clips based on your timeline events.</p>
            <p>Each clip will be saved to your session and appear in the "Saved Clips" section.</p>
          </div>
        </div>
      )}

      {/* Generated Clips Display */}
      <div style={{
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        padding: '1rem',
        marginTop: '2rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem' 
        }}>
          <h3 style={{ color: '#ffffff', margin: 0 }}>
            🎬 Generated Clips ({generatedClips.length})
          </h3>
          <button
            onClick={loadGeneratedClips}
            disabled={isLoadingClips}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: isLoadingClips ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: isLoadingClips ? 0.6 : 1
            }}
          >
            {isLoadingClips ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {isLoadingClips ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
            Loading clips...
          </div>
        ) : generatedClips.length === 0 ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
            No clips generated yet. Create events and click "Generate All Clips" to get started.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {generatedClips.map((clip, index) => (
              <div key={clip.clip_id || index} style={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '1rem',
                position: 'relative'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <h4 style={{ color: '#ffffff', margin: '0 0 0.5rem 0', fontSize: '14px' }}>
                    Clip {clip.event_id || index + 1}
                  </h4>
                  <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '0.5rem' }}>
                    <div>View: {clip.view === 'total' ? 'Total Review' : clip.view === 'left' ? 'Left Only' : 'Right Only'}</div>
                    <div>Mode: {clip.mode || 'slider'}</div>
                    <div>Created: {new Date(clip.created_at).toLocaleString()}</div>
                  </div>
                </div>
                
                <video
                  controls
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    backgroundColor: '#000'
                  }}
                  preload="metadata"
                >
                  <source src={`http://127.0.0.1:8001/clip/${clip.clip_id}`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                <div style={{ 
                  marginTop: '0.5rem', 
                  display: 'flex', 
                  gap: '0.5rem',
                  justifyContent: 'flex-end'
                }}>
                  <a
                    href={`http://127.0.0.1:8001/clip/${clip.clip_id}`}
                    download={clip.filename || `clip_${clip.clip_id}.mp4`}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      textDecoration: 'none',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    📥 Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        padding: '1rem',
        marginTop: '2rem'
      }}>
        <h4 style={{ color: '#10b981', marginBottom: '0.5rem' }}>How to use Slider Mode:</h4>
        <ol style={{ color: '#9ca3af', fontSize: '14px', lineHeight: '1.6' }}>
          <li>Upload left and right videos</li>
          <li>Click anywhere on the timeline to create event markers</li>
          <li>Adjust the start/end ranges for each video in the event editors</li>
          <li>Choose view type: Left Only or Right Only</li>
          <li>Click "Preview" to see how each event will look</li>
          <li>Click "Generate All Clips" to export all events</li>
          <li>Generated clips will appear in the "Saved Clips" section</li>
        </ol>
      </div>
    </div>
  );
};

export default SliderMode;
