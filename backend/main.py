"""
FastAPI application for multi-camera highlight generation.
Stream-copy only, zero re-encoding, maximum performance.
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import tempfile
import os
import json
import logging
import time

from models.clip import ClipSegment, ClipResponse
from models.reel import ReelCreate, ReelResponse
from services.ffmpeg_service import FFmpegService
from services.clip_service import ClipService
from services.reel_service import ReelService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Multi-Camera Highlight Generator v2",
    description="Stream-copy based video editing for multi-camera highlights",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
OUTPUT_DIR = os.path.join(os.getcwd(), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ffmpeg_service = FFmpegService()
clip_service = ClipService(output_dir=os.path.join(OUTPUT_DIR, "clips"), ffmpeg_service=ffmpeg_service)
reel_service = ReelService(output_dir=os.path.join(OUTPUT_DIR, "reels"), ffmpeg_service=ffmpeg_service, clip_service=clip_service)

# In-memory storage for uploaded camera files (session-like)
# In production, use Redis or similar
camera_uploads = {}  # {session_key: {C1: path, C2: path, C3: path, C4: path}}


@app.get("/")
async def root():
    """Health check"""
    return {
        "message": "Multi-Camera Highlight Generator v2",
        "status": "running",
        "version": "2.0.0"
    }


@app.post("/api/v2/upload_cameras")
async def upload_cameras(
    C1: UploadFile = File(...),
    C2: UploadFile = File(...),
    C3: UploadFile = File(...),
    C4: UploadFile = File(...)
):
    """
    Upload 4 camera videos for a session.
    Returns a session key to use for clip creation.
    """
    logger.info("Uploading 4 camera files...")

    # Generate session key
    session_key = f"sess_{int(time.time())}_{os.urandom(4).hex()}"

    camera_files = {}
    temp_files = []

    try:
        # Save uploaded files to temp directory
        for camera_id, upload_file in [("C1", C1), ("C2", C2), ("C3", C3), ("C4", C4)]:
            # Create temp file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4", prefix=f"{camera_id}_")
            temp_path = temp_file.name

            # Write uploaded data
            content = await upload_file.read()
            temp_file.write(content)
            temp_file.close()

            camera_files[camera_id] = temp_path
            temp_files.append(temp_path)

            logger.info(f"  {camera_id}: {len(content):,} bytes → {temp_path}")

        # Validate compatibility
        paths = [camera_files["C1"], camera_files["C2"], camera_files["C3"], camera_files["C4"]]
        compatible, error_msg = ffmpeg_service.validate_compatibility(paths)

        if not compatible:
            # Cleanup on validation failure
            for path in temp_files:
                try:
                    os.unlink(path)
                except:
                    pass
            raise HTTPException(status_code=400, detail=f"Videos are incompatible: {error_msg}")

        # Store camera files in memory
        camera_uploads[session_key] = camera_files

        # Get metadata for first camera
        metadata = ffmpeg_service.probe_video(camera_files["C1"])

        logger.info(f"Session {session_key} created successfully")

        return JSONResponse({
            "session_key": session_key,
            "compatible": True,
            "metadata": {
                "codec": metadata.codec_name,
                "resolution": f"{metadata.width}x{metadata.height}",
                "fps": metadata.r_frame_rate,
                "duration_s": metadata.duration
            }
        })

    except Exception as e:
        logger.error(f"Error uploading cameras: {e}")
        # Cleanup on error
        for path in temp_files:
            try:
                if os.path.exists(path):
                    os.unlink(path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/clip/create", response_model=ClipResponse)
async def create_clip(
    session_key: str = Form(...),
    segments: str = Form(...)  # JSON string
):
    """
    Create a clip from camera segments.

    Args:
        session_key: Session key from upload_cameras
        segments: JSON array of segments, e.g.:
            [
                {"camera_id": "C1", "start_s": 10.5, "end_s": 15.2},
                {"camera_id": "C2", "start_s": 15.2, "end_s": 20.0}
            ]

    Returns:
        ClipResponse with clip_id and download URL
    """
    logger.info(f"Creating clip for session {session_key}")

    # Validate session
    if session_key not in camera_uploads:
        raise HTTPException(status_code=404, detail=f"Session {session_key} not found")

    camera_files = camera_uploads[session_key]

    # Parse segments
    try:
        segments_data = json.loads(segments)
        clip_segments = [ClipSegment(**seg) for seg in segments_data]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid segments JSON: {e}")

    # Create clip
    try:
        start_time = time.time()
        clip = clip_service.create_clip(
            segments=clip_segments,
            camera_files=camera_files
        )
        processing_time_ms = (time.time() - start_time) * 1000

        return ClipResponse(
            clip_id=clip.clip_id,
            duration_s=clip.duration_s,
            filesize_bytes=clip.filesize_bytes,
            download_url=f"/api/v2/clip/{clip.clip_id}/download",
            processing_time_ms=processing_time_ms
        )

    except Exception as e:
        logger.error(f"Error creating clip: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/clip/{clip_id}/download")
async def download_clip(clip_id: str):
    """Download a clip file"""
    try:
        clip_path = clip_service.get_clip_path(clip_id)

        if not os.path.exists(clip_path):
            raise HTTPException(status_code=404, detail="Clip file not found")

        return FileResponse(
            clip_path,
            media_type="video/mp4",
            filename=f"{clip_id}.mp4"
        )

    except KeyError:
        raise HTTPException(status_code=404, detail=f"Clip {clip_id} not found")
    except Exception as e:
        logger.error(f"Error downloading clip: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/reel/create", response_model=ReelResponse)
async def create_reel(request: ReelCreate):
    """
    Create a highlight reel from existing clips.

    Args:
        request: ReelCreate with list of clip_ids

    Returns:
        ReelResponse with reel_id and download URL
    """
    logger.info(f"Creating reel from {len(request.clip_ids)} clips")

    try:
        start_time = time.time()
        reel = reel_service.create_reel(clip_ids=request.clip_ids)
        processing_time_ms = (time.time() - start_time) * 1000

        return ReelResponse(
            reel_id=reel.reel_id,
            duration_s=reel.duration_s,
            filesize_bytes=reel.filesize_bytes,
            num_clips=len(request.clip_ids),
            download_url=f"/api/v2/reel/{reel.reel_id}/download",
            processing_time_ms=processing_time_ms
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating reel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/reel/{reel_id}/download")
async def download_reel(reel_id: str):
    """Download a reel file"""
    try:
        reel_path = reel_service.get_reel_path(reel_id)

        if not os.path.exists(reel_path):
            raise HTTPException(status_code=404, detail="Reel file not found")

        return FileResponse(
            reel_path,
            media_type="video/mp4",
            filename=f"{reel_id}.mp4"
        )

    except KeyError:
        raise HTTPException(status_code=404, detail=f"Reel {reel_id} not found")
    except Exception as e:
        logger.error(f"Error downloading reel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/clips")
async def list_clips():
    """List all clips"""
    clips = clip_service.list_clips()
    return {
        "clips": [
            {
                "clip_id": clip.clip_id,
                "duration_s": clip.duration_s,
                "filesize_bytes": clip.filesize_bytes,
                "num_segments": len(clip.segments),
                "created_at": clip.created_at.isoformat()
            }
            for clip in clips
        ]
    }


@app.get("/api/v2/reels")
async def list_reels():
    """List all reels"""
    reels = reel_service.list_reels()
    return {
        "reels": [
            {
                "reel_id": reel.reel_id,
                "duration_s": reel.duration_s,
                "filesize_bytes": reel.filesize_bytes,
                "num_clips": len(reel.clip_ids),
                "created_at": reel.created_at.isoformat()
            }
            for reel in reels
        ]
    }


@app.delete("/api/v2/clip/{clip_id}")
async def delete_clip(clip_id: str):
    """Delete a clip"""
    try:
        clip_service.delete_clip(clip_id)
        return {"message": f"Clip {clip_id} deleted successfully"}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Clip {clip_id} not found")
    except Exception as e:
        logger.error(f"Error deleting clip: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v2/reel/{reel_id}")
async def delete_reel(reel_id: str):
    """Delete a reel"""
    try:
        reel_service.delete_reel(reel_id)
        return {"message": f"Reel {reel_id} deleted successfully"}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Reel {reel_id} not found")
    except Exception as e:
        logger.error(f"Error deleting reel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v2/session/{session_key}")
async def cleanup_session(session_key: str):
    """Cleanup session and temporary camera files"""
    if session_key not in camera_uploads:
        raise HTTPException(status_code=404, detail=f"Session {session_key} not found")

    camera_files = camera_uploads[session_key]

    # Delete temp files
    for camera_id, path in camera_files.items():
        try:
            if os.path.exists(path):
                os.unlink(path)
                logger.info(f"Deleted temp file: {path}")
        except Exception as e:
            logger.warning(f"Failed to delete {path}: {e}")

    # Remove from memory
    del camera_uploads[session_key]

    return {"message": f"Session {session_key} cleaned up successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
