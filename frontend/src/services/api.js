/**
 * Backend API service for highlight generation
 * Connects to FastAPI v2 backend
 */

const API_BASE_URL = 'http://localhost:8000';

// Map frontend source names to backend camera IDs
const sourceToCamera = {
  'left': 'C1',        // Left Half
  'left_zoom': 'C2',   // Left Zoom
  'right': 'C3',       // Right Half
  'right_zoom': 'C4'   // Right Zoom
};

/**
 * Upload 4 camera videos to backend
 * @param {Object} videoFiles - Object with keys: left, left_zoom, right, right_zoom (File objects)
 * @returns {Promise<{session_key: string, compatible: boolean, metadata: object}>}
 */
export async function uploadCameras(videoFiles) {
  const formData = new FormData();

  // Map frontend sources to backend camera IDs
  formData.append('C1', videoFiles.left);
  formData.append('C2', videoFiles.left_zoom);
  formData.append('C3', videoFiles.right);
  formData.append('C4', videoFiles.right_zoom);

  const response = await fetch(`${API_BASE_URL}/api/v2/upload_cameras`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload cameras');
  }

  return await response.json();
}

/**
 * Create a clip on the backend
 * @param {string} sessionKey - Session key from uploadCameras
 * @param {Object} clip - Frontend clip object with {source, start, end}
 * @param {Object} scoreboard - Optional scoreboard data {teamAName, teamBName, scoreA, scoreB}
 * @returns {Promise<{clip_id: string, duration_s: number, filesize_bytes: number, download_url: string}>}
 */
export async function createClip(sessionKey, clip, scoreboard = null) {
  const formData = new FormData();
  formData.append('session_key', sessionKey);

  // Convert frontend clip to backend segment format
  const segments = [{
    camera_id: sourceToCamera[clip.source],
    start_s: clip.start,
    end_s: clip.end
  }];

  formData.append('segments', JSON.stringify(segments));
  
  // Add scoreboard if provided
  if (scoreboard) {
    formData.append('scoreboard', JSON.stringify(scoreboard));
  }

  const response = await fetch(`${API_BASE_URL}/api/v2/clip/create`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create clip');
  }

  return await response.json();
}

/**
 * Create a highlight reel from clips
 * @param {string[]} clipIds - Array of backend clip IDs
 * @returns {Promise<{reel_id: string, duration_s: number, filesize_bytes: number, num_clips: number, download_url: string}>}
 */
export async function createReel(clipIds) {
  const response = await fetch(`${API_BASE_URL}/api/v2/reel/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clip_ids: clipIds })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create reel');
  }

  return await response.json();
}

/**
 * Get download URL for a reel
 * @param {string} reelId - Reel ID from createReel
 * @returns {string} - Full download URL
 */
export function getReelDownloadUrl(reelId) {
  return `${API_BASE_URL}/api/v2/reel/${reelId}/download`;
}

/**
 * Get download URL for a clip
 * @param {string} clipId - Clip ID from createClip
 * @returns {string} - Full download URL
 */
export function getClipDownloadUrl(clipId) {
  return `${API_BASE_URL}/api/v2/clip/${clipId}/download`;
}
