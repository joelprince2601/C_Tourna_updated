import { useState, useRef, useEffect } from 'react';
import VideoPreview from './components/VideoPreview';
import ClipControls from './components/ClipControls';
import ClipsList from './components/ClipsList';
import { uploadCameras, createClip as createBackendClip, createReel, getReelDownloadUrl } from './services/api';

export default function App() {
  // Video refs
  const videoRefs = useRef({
    left: null,
    left_zoom: null,
    right: null,
    right_zoom: null,
  });

  // Ref for video preview section (for scrolling)
  const videoPreviewRef = useRef(null);

  // Track blob URLs for cleanup
  const blobURLsRef = useRef({
    left: null,
    left_zoom: null,
    right: null,
    right_zoom: null,
  });

  // Track video File objects for backend upload
  const [videoFiles, setVideoFiles] = useState({
    left: null,
    left_zoom: null,
    right: null,
    right_zoom: null,
  });

  // Video state
  const [videoSources, setVideoSources] = useState({
    left: null,
    left_zoom: null,
    right: null,
    right_zoom: null,
  });

  // Playback state
  const [activeSource, setActiveSource] = useState('left');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Clip creation state
  const [markIn, setMarkIn] = useState(null);
  const [markOut, setMarkOut] = useState(null);
  const [clips, setClips] = useState([]);

  // Backend integration state
  const [sessionKey, setSessionKey] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Revoke all blob URLs on component unmount
      Object.values(blobURLsRef.current).forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Upload videos to backend when all 4 are loaded
  useEffect(() => {
    const allVideosLoaded = videoFiles.left && videoFiles.left_zoom &&
                            videoFiles.right && videoFiles.right_zoom;

    if (allVideosLoaded && !sessionKey && !isUploading) {
      const uploadToBackend = async () => {
        setIsUploading(true);
        try {
          console.log('Uploading 4 videos to backend...');
          const response = await uploadCameras(videoFiles);
          setSessionKey(response.session_key);
          console.log('✅ Backend session created:', response.session_key);
          console.log('Video metadata:', response.metadata);
        } catch (error) {
          console.error('❌ Failed to upload videos to backend:', error);
          alert(`Failed to upload videos to backend: ${error.message}`);
        } finally {
          setIsUploading(false);
        }
      };

      uploadToBackend();
    }
  }, [videoFiles, sessionKey, isUploading]);

  // Apply playback speed to all videos
  useEffect(() => {
    const videos = Object.values(videoRefs.current).filter(v => v);
    videos.forEach(video => {
      video.playbackRate = playbackSpeed;
    });
  }, [playbackSpeed]);

  // Keyboard controls for seeking (left/right arrows)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't handle if user is typing in an input field
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Only handle if videos are loaded
      const videos = Object.values(videoRefs.current).filter(v => v);
      if (videos.length === 0 || duration === 0) {
        return;
      }

      // Left arrow: go back 5 seconds
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const newTime = Math.max(0, currentTime - 5);
        handleSeek(newTime);
      }
      // Right arrow: go forward 5 seconds
      else if (event.key === 'ArrowRight') {
        event.preventDefault();
        const newTime = Math.min(duration, currentTime + 5);
        handleSeek(newTime);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTime, duration]);

  const handleVideoUpload = (sourceId, file) => {
    // Revoke old blob URL to prevent memory leak
    const oldUrl = blobURLsRef.current[sourceId];
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    if (!file) {
      // Remove video
      blobURLsRef.current[sourceId] = null;
      setVideoSources(prev => ({
        ...prev,
        [sourceId]: null
      }));
      setVideoFiles(prev => ({
        ...prev,
        [sourceId]: null
      }));

      // If removing the active video, switch to another video if available
      if (activeSource === sourceId) {
        const otherSource = Object.keys(videoSources).find(
          key => key !== sourceId && videoSources[key]
        );
        if (otherSource) {
          setActiveSource(otherSource);
        }
      }
      return;
    }

    const url = URL.createObjectURL(file);

    // Store URL in ref for cleanup
    blobURLsRef.current[sourceId] = url;

    // Store File object for backend upload
    setVideoFiles(prev => ({
      ...prev,
      [sourceId]: file
    }));

    setVideoSources(prev => ({
      ...prev,
      [sourceId]: url
    }));

    // Set this as active source if no active source has video
    if (!videoSources[activeSource]) {
      setActiveSource(sourceId);
    }
  };

  const handlePlayPause = () => {
    // Play/pause all videos simultaneously
    const videos = Object.values(videoRefs.current).filter(v => v);
    if (videos.length === 0) return;

    if (isPlaying) {
      videos.forEach(video => video.pause());
    } else {
      videos.forEach(video => video.play());
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time) => {
    // Sync all videos to the same time
    const videos = Object.values(videoRefs.current).filter(v => v);
    videos.forEach(video => {
      video.currentTime = time;
    });
    setCurrentTime(time);
  };

  const handleTimeUpdate = (source) => {
    if (source === activeSource) {
      const video = videoRefs.current[source];
      if (video) {
        setCurrentTime(video.currentTime);
      }
    }
  };

  const handleLoadedMetadata = (source) => {
    if (source === activeSource) {
      const video = videoRefs.current[source];
      if (video) {
        setDuration(video.duration);
      }
    }
  };

  const handleSourceSelect = (source) => {
    setActiveSource(source);

    // Update duration from new source (all videos are already synced)
    const newVideo = videoRefs.current[source];
    if (newVideo) {
      setDuration(newVideo.duration);
    }
  };

  const handleMarkIn = () => {
    setMarkIn(currentTime);
  };

  const handleMarkOut = () => {
    setMarkOut(currentTime);
  };

  const handleCreateClip = async () => {
    if (markIn !== null && markOut !== null && markOut > markIn) {
      const newClip = {
        id: Date.now(),
        source: activeSource,
        start: markIn,
        end: markOut,
        duration: markOut - markIn,
        backendClipId: null, // Will be set if backend creation succeeds
      };

      // Also create clip on backend if session exists
      if (sessionKey) {
        try {
          console.log('Creating backend clip...', newClip);
          const backendClip = await createBackendClip(sessionKey, newClip);
          newClip.backendClipId = backendClip.clip_id; // Link backend clip to frontend clip
          console.log('✅ Backend clip created:', backendClip.clip_id);
        } catch (error) {
          console.error('❌ Failed to create backend clip:', error);
          alert(`Failed to create backend clip: ${error.message}\n\nFrontend clip was still created (preview only, won't be exported).`);
        }
      } else {
        console.warn('⚠️ No backend session - clip created in frontend only (preview only, won\'t be exported)');
      }

      setClips([...clips, newClip]);
      setMarkIn(null);
      setMarkOut(null);
    }
  };

  const handleDeleteClip = (clipId) => {
    setClips(clips.filter((clip) => clip.id !== clipId));
  };

  const handleMoveClip = (index, direction) => {
    const newClips = [...clips];
    if (direction === 'up' && index > 0) {
      [newClips[index], newClips[index - 1]] = [newClips[index - 1], newClips[index]];
    } else if (direction === 'down' && index < clips.length - 1) {
      [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
    }
    setClips(newClips);
  };

  const handleExport = async () => {
    // Filter clips that have backend clip IDs
    const backendClipIds = clips
      .filter(clip => clip.backendClipId !== null)
      .map(clip => clip.backendClipId);

    console.log('Clips in timeline:', clips.length);
    console.log('Clips with backend IDs:', backendClipIds.length);
    console.log('Backend clip IDs:', backendClipIds);

    if (backendClipIds.length === 0) {
      alert('No clips to export! Create some clips first.\n\nMake sure videos are uploaded to backend before creating clips.');
      return;
    }

    if (backendClipIds.length < clips.length) {
      const missingCount = clips.length - backendClipIds.length;
      const proceed = confirm(
        `⚠️ Warning: ${missingCount} clip(s) were not synced to backend and won't be exported.\n\n` +
        `Exporting ${backendClipIds.length} out of ${clips.length} clips.\n\n` +
        `Continue?`
      );
      if (!proceed) return;
    }

    if (!sessionKey) {
      alert('Backend session not initialized. Please re-upload your videos.');
      return;
    }

    setIsExporting(true);
    try {
      console.log('Creating highlight reel from', backendClipIds.length, 'clips...');
      const reel = await createReel(backendClipIds);

      console.log('✅ Highlight reel created:', reel);
      console.log(`   Duration: ${reel.duration_s}s`);
      console.log(`   Size: ${(reel.filesize_bytes / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Processing time: ${reel.processing_time_ms}ms`);

      // Download the reel
      const downloadUrl = getReelDownloadUrl(reel.reel_id);
      console.log('📥 Downloading reel from:', downloadUrl);

      // Trigger download
      window.location.href = downloadUrl;

      alert(`✅ Highlight reel created successfully!\n\nDuration: ${reel.duration_s.toFixed(1)}s\nClips: ${reel.num_clips}\n\nDownload starting...`);
    } catch (error) {
      console.error('❌ Failed to export highlight reel:', error);
      alert(`Failed to export highlight reel: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewClip = (clip) => {
    // Scroll to video players
    if (videoPreviewRef.current) {
      videoPreviewRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }

    // Wait a bit for scroll, then start preview
    setTimeout(() => {
      // Switch to the clip's source
      setActiveSource(clip.source);

      // Seek all videos to the clip's start time
      const videos = Object.values(videoRefs.current).filter(v => v);
      videos.forEach(video => {
        video.currentTime = clip.start;
      });
      setCurrentTime(clip.start);

      // Update duration from the new source
      const newVideo = videoRefs.current[clip.source];
      if (newVideo) {
        setDuration(newVideo.duration);
      }

      // Auto-play the clip
      if (!isPlaying) {
        videos.forEach(video => video.play());
        setIsPlaying(true);
      }

      // Auto-pause when clip ends
      const checkClipEnd = () => {
        const currentVideo = videoRefs.current[clip.source];
        if (currentVideo && currentVideo.currentTime >= clip.end) {
          videos.forEach(video => video.pause());
          setIsPlaying(false);
          currentVideo.removeEventListener('timeupdate', checkClipEnd);
        }
      };

      // Add listener to stop at clip end
      const currentVideo = videoRefs.current[clip.source];
      if (currentVideo) {
        currentVideo.addEventListener('timeupdate', checkClipEnd);
      }
    }, 300); // 300ms delay for smooth scroll
  };

  return (
    <div style={styles.app}>
      {/* Uploading Overlay */}
      {isUploading && (
        <div style={styles.uploadingOverlay}>
          <div style={styles.uploadingModal}>
            <div style={styles.spinner}></div>
            <h2 style={styles.uploadingTitle}>Uploading Videos</h2>
            <p style={styles.uploadingText}>Processing 4 camera angles...</p>
            <p style={styles.uploadingSubtext}>This may take a moment</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.headerTitle}>Clutch Highlights Generator</h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.container}>
          {/* Video Preview Grid */}
          <div ref={videoPreviewRef}>
            <VideoPreview
              videoSources={videoSources}
              activeSource={activeSource}
              onSourceSelect={handleSourceSelect}
              currentTime={currentTime}
              videoRefs={videoRefs}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onVideoUpload={handleVideoUpload}
              showAllViews={markIn !== null || markOut !== null}
              allVideosUploaded={videoFiles.left && videoFiles.left_zoom && videoFiles.right && videoFiles.right_zoom}
            />
          </div>

          {/* Clip Controls */}
          <ClipControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            markIn={markIn}
            markOut={markOut}
            onMarkIn={handleMarkIn}
            onMarkOut={handleMarkOut}
            onCreateClip={handleCreateClip}
            activeSource={activeSource}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
          />

          {/* Clips Timeline */}
          <ClipsList
            clips={clips}
            onDeleteClip={handleDeleteClip}
            onMoveClip={handleMoveClip}
            onExport={handleExport}
            onPreviewClip={handlePreviewClip}
            isExporting={isExporting}
          />
        </div>
      </main>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#f5f5f5',
    paddingBottom: '120px', // Space for sticky bottom controls
  },
  header: {
    background: '#141414',
    borderBottom: '1px solid #2a2a2a',
    padding: '16px 32px',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
  },
  main: {
    padding: '20px 32px',
  },
  container: {
    maxWidth: '1600px',
    margin: '0 auto',
  },
  uploadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  uploadingModal: {
    background: '#1a1a1a',
    border: '2px solid #3b8bff',
    borderRadius: '12px',
    padding: '40px 60px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(59, 139, 255, 0.3)',
  },
  spinner: {
    width: '60px',
    height: '60px',
    margin: '0 auto 24px',
    border: '4px solid #2a2a2a',
    borderTop: '4px solid #3b8bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  uploadingTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f5f5f5',
    margin: '0 0 12px 0',
  },
  uploadingText: {
    fontSize: '16px',
    color: '#aaa',
    margin: '0 0 8px 0',
  },
  uploadingSubtext: {
    fontSize: '14px',
    color: '#777',
    margin: 0,
  },
};
