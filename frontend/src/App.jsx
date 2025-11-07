import { useState, useRef, useEffect } from "react";
import {
  apiGetJson,
  apiPostFormJson,
  apiGetBlob,
  apiDeleteJson,
  API_BASE,
} from "./lib/api.js";
import SliderMode from "./components/SliderMode.jsx";

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [mode, setMode] = useState("single"); // 'single' | 'switch' | 'slider' | 'aspect'
  const [leftVideoFile, setLeftVideoFile] = useState(null);
  const [rightVideoFile, setRightVideoFile] = useState(null);
  const [leftPreviewURL, setLeftPreviewURL] = useState(null);
  const [rightPreviewURL, setRightPreviewURL] = useState(null);
  const [clips, setClips] = useState([]);
  const [highlightURL, setHighlightURL] = useState(null);
  const [isGeneratingHighlights, setIsGeneratingHighlights] = useState(false);
  const [aspectVideoFile, setAspectVideoFile] = useState(null);
  const [aspectPreviewURL, setAspectPreviewURL] = useState(null);
  const [convertedVideoURL, setConvertedVideoURL] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [eventLog, setEventLog] = useState([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [sessionId] = useState(() => {
    // Try to get existing session ID from localStorage
    const existingSessionId = localStorage.getItem("tourna_session_id");
    if (existingSessionId) {
      return existingSessionId;
    }
    // Generate new session ID and store it
    const newSessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    localStorage.setItem("tourna_session_id", newSessionId);
    return newSessionId;
  });

  // Function to clear session ID (for testing or reset)
  const clearSessionId = () => {
    localStorage.removeItem("tourna_session_id");
    window.location.reload(); // Reload to generate new session ID
  };
  // Removed save location feature
  const videoRef = useRef(null);
  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);
  const [clipPreviews, setClipPreviews] = useState({}); // clipId -> blobURL
  const isSyncingRef = useRef(false);
  const [switchPlan, setSwitchPlan] = useState([
    { view: "left", till: 5 },
    { view: "right", till: 10 },
  ]);
  const [switchTotalDuration, setSwitchTotalDuration] = useState(20);

  const syncPlay = () => {
    if (!leftVideoRef.current || !rightVideoRef.current) return;
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      rightVideoRef.current.currentTime = leftVideoRef.current.currentTime;
      rightVideoRef.current.play();
    } catch (_) {
    } finally {
      isSyncingRef.current = false;
    }
  };

  const syncPause = () => {
    if (!leftVideoRef.current || !rightVideoRef.current) return;
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      rightVideoRef.current.pause();
    } catch (_) {
    } finally {
      isSyncingRef.current = false;
    }
  };

  const syncSeek = () => {
    if (!leftVideoRef.current || !rightVideoRef.current) return;
    if (isSyncingRef.current) return;
    try {
      isSyncingRef.current = true;
      const t = leftVideoRef.current.currentTime;
      if (typeof rightVideoRef.current.fastSeek === "function") {
        rightVideoRef.current.fastSeek(t);
      } else {
        rightVideoRef.current.currentTime = t;
      }
    } catch (_) {
    } finally {
      isSyncingRef.current = false;
    }
  };

  const pauseAndAlignBoth = () => {
    try {
      if (leftVideoRef.current) leftVideoRef.current.pause();
      if (rightVideoRef.current) rightVideoRef.current.pause();
      if (leftVideoRef.current && rightVideoRef.current) {
        const t = leftVideoRef.current.currentTime;
        if (typeof rightVideoRef.current.fastSeek === "function") {
          rightVideoRef.current.fastSeek(t);
        } else {
          rightVideoRef.current.currentTime = t;
        }
      }
    } catch (_) {}
  };

  const syncRate = () => {
    if (!leftVideoRef.current || !rightVideoRef.current || isSyncingRef.current)
      return;
    try {
      isSyncingRef.current = true;
      rightVideoRef.current.playbackRate = leftVideoRef.current.playbackRate;
    } catch (e) {
      console.warn("Could not sync playback rate:", e);
    } finally {
      isSyncingRef.current = false;
    }
  };

  const syncVolume = () => {
    if (!leftVideoRef.current || !rightVideoRef.current || isSyncingRef.current)
      return;
    try {
      isSyncingRef.current = true;
      rightVideoRef.current.volume = leftVideoRef.current.volume;
      rightVideoRef.current.muted = leftVideoRef.current.muted;
    } catch (e) {
      console.warn("Could not sync volume:", e);
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Load existing clips on component mount (prevent double-call in React StrictMode)
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadClips();
  }, []);

  const loadClips = async () => {
    try {
      const response = await apiGetJson("/clips", {
        headers: {
          "X-Session-Id": sessionId,
        },
      });
      setClips(response.clips || []);
      // Fetch previews for any clips that don't have a blob yet
      const toFetch = (response.clips || []).filter(
        (c) => c.clip_id && !clipPreviews[c.clip_id]
      );
      for (const clip of toFetch) {
        try {
          const blob = await apiGetBlob(`/clip/${clip.clip_id}`, {
            headers: { "X-Session-Id": sessionId },
            timeoutMs: 300000,
          });
          const url = URL.createObjectURL(blob);
          setClipPreviews((prev) => ({ ...prev, [clip.clip_id]: url }));
        } catch (_) {}
      }
    } catch (err) {
      console.error("Error loading clips:", err);
    }
  };

  // Save location handlers removed

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setPreviewURL(URL.createObjectURL(file));
      setHighlightURL(null);
    }
  };

  const handleLeftFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLeftVideoFile(file);
      setLeftPreviewURL(URL.createObjectURL(file));
      setHighlightURL(null);
    }
  };

  const handleRightFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRightVideoFile(file);
      setRightPreviewURL(URL.createObjectURL(file));
      setHighlightURL(null);
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMarkEvent = async () => {
    if (mode === "single") {
      if (!videoRef.current || !videoFile) {
        alert("Upload and play a video first!");
        return;
      }
    } else {
      if (
        !leftVideoRef.current ||
        !rightVideoRef.current ||
        !leftVideoFile ||
        !rightVideoFile
      ) {
        alert("Upload and play both videos first!");
        return;
      }
    }

    if (mode === "switch") {
      pauseAndAlignBoth();
    }

    const timestamp =
      mode === "single"
        ? videoRef.current?.currentTime || 0
        : leftVideoRef.current?.currentTime || 0;

    if (timestamp === 0) {
      alert("Please play the video and click at the desired moment!");
      return;
    }

    // Create log entry immediately
    const logId = Date.now();
    const newLogEntry = {
      id: logId,
      timestamp: timestamp,
      formattedTime: formatTimestamp(timestamp),
      status: "processing",
      clipId: null,
      createdAt: new Date().toLocaleTimeString(),
    };

    // Add to log immediately (non-blocking)
    setEventLog((prev) => [newLogEntry, ...prev]);
    setProcessingCount((prev) => prev + 1);

    // Process in background
    const formData = new FormData();
    if (mode === "single") {
      formData.append("video", videoFile);
    } else {
      formData.append("video_left", leftVideoFile);
      formData.append("video_right", rightVideoFile);
    }
    formData.append("timestamp", timestamp);
    if (mode === "switch") {
      // Ensure plan is cumulative till and within totalDuration
      let cumulative = 0;
      const normalized = switchPlan.map((seg) => {
        cumulative =
          Math.max(cumulative, 0) +
          Math.max(0, Number(seg.till || 0) - cumulative);
        return { view: seg.view, till: cumulative };
      });
      // Cap last till at total duration
      if (
        normalized.length > 0 &&
        normalized[normalized.length - 1].till > Number(switchTotalDuration)
      ) {
        normalized[normalized.length - 1].till = Number(switchTotalDuration);
      }
      formData.append("switch_plan", JSON.stringify(normalized));
      formData.append("total_duration", String(switchTotalDuration));
    }

    try {
      const response = await apiPostFormJson(
        mode === "single" ? "/extract" : "/extract_switch",
        formData,
        {
          headers: {
            "X-Session-Id": sessionId,
          },
          timeoutMs: 900000, // 15 minutes timeout for clip extraction
        }
      );

      // Update log entry with success
      setEventLog((prev) =>
        prev.map((entry) =>
          entry.id === logId
            ? { ...entry, status: "saved", clipId: response.clip_id }
            : entry
        )
      );

      // Reload clips to get updated list
      await loadClips();

      // Fetch and attach preview for the new clip
      if (response.clip_id) {
        try {
          const blob = await apiGetBlob(`/clip/${response.clip_id}`, {
            headers: { "X-Session-Id": sessionId },
            timeoutMs: 300000,
          });
          const url = URL.createObjectURL(blob);
          setClipPreviews((prev) => ({ ...prev, [response.clip_id]: url }));
        } catch (_) {}
      }
    } catch (err) {
      console.error("Error extracting clip:", err);

      let errorMessage = err.message;
      if (err.status === 507) {
        errorMessage = "Disk space full! Please free up space.";
        alert(
          "⚠️ Disk space is running low! Please free up at least 300MB and try again."
        );
      } else if (err.name === "AbortError") {
        errorMessage = "Timeout - video too large";
      }

      // Update log entry with error
      setEventLog((prev) =>
        prev.map((entry) =>
          entry.id === logId
            ? { ...entry, status: "error", error: errorMessage }
            : entry
        )
      );
    } finally {
      setProcessingCount((prev) => prev - 1);
    }
  };

  const handleGenerateHighlights = async () => {
    if (clips.length === 0) {
      alert("No clips available to generate highlights!");
      return;
    }

    // Check if any clips are still processing
    const processingClips = eventLog.filter(
      (entry) => entry.status === "processing"
    );
    if (processingClips.length > 0) {
      const proceed = confirm(
        `${processingClips.length} clip(s) are still processing. Generate highlights with saved clips only?`
      );
      if (!proceed) return;
    }

    // Calculate total duration of all clips (15 minutes = 900 seconds)
    const MAX_DURATION_SECONDS = 15 * 60; // 15 minutes
    const totalDuration = clips.reduce((sum, clip) => {
      const clipDuration = (clip.end_time || 0) - (clip.start_time || 0);
      return sum + clipDuration;
    }, 0);

    if (totalDuration > MAX_DURATION_SECONDS) {
      const minutes = Math.floor(totalDuration / 60);
      const seconds = Math.round(totalDuration % 60);
      alert(
        `❌ Highlight video duration exceeds 15-minute limit!\n\n` +
          `Current total duration: ${minutes}:${seconds
            .toString()
            .padStart(2, "0")}\n` +
          `Maximum allowed: 15:00\n\n` +
          `Please remove some clips or reduce their durations to stay within the limit.`
      );
      return;
    }

    setIsGeneratingHighlights(true);

    try {
      console.log("Requesting highlights from backend...");
      const blob = await apiGetBlob("/highlights", {
        headers: {
          "X-Session-Id": sessionId,
        },
        timeoutMs: 1200000, // 20 minutes timeout for large videos
      });

      console.log("Highlights received, creating blob URL...");
      const blobURL = URL.createObjectURL(blob);
      setHighlightURL(blobURL);
      console.log("Highlights ready! Blob URL:", blobURL);
      alert("🎉 Highlights video generated successfully!");
    } catch (err) {
      console.error("Error generating highlights:", err);

      let errorMessage = "Error generating highlights";
      if (err.status === 507) {
        errorMessage = "Disk space full! Please free up space and try again.";
      } else if (err.name === "AbortError") {
        errorMessage =
          "Request timeout - video processing took too long. Try with fewer clips.";
      }

      alert(
        `❌ ${errorMessage}\n\nCheck the backend terminal for detailed logs.`
      );
    } finally {
      setIsGeneratingHighlights(false);
    }
  };

  const handleDeleteClip = async (clipId) => {
    if (!confirm(`Are you sure you want to delete clip ${clipId}?`)) {
      return;
    }

    try {
      await apiDeleteJson(`/clip/${clipId}`, {
        headers: {
          "X-Session-Id": sessionId,
        },
      });

      // Update state
      setClips((prev) => prev.filter((c) => c.clip_id !== clipId));
      setEventLog((prev) => prev.filter((e) => e.clipId !== clipId));

      // Revoke and remove preview
      if (clipPreviews[clipId]) {
        try {
          URL.revokeObjectURL(clipPreviews[clipId]);
        } catch (_) {}
        setClipPreviews((prev) => {
          const newPreviews = { ...prev };
          delete newPreviews[clipId];
          return newPreviews;
        });
      }

      alert(`Clip ${clipId} deleted successfully!`);
    } catch (err) {
      console.error("Error deleting clip:", err);
      alert(`Error deleting clip: ${err.message}`);
    }
  };

  // Poll for new clips while processing is ongoing
  useEffect(() => {
    if (processingCount <= 0) return;
    let active = true;
    const intervalId = setInterval(async () => {
      if (!active) return;
      try {
        await loadClips();
      } catch (_) {}
    }, 2000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [processingCount]);

  const handleClearClips = async () => {
    if (clips.length === 0 && eventLog.length === 0) {
      alert("No clips to clear!");
      return;
    }

    if (
      !confirm("Are you sure you want to clear all saved clips and event log?")
    ) {
      return;
    }

    try {
      await apiDeleteJson("/clear_clips", {
        headers: {
          "X-Session-Id": sessionId,
        },
        timeoutMs: 60000,
      });
      setClips([]);
      setEventLog([]);
      setHighlightURL(null);
      // Revoke all preview URLs
      Object.values(clipPreviews).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      setClipPreviews({});
      alert("🧹 All clips and logs cleared successfully!");
    } catch (err) {
      console.error("Error clearing clips:", err);
      alert("Error clearing clips. Please try again!");
    }
  };

  return (
    <div className="app-container">
      <h1 className="title">🏆 Match Highlights Generator</h1>

      <div className="main-content">
        {/* Save location UI removed */}

        {/* Mode Toggle */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setMode("single")}
            className="btn"
            style={{
              backgroundColor: mode === "single" ? "#2563eb" : "#374151",
              color: "white",
            }}
          >
            🎥 Single View
          </button>
          <button
            onClick={() => setMode("switch")}
            className="btn"
            style={{
              backgroundColor: mode === "switch" ? "#2563eb" : "#374151",
              color: "white",
            }}
          >
            🔀 Switch Mode
          </button>
          <button
            onClick={() => setMode("slider")}
            className="btn"
            style={{
              backgroundColor: mode === "slider" ? "#2563eb" : "#374151",
              color: "white",
            }}
          >
            🎬 Slider Mode
          </button>
          <button
            onClick={() => setMode("aspect")}
            className="btn"
            style={{
              backgroundColor: mode === "aspect" ? "#2563eb" : "#374151",
              color: "white",
            }}
          >
            📐 Aspect Video Changer
          </button>
        </div>

        {/* Slider Mode */}
        {mode === "slider" ? (
          <div>
            <div
              style={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                padding: "0.5rem",
                marginBottom: "1rem",
                fontSize: "12px",
                color: "#9ca3af",
              }}
            >
              🔧 Debug: Session ID: {sessionId}
              <button
                onClick={clearSessionId}
                style={{
                  marginLeft: "1rem",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                Clear Session
              </button>
            </div>
            <SliderMode sessionId={sessionId} onClipsGenerated={loadClips} />
          </div>
        ) : mode === "aspect" ? (
          <div>
            <div className="upload-section">
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  color: "white",
                }}
              >
                📐 Aspect Video Changer
              </h2>
              <p
                style={{
                  color: "#9ca3af",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                Convert your video to 1:1 aspect ratio with 5:4 crop ratio. The
                video will be cropped to 5:4 (center crop) and stretched to fill
                a 1:1 frame.
              </p>

              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "1rem",
                  color: "#9ca3af",
                }}
              >
                Upload video to convert:
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setAspectVideoFile(file);
                    setAspectPreviewURL(URL.createObjectURL(file));
                    setConvertedVideoURL(null);
                  }
                }}
                className="file-input"
                style={{ opacity: 1, cursor: "pointer" }}
              />
            </div>

            {/* Video Preview */}
            {aspectPreviewURL && (
              <div className="video-section">
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "white",
                  }}
                >
                  Original Video Preview
                </h3>
                <div className="video-container">
                  <video
                    src={aspectPreviewURL}
                    controls
                    preload="metadata"
                    playsInline
                    disablePictureInPicture
                    className="video-player"
                  />
                </div>

                <button
                  onClick={async () => {
                    if (!aspectVideoFile) {
                      alert("Please upload a video first!");
                      return;
                    }

                    setIsConverting(true);
                    try {
                      const formData = new FormData();
                      formData.append("video", aspectVideoFile);

                      // Use fetch directly for POST with FormData
                      const response = await fetch(
                        `${API_BASE}/convert_aspect`,
                        {
                          method: "POST",
                          headers: {
                            "X-Session-Id": sessionId,
                          },
                          body: formData,
                        }
                      );

                      if (!response.ok) {
                        let errorText = "";
                        try {
                          const errorJson = await response.json();
                          errorText =
                            errorJson.error ||
                            errorJson.message ||
                            JSON.stringify(errorJson);
                        } catch {
                          errorText = await response.text();
                        }
                        throw new Error(
                          `HTTP ${response.status}: ${
                            errorText || response.statusText
                          }`
                        );
                      }

                      // Check if response is actually a video file
                      const contentType = response.headers.get("content-type");
                      if (!contentType || !contentType.includes("video")) {
                        const errorText = await response.text();
                        throw new Error(
                          `Expected video file, got ${contentType}: ${errorText}`
                        );
                      }

                      const blob = await response.blob();

                      if (blob.size === 0) {
                        throw new Error("Received empty video file");
                      }

                      // Create blob URL for download
                      const url = URL.createObjectURL(blob);
                      setConvertedVideoURL(url);
                      alert(
                        "🎉 Video converted successfully! You can now download it."
                      );
                    } catch (err) {
                      console.error("Error converting video:", err);
                      let errorMessage = "Error converting video";
                      if (err.message) {
                        errorMessage = err.message;
                      } else if (err.status === 507) {
                        errorMessage = "Disk space full! Please free up space.";
                      } else if (err.name === "AbortError") {
                        errorMessage = "Timeout - video too large";
                      }
                      alert(
                        `❌ ${errorMessage}\n\nCheck the backend terminal for detailed logs.`
                      );
                    } finally {
                      setIsConverting(false);
                    }
                  }}
                  disabled={isConverting || !aspectVideoFile}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: isConverting ? "#4b5563" : "#2563eb",
                    cursor: isConverting ? "not-allowed" : "pointer",
                    marginTop: "1rem",
                  }}
                >
                  {isConverting ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
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
                      Converting...
                    </span>
                  ) : (
                    "🔄 Convert to 1:1 (5:4 Crop)"
                  )}
                </button>

                <p
                  className="instructions-text"
                  style={{ marginTop: "0.5rem" }}
                >
                  Click the button to convert your video. The video will be
                  cropped to 5:4 (center crop) and stretched to fill a 1:1 frame
                  (1920x1920).
                </p>
              </div>
            )}

            {/* Converted Video */}
            {convertedVideoURL && (
              <div
                className="clip-section"
                style={{
                  border: "3px solid #059669",
                  boxShadow: "0 0 20px rgba(5, 150, 105, 0.3)",
                  marginTop: "2rem",
                }}
              >
                <h2
                  className="subtitle"
                  style={{
                    fontSize: "2rem",
                    color: "#10b981",
                  }}
                >
                  ✅ Video Converted Successfully!
                </h2>

                <p
                  style={{
                    color: "#9ca3af",
                    marginBottom: "1.5rem",
                    fontSize: "1.1rem",
                  }}
                >
                  Your video has been converted to 1:1 aspect ratio with 5:4
                  crop ratio. Download it below!
                </p>

                <div
                  className="video-container"
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    marginBottom: "1.5rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <video
                    src={convertedVideoURL}
                    controls
                    autoPlay
                    className="clip-video"
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      height: "auto",
                      maxHeight: "80vh",
                      objectFit: "contain",
                      border: "2px solid #059669",
                      borderRadius: "8px",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <a
                    href={convertedVideoURL}
                    download="converted_video_16_10.mp4"
                    className="btn btn-success"
                    style={{
                      fontSize: "1.1rem",
                      padding: "0.75rem 2rem",
                    }}
                  >
                    📥 Download Converted Video
                  </a>

                  <button
                    onClick={() => {
                      const video = document.querySelector(
                        ".clip-section video"
                      );
                      if (video) {
                        video.currentTime = 0;
                        video.play();
                      }
                    }}
                    className="btn"
                    style={{
                      backgroundColor: "#2563eb",
                      color: "white",
                    }}
                  >
                    🔄 Replay
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* File Upload */}
            <div className="upload-section">
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  color: "white",
                }}
              >
                📁 Upload Video
              </h2>
              {mode === "single" ? (
                <>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "1rem",
                      color: "#9ca3af",
                    }}
                  >
                    Upload your video file:
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="file-input"
                    style={{
                      opacity: 1,
                      cursor: "pointer",
                    }}
                  />
                </>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontSize: "1rem",
                        color: "#9ca3af",
                      }}
                    >
                      Upload Left Camera
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleLeftFileChange}
                      className="file-input"
                      style={{ opacity: 1, cursor: "pointer" }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontSize: "1rem",
                        color: "#9ca3af",
                      }}
                    >
                      Upload Right Camera
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleRightFileChange}
                      className="file-input"
                      style={{ opacity: 1, cursor: "pointer" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Video Preview */}
            {mode === "single" && previewURL && (
              <div className="video-section">
                <div className="video-container">
                  <video
                    ref={videoRef}
                    src={previewURL}
                    controls
                    preload="metadata"
                    playsInline
                    disablePictureInPicture
                    className="video-player"
                  />
                </div>

                <button
                  onClick={handleMarkEvent}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: "#2563eb",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  🎯 Mark Event & Save Clip (±10s)
                  {processingCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        backgroundColor: "#dc2626",
                        color: "white",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {processingCount}
                    </span>
                  )}
                </button>

                <p className="instructions-text">
                  Play the video and click the button at the moment you want to
                  capture. Each clip will be saved for the final highlights
                  video.
                </p>
              </div>
            )}

            {mode === "switch" && (leftPreviewURL || rightPreviewURL) && (
              <div className="video-section">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="video-container">
                    {leftPreviewURL ? (
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
                        onRateChange={syncRate}
                        onVolumeChange={syncVolume}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#6b7280",
                        }}
                      >
                        No left video
                      </div>
                    )}
                  </div>
                  <div className="video-container">
                    {rightPreviewURL ? (
                      <video
                        ref={rightVideoRef}
                        src={rightPreviewURL}
                        controls={false}
                        preload="metadata"
                        playsInline
                        disablePictureInPicture
                        className="video-player"
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#6b7280",
                        }}
                      >
                        No right video
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleMarkEvent}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: "#2563eb",
                    cursor: "pointer",
                    position: "relative",
                    marginTop: "0.75rem",
                  }}
                  disabled={!(leftPreviewURL && rightPreviewURL)}
                >
                  🎯 Mark Event & Save Switch Clip
                  {processingCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        backgroundColor: "#dc2626",
                        color: "white",
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {processingCount}
                    </span>
                  )}
                </button>

                <p className="instructions-text">
                  Play both videos in sync. Clicking will save a clip that
                  switches views per your plan.
                </p>

                {mode === "switch" && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      padding: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <label style={{ color: "#9ca3af" }}>
                        Total Duration (s):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={switchTotalDuration}
                        onChange={(e) =>
                          setSwitchTotalDuration(Number(e.target.value) || 1)
                        }
                        className="file-input"
                        style={{ width: "100px" }}
                      />
                    </div>
                    <div style={{ color: "#9ca3af", marginBottom: "0.5rem" }}>
                      Switch Segments (view until cumulative second):
                    </div>
                    {switchPlan.map((seg, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "160px 1fr 100px",
                          gap: "0.5rem",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <select
                          value={seg.view}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSwitchPlan((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, view: v } : s
                              )
                            );
                          }}
                          className="file-input"
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                        <div style={{ color: "#9ca3af" }}>till</div>
                        <input
                          type="number"
                          min="0"
                          value={seg.till}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setSwitchPlan((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, till: v } : s
                              )
                            );
                          }}
                          className="file-input"
                        />
                        <button
                          onClick={() =>
                            setSwitchPlan((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="btn"
                          style={{
                            backgroundColor: "#7f1d1d",
                            color: "white",
                            gridColumn: "1 / span 3",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() =>
                          setSwitchPlan((prev) => [
                            ...prev,
                            {
                              view: "left",
                              till: (prev[prev.length - 1]?.till || 0) + 5,
                            },
                          ])
                        }
                        className="btn"
                        style={{ backgroundColor: "#374151", color: "white" }}
                      >
                        + Add Segment
                      </button>
                      <button
                        onClick={() =>
                          setSwitchPlan([
                            { view: "left", till: 5 },
                            { view: "right", till: 10 },
                          ])
                        }
                        className="btn"
                        style={{ backgroundColor: "#374151", color: "white" }}
                      >
                        Reset Example
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Event Log */}
            {eventLog.length > 0 && (
              <div className="clip-section">
                <h2 className="subtitle">
                  📋 Event Log ({eventLog.length} events)
                </h2>

                <div
                  style={{
                    maxHeight: "300px",
                    overflowY: "auto",
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  {eventLog.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem",
                        marginBottom: "0.5rem",
                        backgroundColor:
                          entry.status === "saved"
                            ? "#065f46"
                            : entry.status === "error"
                            ? "#7f1d1d"
                            : "#374151",
                        borderRadius: "4px",
                        fontSize: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontWeight: "bold", color: "#60a5fa" }}>
                          {entry.formattedTime}
                        </span>
                        <span style={{ color: "#9ca3af" }}>
                          at {entry.createdAt}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {entry.status === "processing" && (
                          <span style={{ color: "#fbbf24" }}>
                            ⏳ Processing...
                          </span>
                        )}
                        {entry.status === "saved" && (
                          <span style={{ color: "#10b981" }}>
                            ✅ Saved (ID: {entry.clipId})
                          </span>
                        )}
                        {entry.status === "error" && (
                          <span style={{ color: "#ef4444" }}>❌ Error</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Clips Management */}
            {clips.length > 0 && (
              <div className="clip-section">
                <h2 className="subtitle">🎞️ Saved Clips ({clips.length})</h2>

                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={handleGenerateHighlights}
                    disabled={isGeneratingHighlights}
                    className="btn btn-success"
                    style={{
                      backgroundColor: isGeneratingHighlights
                        ? "#4b5563"
                        : "#059669",
                      cursor: isGeneratingHighlights
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {isGeneratingHighlights ? (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
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
                        Generating...
                      </span>
                    ) : (
                      "🎬 Generate Highlights Video"
                    )}
                  </button>

                  <button
                    onClick={handleClearClips}
                    className="btn"
                    style={{
                      backgroundColor: "#dc2626",
                      color: "white",
                    }}
                  >
                    🗑️ Clear All Clips
                  </button>
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    color: "#9ca3af",
                    textAlign: "center",
                  }}
                >
                  <p>Clips will be combined in the order they were created</p>
                </div>

                {/* Live-updating clip previews */}
                <div
                  style={{
                    marginTop: "1rem",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {clips.map((clip) => {
                    const url = clipPreviews[clip.clip_id];
                    return (
                      <div
                        key={clip.clip_id}
                        style={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          padding: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            color: "#9ca3af",
                            marginBottom: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          <span>Clip ID: {clip.clip_id}</span>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "center",
                            }}
                          >
                            {clip.mode && (
                              <span
                                style={{
                                  backgroundColor: "#374151",
                                  color: "white",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                {clip.mode === "switch"
                                  ? "Switch"
                                  : clip.mode === "slider"
                                  ? "Slider"
                                  : "Single"}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteClip(clip.clip_id)}
                              className="btn"
                              style={{
                                backgroundColor: "#7f1d1d",
                                color: "white",
                                padding: "2px 6px",
                                fontSize: "0.75rem",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            backgroundColor: "#111827",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "4px",
                          }}
                        >
                          {url ? (
                            <video
                              src={url}
                              controls
                              muted
                              className="clip-video"
                              style={{
                                width: "100%",
                                height: "auto",
                                maxHeight: "70vh",
                                objectFit: "contain",
                                border: "1px solid #374151",
                                borderRadius: "4px",
                              }}
                            />
                          ) : (
                            <span style={{ color: "#6b7280" }}>
                              Processing...
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            color: "#9ca3af",
                            marginTop: "0.5rem",
                            fontSize: "0.85rem",
                          }}
                        >
                          {`Range: ${Math.floor(
                            clip.start_time
                          )}s - ${Math.floor(clip.end_time)}s`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Generated Highlights */}
            {highlightURL && (
              <div
                className="clip-section"
                style={{
                  border: "3px solid #059669",
                  boxShadow: "0 0 20px rgba(5, 150, 105, 0.3)",
                }}
              >
                <h2
                  className="subtitle"
                  style={{
                    fontSize: "2rem",
                    color: "#10b981",
                  }}
                >
                  🏆 Match Highlights Ready!
                </h2>

                <p
                  style={{
                    color: "#9ca3af",
                    marginBottom: "1.5rem",
                    fontSize: "1.1rem",
                  }}
                >
                  Your combined highlights video is ready to watch and download!
                </p>

                <div
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    marginBottom: "1.5rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <video
                    src={highlightURL}
                    controls
                    autoPlay
                    className="clip-video"
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "70vh",
                      objectFit: "contain",
                      border: "2px solid #059669",
                      borderRadius: "8px",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <a
                    href={highlightURL}
                    download="match_highlights.mp4"
                    className="btn btn-success"
                    style={{
                      fontSize: "1.1rem",
                      padding: "0.75rem 2rem",
                    }}
                  >
                    📥 Download Highlights Video
                  </a>

                  <button
                    onClick={() => {
                      const video = document.querySelector(
                        ".clip-section video"
                      );
                      if (video) {
                        video.currentTime = 0;
                        video.play();
                      }
                    }}
                    className="btn"
                    style={{
                      backgroundColor: "#2563eb",
                      color: "white",
                    }}
                  >
                    🔄 Replay
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions-section">
        <h3 className="instructions-title">How to create match highlights:</h3>
        <ol className="instructions-list">
          <li>1. Upload a video file (match recording, gameplay, etc.)</li>
          <li>2. Play the video and navigate to exciting moments</li>
          <li>
            3. Click "Mark Event & Save Clip" for each highlight (±10s clips)
          </li>
          <li>4. Repeat step 3 for all the moments you want to include</li>
          <li>5. Click "Generate Highlights Video" to combine all clips</li>
          <li>6. Download your complete match highlights!</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
